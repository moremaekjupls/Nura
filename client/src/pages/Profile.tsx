/**
 * Profile page
 * Replaces the old "Dashboard" tab. Lets the user set basic personal info
 * (name, height, weight, birth year, gender) and, via a settings button,
 * their daily nutrition + water goals (reuses GoalSettingsDialog).
 *
 * Two small UX details worth noting:
 *  - View/edit toggle: once a profile has data, it renders as a read-only
 *    summary with a single "Изменить" button, rather than staying an
 *    always-editable form with a "Сохранить" button that never goes away.
 *  - Module-level cache (profileCache/goalCache below): this page unmounts
 *    every time the user switches tabs (wouter Switch), so a naive
 *    useState('') would flash empty/default fields for a beat on every
 *    return to this tab while the fetch is in flight. Caching the last
 *    fetched values lets remounts render with real data immediately, while
 *    still refetching in the background to stay fresh.
 */

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GoalSettingsDialog } from '@/components/GoalSettingsDialog';
import { useAuth } from '@/contexts/AuthContext';
import * as storageService from '@/lib/storageService';
import { Goal, Profile as ProfileType, Gender } from '@/types';
import { Settings, LogOut, User as UserIcon, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { GLASS_CARD } from '@/lib/glass';
import { cn } from '@/lib/utils';

let profileCache: ProfileType | null = null;
let goalCache: Goal | null = null;

function isProfileEmpty(p: ProfileType): boolean {
  return !p.name && p.heightCm == null && p.weightKg == null && p.birthYear == null && !p.gender;
}

const genderLabels: Record<Gender, string> = { male: 'Мужчина', female: 'Женщина' };

export default function Profile() {
  const { user, logout } = useAuth();

  const [loading, setLoading] = useState(!profileCache);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(() => (profileCache ? isProfileEmpty(profileCache) : false));

  const [name, setName] = useState(profileCache?.name ?? '');
  const [height, setHeight] = useState(profileCache?.heightCm != null ? String(profileCache.heightCm) : '');
  const [weight, setWeight] = useState(profileCache?.weightKg != null ? String(profileCache.weightKg) : '');
  const [birthYear, setBirthYear] = useState(profileCache?.birthYear != null ? String(profileCache.birthYear) : '');
  const [gender, setGender] = useState<Gender | null>(profileCache?.gender ?? null);

  const [goal, setGoal] = useState<Goal | null>(goalCache);
  const [showGoalDialog, setShowGoalDialog] = useState(false);

  useEffect(() => {
    const hadCache = profileCache != null;
    let active = true;

    Promise.all([storageService.getProfile(), storageService.getGoal()])
      .then(([profile, g]) => {
        if (!active) return;
        profileCache = profile;
        goalCache = g;
        setName(profile.name ?? '');
        setHeight(profile.heightCm != null ? String(profile.heightCm) : '');
        setWeight(profile.weightKg != null ? String(profile.weightKg) : '');
        setBirthYear(profile.birthYear != null ? String(profile.birthYear) : '');
        setGender(profile.gender ?? null);
        setGoal(g);
        // Only decide the view/edit default on the very first load this
        // session — a background refresh on a later mount shouldn't yank
        // the user out of edit mode if they're mid-change.
        if (!hadCache) setEditing(isProfileEmpty(profile));
      })
      .catch((err) => console.error('Error loading profile:', err))
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, []);

  const handleCancelEdit = () => {
    if (profileCache) {
      setName(profileCache.name ?? '');
      setHeight(profileCache.heightCm != null ? String(profileCache.heightCm) : '');
      setWeight(profileCache.weightKg != null ? String(profileCache.weightKg) : '');
      setBirthYear(profileCache.birthYear != null ? String(profileCache.birthYear) : '');
      setGender(profileCache.gender ?? null);
    }
    setEditing(false);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const saved = await storageService.updateProfile({
        name: name.trim() || null,
        heightCm: height ? Number(height) : null,
        weightKg: weight ? Number(weight) : null,
        birthYear: birthYear ? Number(birthYear) : null,
        gender,
      });
      profileCache = saved;
      toast.success('Профиль сохранён');
      setEditing(false);
    } catch (err) {
      console.error('Error saving profile:', err);
      toast.error(err instanceof Error ? err.message : 'Не удалось сохранить профиль');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveGoal = async (newGoal: Goal) => {
    try {
      const saved = await storageService.setGoal(newGoal);
      goalCache = saved;
      setGoal(saved);
      toast.success('Цели обновлены');
    } catch (err) {
      console.error('Error saving goal:', err);
      toast.error('Не удалось сохранить цели');
    }
  };

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-40 bg-[oklch(0.97_0.01_240)]/82 backdrop-blur-xl backdrop-saturate-150 border-b border-[oklch(0.97_0.01_240)]/45">
        <div
          className="container app-shell py-4 flex items-center justify-between"
          style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}
        >
          <h1 className="text-2xl font-display font-bold text-primary">Профиль</h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowGoalDialog(true)}
            className="rounded-full text-muted-foreground hover:text-foreground"
            title="Цели по питанию"
          >
            <Settings className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="container app-shell py-6 space-y-4">
        <Card className={cn('p-5 border', GLASS_CARD)}>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
              <UserIcon className="w-6 h-6 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-foreground truncate">{name || 'Без имени'}</p>
              <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>

          {editing ? (
            <div className="space-y-3">
              <div>
                <Label htmlFor="profile-name" className="text-sm font-semibold">Имя</Label>
                <Input
                  id="profile-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Как вас зовут?"
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="profile-height" className="text-sm font-semibold">Рост, см</Label>
                  <Input
                    id="profile-height"
                    type="number"
                    min="0"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    placeholder="170"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="profile-weight" className="text-sm font-semibold">Вес, кг</Label>
                  <Input
                    id="profile-weight"
                    type="number"
                    min="0"
                    step="0.1"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder="65"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="profile-birth-year" className="text-sm font-semibold">Год рожд.</Label>
                  <Input
                    id="profile-birth-year"
                    type="number"
                    min="1900"
                    max={new Date().getFullYear()}
                    value={birthYear}
                    onChange={(e) => setBirthYear(e.target.value)}
                    placeholder="1998"
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label className="text-sm font-semibold">Пол</Label>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  {(['male', 'female'] as Gender[]).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGender(g)}
                      className={cn(
                        'rounded-lg border py-2 text-sm font-medium transition-colors',
                        gender === g
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-input text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {genderLabels[g]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  onClick={handleSaveProfile}
                  disabled={saving || loading}
                  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {saving ? 'Сохраняем...' : 'Сохранить'}
                </Button>
                {profileCache && !isProfileEmpty(profileCache) && (
                  <Button variant="outline" onClick={handleCancelEdit} disabled={saving} className="flex-1">
                    Отмена
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Рост</p>
                  <p className="font-medium text-foreground">{height ? `${height} см` : '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Вес</p>
                  <p className="font-medium text-foreground">{weight ? `${weight} кг` : '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Год рождения</p>
                  <p className="font-medium text-foreground">{birthYear || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Пол</p>
                  <p className="font-medium text-foreground">{gender ? genderLabels[gender] : '—'}</p>
                </div>
              </div>
              <Button variant="outline" onClick={() => setEditing(true)} className="w-full gap-2">
                <Pencil className="w-3.5 h-3.5" /> Изменить
              </Button>
            </div>
          )}
        </Card>

        <Card className={cn('p-5 border', GLASS_CARD)}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-foreground">Цели по питанию</p>
              <p className="text-sm text-muted-foreground">Калории, БЖУ и вода на день</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowGoalDialog(true)}
              className="shrink-0 gap-1.5"
            >
              <Settings className="w-3.5 h-3.5" /> Настроить
            </Button>
          </div>
          {goal && (
            <p className="text-sm text-muted-foreground mt-3">
              🔥 {goal.calories} ккал · Б {goal.protein}г · Ж {goal.fat}г · У {goal.carbs}г · 💧 {goal.water} мл
            </p>
          )}
        </Card>

        <Button
          variant="outline"
          onClick={() => logout()}
          className="w-full gap-2 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="w-4 h-4" /> Выйти из аккаунта
        </Button>
      </main>

      {goal && (
        <GoalSettingsDialog
          open={showGoalDialog}
          goal={goal}
          onSave={handleSaveGoal}
          onOpenChange={setShowGoalDialog}
        />
      )}
    </div>
  );
}
