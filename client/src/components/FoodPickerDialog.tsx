/**
 * FoodPickerDialog Component
 * Central modal opened from the "+" button. Lets the user stack up several
 * items in one sitting — Uzbek-cuisine presets, recent/frequent foods, an
 * Open Food Facts search, or a manual entry — with a live running total,
 * then commits everything in a single batch instead of one-at-a-time.
 *
 * Each staged item stores BASE nutrition (per one unit/portion/100g) plus a
 * `quantity` multiplier, so "3 яйца" or "2 порции плова" compute their kcal
 * and BJU automatically instead of requiring the user to do the math.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Entry, MealType } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getRecentFoods, getFrequentFoods, QuickFood, analyzeMealPhoto, PhotoAnalysisResult } from '@/lib/storageService';
import { uzbekFoods } from '@/data/uzbekFoods';
import { X, Search, Plus, Minus, ChefHat, Clock, ListPlus, Camera, Loader2, AlertCircle, Sparkles } from 'lucide-react';

// ---------------------------------------------------------------------------
// Open Food Facts search (same endpoint as before, no autofill — adds directly)
// ---------------------------------------------------------------------------

interface OFFProduct {
  product_name: string;
  nutriments: {
    'energy-kcal_100g'?: number;
    proteins_100g?: number;
    fat_100g?: number;
    carbohydrates_100g?: number;
  };
}

async function searchFoodFacts(query: string): Promise<OFFProduct[]> {
  if (!query.trim()) return [];
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=8&fields=product_name,nutriments&lc=ru,en`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.products || []).filter(
      (p: OFFProduct) => p.product_name && p.nutriments?.['energy-kcal_100g'] != null
    );
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Staged item = something the user has picked but not yet saved.
// Nutrition is stored as a BASE (per one unit/portion/100g) so it can be
// multiplied live by `quantity` without losing the original per-unit values.
// ---------------------------------------------------------------------------

interface StagedItem {
  key: string;
  emoji?: string;
  name: string;
  baseCalories: number;
  baseProtein: number;
  baseFat: number;
  baseCarbs: number;
  quantity: number;
  unitLabel: string; // human-readable unit, e.g. "порция", "100 г", "350 г"
  mealType: MealType;
}

function formatQty(q: number): string {
  return q % 1 === 0 ? String(q) : q.toFixed(1);
}

const mealTypeLabels: Record<MealType, string> = {
  breakfast: 'Завтрак',
  lunch: 'Обед',
  dinner: 'Ужин',
  snack: 'Перекус',
};

interface FoodPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  onAddBatch: (entries: Omit<Entry, 'id'>[]) => Promise<void> | void;
}

export function FoodPickerDialog({ open, onOpenChange, date, onAddBatch }: FoodPickerDialogProps) {
  const [staged, setStaged] = useState<StagedItem[]>([]);
  const [defaultMealType, setDefaultMealType] = useState<MealType>('snack');
  const [submitting, setSubmitting] = useState(false);

  // Search
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<OFFProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Recent / frequent
  const [recentFoods, setRecentFoods] = useState<QuickFood[]>([]);
  const [frequentFoods, setFrequentFoods] = useState<QuickFood[]>([]);

  // Manual entry
  const [showManual, setShowManual] = useState(false);
  const [mName, setMName] = useState('');
  const [mQuantity, setMQuantity] = useState('1');
  const [mCalories, setMCalories] = useState('');
  const [mProtein, setMProtein] = useState('');
  const [mFat, setMFat] = useState('');
  const [mCarbs, setMCarbs] = useState('');

  // AI photo analysis
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoResult, setPhotoResult] = useState<PhotoAnalysisResult | null>(null);
  const [pName, setPName] = useState('');
  const [pCalories, setPCalories] = useState('');
  const [pProtein, setPProtein] = useState('');
  const [pFat, setPFat] = useState('');
  const [pCarbs, setPCarbs] = useState('');

  useEffect(() => {
    if (open) {
      getRecentFoods(8).then(setRecentFoods).catch(() => {});
      getFrequentFoods(6).then(setFrequentFoods).catch(() => {});
    } else {
      // Reset everything when the dialog closes
      setStaged([]);
      setQuery('');
      setSearchResults([]);
      setShowManual(false);
      setMName(''); setMQuantity('1'); setMCalories(''); setMProtein(''); setMFat(''); setMCarbs('');
      resetPhoto();
    }
  }, [open]);

  function resetPhoto() {
    setPhotoPreview(null);
    setAnalyzing(false);
    setPhotoError(null);
    setPhotoResult(null);
    setPName(''); setPCalories(''); setPProtein(''); setPFat(''); setPCarbs('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const handlePhotoSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError(null);
    setPhotoResult(null);
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setPhotoPreview(dataUrl);
      const base64 = dataUrl.split(',')[1] ?? '';
      setAnalyzing(true);
      try {
        const result = await analyzeMealPhoto(base64, file.type);
        setPhotoResult(result);
        setPName(result.name);
        setPCalories(String(Math.round(result.calories)));
        setPProtein(String(result.protein));
        setPFat(String(result.fat));
        setPCarbs(String(result.carbs));
      } catch (err) {
        setPhotoError(err instanceof Error ? err.message : 'Не удалось проанализировать фото');
      } finally {
        setAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePhotoAdd = () => {
    const calories = parseFloat(pCalories);
    if (!pName.trim() || !calories || calories < 0) return;
    addToStaged({
      emoji: '🤖',
      name: pName.trim(),
      baseCalories: calories,
      baseProtein: parseFloat(pProtein) || 0,
      baseFat: parseFloat(pFat) || 0,
      baseCarbs: parseFloat(pCarbs) || 0,
      quantity: 1,
      unitLabel: 'порция',
      mealType: defaultMealType,
    });
    resetPhoto();
  };

  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (value.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      const results = await searchFoodFacts(value);
      setSearchResults(results);
      setSearching(false);
    }, 500);
  }, []);

  const addToStaged = (item: Omit<StagedItem, 'key'>) => {
    setStaged((prev) => [...prev, { ...item, key: `${Date.now()}-${Math.random()}` }]);
  };

  const removeStaged = (key: string) => {
    setStaged((prev) => prev.filter((s) => s.key !== key));
  };

  const updateStagedQuantity = (key: string, quantity: number) => {
    const clamped = Math.max(0.5, Math.round(quantity * 2) / 2);
    setStaged((prev) => prev.map((s) => (s.key === key ? { ...s, quantity: clamped } : s)));
  };

  const mQuantityNum = parseFloat(mQuantity) || 1;
  const mCaloriesNum = parseFloat(mCalories) || 0;

  const handleManualAdd = () => {
    const calories = parseFloat(mCalories);
    const quantity = parseFloat(mQuantity) || 1;
    if (!mName.trim() || !calories || calories < 0 || quantity <= 0) return;
    addToStaged({
      emoji: '📝',
      name: mName.trim(),
      baseCalories: calories,
      baseProtein: parseFloat(mProtein) || 0,
      baseFat: parseFloat(mFat) || 0,
      baseCarbs: parseFloat(mCarbs) || 0,
      quantity,
      unitLabel: 'порция',
      mealType: defaultMealType,
    });
    setMName(''); setMQuantity('1'); setMCalories(''); setMProtein(''); setMFat(''); setMCarbs('');
  };

  const totals = staged.reduce(
    (acc, s) => ({
      calories: acc.calories + s.baseCalories * s.quantity,
      protein: acc.protein + s.baseProtein * s.quantity,
      fat: acc.fat + s.baseFat * s.quantity,
      carbs: acc.carbs + s.baseCarbs * s.quantity,
    }),
    { calories: 0, protein: 0, fat: 0, carbs: 0 }
  );

  const handleCommit = async () => {
    if (staged.length === 0) return;
    setSubmitting(true);
    try {
      await onAddBatch(
        staged.map((s) => ({
          date,
          name: s.quantity !== 1 ? `${s.name} (×${formatQty(s.quantity)})` : s.name,
          calories: Math.round(s.baseCalories * s.quantity),
          protein: Math.round(s.baseProtein * s.quantity * 10) / 10,
          fat: Math.round(s.baseFat * s.quantity * 10) / 10,
          carbs: Math.round(s.baseCarbs * s.quantity * 10) / 10,
          mealType: s.mealType,
        }))
      );
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  // Combine recent + frequent, dedup, frequent first
  const quickFoods = [
    ...frequentFoods,
    ...recentFoods.filter((r) => !frequentFoods.some((f) => f.name === r.name)),
  ].slice(0, 8);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[88vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="font-heading flex items-center gap-2">
            <span className="text-xl">🍽️</span> Добавить продукты
          </DialogTitle>
          <DialogDescription>
            Выберите сколько угодно позиций — всё сложится автоматически
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 space-y-5 py-2">
          {/* Default meal type for this session */}
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Приём пищи
            </Label>
            <Select value={defaultMealType} onValueChange={(v) => setDefaultMealType(v as MealType)}>
              <SelectTrigger className="mt-1 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="breakfast">🍳 Завтрак</SelectItem>
                <SelectItem value="lunch">🍲 Обед</SelectItem>
                <SelectItem value="dinner">🌙 Ужин</SelectItem>
                <SelectItem value="snack">🍪 Перекус</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* AI photo analysis — headline feature */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Анализ фото блюда (AI)
            </Label>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handlePhotoSelected}
            />

            {!photoPreview && (
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="mt-2 w-full border-primary/30 text-primary hover:bg-primary/10 gap-2"
              >
                <Camera className="w-4 h-4" /> Сделать или выбрать фото
              </Button>
            )}

            {photoPreview && (
              <div className="mt-2 flex gap-3">
                <img
                  src={photoPreview}
                  alt="Фото блюда"
                  className="w-20 h-20 rounded-lg object-cover border border-border shrink-0"
                />
                <div className="flex-1 min-w-0 flex items-center">
                  {analyzing && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" /> Анализируем...
                    </div>
                  )}
                  {photoError && !analyzing && (
                    <div className="flex items-start gap-1.5 text-sm text-destructive">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{photoError}</span>
                    </div>
                  )}
                  {photoResult && !analyzing && photoResult.confidence === 'low' && (
                    <p className="text-xs text-destructive">Низкая уверенность AI — проверьте цифры</p>
                  )}
                  {photoResult && !analyzing && photoResult.note && (
                    <p className="text-xs text-muted-foreground">{photoResult.note}</p>
                  )}
                </div>
              </div>
            )}

            {photoResult && !analyzing && (
              <div className="mt-3 space-y-2">
                <Input placeholder="Название" value={pName} onChange={(e) => setPName(e.target.value)} />
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <Input placeholder="Ккал" type="number" min="0" value={pCalories} onChange={(e) => setPCalories(e.target.value)} />
                    <p className="text-[10px] text-center text-muted-foreground mt-1">ккал</p>
                  </div>
                  <div>
                    <Input placeholder="Б" type="number" min="0" step="0.1" value={pProtein} onChange={(e) => setPProtein(e.target.value)} />
                    <p className="text-[10px] text-center text-muted-foreground mt-1">белки, г</p>
                  </div>
                  <div>
                    <Input placeholder="Ж" type="number" min="0" step="0.1" value={pFat} onChange={(e) => setPFat(e.target.value)} />
                    <p className="text-[10px] text-center text-muted-foreground mt-1">жиры, г</p>
                  </div>
                  <div>
                    <Input placeholder="У" type="number" min="0" step="0.1" value={pCarbs} onChange={(e) => setPCarbs(e.target.value)} />
                    <p className="text-[10px] text-center text-muted-foreground mt-1">углев., г</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="button" size="sm" onClick={handlePhotoAdd} className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground">
                    Добавить в список
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
                    Другое фото
                  </Button>
                </div>
              </div>
            )}

            {photoError && !analyzing && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="mt-2 w-full"
              >
                Попробовать снова
              </Button>
            )}
          </div>

          {/* Search */}
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <Search className="w-3 h-3" /> Поиск (Open Food Facts)
            </Label>
            <Input
              placeholder="Гречка, куриная грудка..."
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              className="mt-1"
              autoComplete="off"
            />
            {searching && <p className="text-xs text-muted-foreground mt-1">Ищем...</p>}
            {searchResults.length > 0 && (
              <div className="mt-2 border border-border rounded-lg overflow-hidden divide-y divide-border/60">
                {searchResults.map((p, i) => {
                  const n = p.nutriments;
                  const kcal = Math.round(n['energy-kcal_100g'] ?? 0);
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() =>
                        addToStaged({
                          emoji: '🔎',
                          name: p.product_name,
                          baseCalories: kcal,
                          baseProtein: Number(n.proteins_100g ?? 0),
                          baseFat: Number(n.fat_100g ?? 0),
                          baseCarbs: Number(n.carbohydrates_100g ?? 0),
                          quantity: 1,
                          unitLabel: '100 г',
                          mealType: defaultMealType,
                        })
                      }
                      className="w-full text-left px-3 py-2 hover:bg-muted/60 transition-colors"
                    >
                      <div className="font-medium text-sm truncate">{p.product_name}</div>
                      <div className="text-xs text-muted-foreground">{kcal} ккал / 100 г</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Uzbek presets */}
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <ChefHat className="w-3 h-3" /> Узбекская кухня
            </Label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {uzbekFoods.map((f) => (
                <button
                  key={f.name}
                  type="button"
                  onClick={() =>
                    addToStaged({
                      emoji: f.emoji,
                      name: f.name,
                      baseCalories: f.calories,
                      baseProtein: f.protein,
                      baseFat: f.fat,
                      baseCarbs: f.carbs,
                      quantity: 1,
                      unitLabel: f.portion,
                      mealType: f.mealType ?? defaultMealType,
                    })
                  }
                  className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-left hover:border-primary/40 hover:bg-primary/5 transition-colors"
                >
                  <span className="text-xl leading-none">{f.emoji}</span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium truncate">{f.name}</span>
                    <span className="block text-xs text-muted-foreground">{f.portion} · {f.calories} ккал</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Recent / frequent */}
          {quickFoods.length > 0 && (
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <Clock className="w-3 h-3" /> Недавние и частые
              </Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {quickFoods.map((f, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() =>
                      addToStaged({
                        emoji: '🍴',
                        name: f.name,
                        baseCalories: f.calories,
                        baseProtein: f.protein,
                        baseFat: f.fat,
                        baseCarbs: f.carbs,
                        quantity: 1,
                        unitLabel: 'порция',
                        mealType: (f.mealType as MealType) ?? defaultMealType,
                      })
                    }
                    className="text-xs bg-muted border border-border rounded-full px-3 py-1.5 hover:bg-primary/10 hover:border-primary/40 transition-colors truncate max-w-[180px]"
                  >
                    {f.name} <span className="text-muted-foreground">· {Math.round(f.calories)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Manual entry */}
          <div>
            <button
              type="button"
              onClick={() => setShowManual((v) => !v)}
              className="text-xs font-semibold text-primary flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> {showManual ? 'Скрыть свой продукт' : 'Добавить свой продукт вручную'}
            </button>
            {showManual && (
              <div className="mt-2 space-y-2 bg-muted/40 rounded-xl p-3">
                <p className="text-[11px] text-muted-foreground -mt-1">
                  Укажите калории и БЖУ на одну единицу/порцию — количество умножит автоматически
                </p>
                <div className="flex gap-2">
                  <Input
                    placeholder="Название (напр. Банан)"
                    value={mName}
                    onChange={(e) => setMName(e.target.value)}
                    className="flex-1 min-w-0"
                  />
                  <div className="w-20 shrink-0">
                    <Input
                      placeholder="1"
                      type="number"
                      min="0.1"
                      step="0.5"
                      value={mQuantity}
                      onChange={(e) => setMQuantity(e.target.value)}
                    />
                    <p className="text-[10px] text-center text-muted-foreground mt-1">кол-во</p>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <Input placeholder="Ккал" type="number" min="0" value={mCalories} onChange={(e) => setMCalories(e.target.value)} />
                    <p className="text-[10px] text-center text-muted-foreground mt-1">ккал/ед.</p>
                  </div>
                  <div>
                    <Input placeholder="Б" type="number" min="0" step="0.1" value={mProtein} onChange={(e) => setMProtein(e.target.value)} />
                    <p className="text-[10px] text-center text-muted-foreground mt-1">белки, г</p>
                  </div>
                  <div>
                    <Input placeholder="Ж" type="number" min="0" step="0.1" value={mFat} onChange={(e) => setMFat(e.target.value)} />
                    <p className="text-[10px] text-center text-muted-foreground mt-1">жиры, г</p>
                  </div>
                  <div>
                    <Input placeholder="У" type="number" min="0" step="0.1" value={mCarbs} onChange={(e) => setMCarbs(e.target.value)} />
                    <p className="text-[10px] text-center text-muted-foreground mt-1">углев., г</p>
                  </div>
                </div>
                {mCaloriesNum > 0 && mQuantityNum !== 1 && (
                  <p className="text-xs text-center text-primary bg-primary/10 rounded-md py-1.5">
                    Итого за {formatQty(mQuantityNum)}:{' '}
                    <span className="font-semibold">{Math.round(mCaloriesNum * mQuantityNum)} ккал</span>
                    {' · Б '}{((parseFloat(mProtein) || 0) * mQuantityNum).toFixed(0)}г
                    {' · Ж '}{((parseFloat(mFat) || 0) * mQuantityNum).toFixed(0)}г
                    {' · У '}{((parseFloat(mCarbs) || 0) * mQuantityNum).toFixed(0)}г
                  </p>
                )}
                <Button type="button" size="sm" variant="outline" onClick={handleManualAdd} className="w-full">
                  Добавить в список
                </Button>
              </div>
            )}
          </div>

          {/* Staged list */}
          {staged.length > 0 && (
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <ListPlus className="w-3 h-3" /> Выбрано ({staged.length})
              </Label>
              <div className="mt-2 space-y-1.5">
                {staged.map((s) => {
                  const cal = s.baseCalories * s.quantity;
                  const step = s.quantity >= 1 ? 1 : 0.5;
                  return (
                    <div
                      key={s.key}
                      className="bg-primary/5 border border-primary/20 rounded-lg px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm truncate flex items-center gap-1.5 min-w-0">
                          <span>{s.emoji}</span>
                          <span className="truncate">{s.name}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => removeStaged(s.key)}
                          className="text-muted-foreground hover:text-destructive shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => updateStagedQuantity(s.key, s.quantity - step)}
                            className="w-6 h-6 flex items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-primary/15 hover:text-primary shrink-0"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-xs font-medium tabular-nums whitespace-nowrap">
                            {formatQty(s.quantity)} × {s.unitLabel}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateStagedQuantity(s.key, s.quantity + step)}
                            className="w-6 h-6 flex items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-primary/15 hover:text-primary shrink-0"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {Math.round(cal)} ккал · {mealTypeLabels[s.mealType]}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Sticky footer: live sum + commit */}
        <div className="border-t border-[oklch(0.97_0.01_240)]/55 px-6 py-4 bg-[oklch(0.97_0.01_240)]/88 backdrop-blur-xl backdrop-saturate-150">
          {staged.length > 0 && (
            <div className="flex items-center justify-between text-sm mb-3">
              <span className="font-semibold text-foreground">🔥 {Math.round(totals.calories)} ккал</span>
              <span className="text-muted-foreground">
                Б {totals.protein.toFixed(0)}г · Ж {totals.fat.toFixed(0)}г · У {totals.carbs.toFixed(0)}г
              </span>
            </div>
          )}
          <div className="flex gap-3">
            <Button
              onClick={handleCommit}
              disabled={staged.length === 0 || submitting}
              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {submitting ? 'Добавляем...' : staged.length > 0 ? `Добавить (${staged.length})` : 'Добавить'}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Отмена
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
