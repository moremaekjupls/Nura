import { useEffect, useState } from 'react';
import { MEAL_TYPES, type MealType } from '@shared/nutrition';
import type { Entry } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { errorText } from '@/lib/format';
import { useUpdateEntry } from '@/state/queries';
import { Sheet } from '@/ui/Sheet';
import { Segmented } from '@/ui/controls';
import { useToast } from '@/ui/Toast';

const toNum = (s: string) => Number(s.replace(',', '.'));

export default function EntrySheet({ entry, onClose, onDelete }: { entry: Entry | null; onClose(): void; onDelete(e: Entry): void }) {
  const i18n = useI18n();
  const { t } = i18n;
  const toast = useToast();
  const update = useUpdateEntry();
  const [f, setF] = useState({ name: '', portion: '', calories: '', protein: '', fat: '', carbs: '', mealType: 'snack' as MealType });

  useEffect(() => {
    if (entry)
      setF({
        name: entry.name, portion: entry.portion ?? '', calories: String(entry.calories), protein: String(entry.protein),
        fat: String(entry.fat), carbs: String(entry.carbs), mealType: entry.mealType,
      });
  }, [entry]);

  const nums = [f.calories, f.protein, f.fat, f.carbs].map(toNum);
  const valid = f.name.trim() && nums.every((n) => Number.isFinite(n) && n >= 0);

  const save = () => {
    if (!entry || !valid) return;
    update.mutate(
      {
        id: entry.id,
        patch: { name: f.name.trim(), portion: f.portion.trim() || null, calories: nums[0], protein: nums[1], fat: nums[2], carbs: nums[3], mealType: f.mealType },
      },
      { onSuccess: onClose, onError: (e) => toast.show(errorText(e, i18n), { tone: 'error' }) },
    );
  };

  const field = (key: 'calories' | 'protein' | 'fat' | 'carbs', label: string) => (
    <label className="field">
      <span>{label}</span>
      <input className="input num" inputMode="decimal" value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })} />
    </label>
  );

  return (
    <Sheet
      open={!!entry}
      onClose={onClose}
      title={t('entry.title')}
      compact
      footer={
        <div className="stack" style={{ gap: 10 }}>
          <button className="btn block" disabled={!valid || update.isPending} onClick={save}>{t('common.save')}</button>
          <button className="btn block secondary" style={{ color: 'var(--danger)' }} onClick={() => entry && onDelete(entry)}>
            {t('common.delete')}
          </button>
        </div>
      }
    >
      <div className="stack">
        <label className="field">
          <span>{t('add.name')}</span>
          <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={120} />
        </label>
        <label className="field">
          <span>{t('add.portion')}</span>
          <input className="input" value={f.portion} onChange={(e) => setF({ ...f, portion: e.target.value })} maxLength={60} />
        </label>
        <div className="grid2">
          {field('calories', `${t('add.calories')}, ${t('unit.kcal')}`)}
          {field('protein', `${t('macro.protein')}, ${t('unit.g')}`)}
          {field('fat', `${t('macro.fat')}, ${t('unit.g')}`)}
          {field('carbs', `${t('macro.carbs')}, ${t('unit.g')}`)}
        </div>
        <div className="field">
          <span>{t('entry.meal')}</span>
          <Segmented
            label={t('entry.meal')}
            value={f.mealType}
            onChange={(mealType) => setF({ ...f, mealType })}
            options={MEAL_TYPES.map((m) => ({ id: m, label: t(`meal.${m}`) }))}
          />
        </div>
      </div>
    </Sheet>
  );
}
