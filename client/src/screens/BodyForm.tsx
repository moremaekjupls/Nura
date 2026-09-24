import { useState } from 'react';
import { calcGoal, isBodyProfileComplete, type Activity, type BodyProfile, type Gender, type GoalMode } from '@shared/nutrition';
import { useI18n } from '@/lib/i18n';
import { Segmented } from '@/ui/controls';

export interface BodyValues {
  gender: Gender | null;
  birthYear: string;
  heightCm: string;
  weightKg: string;
  activity: Activity | null;
  goalMode: GoalMode | null;
}

export function toBody(v: BodyValues): Partial<BodyProfile> {
  const n = (s: string) => (s.trim() ? Number(s.replace(',', '.')) : undefined);
  return {
    gender: v.gender ?? undefined, birthYear: n(v.birthYear), heightCm: n(v.heightCm), weightKg: n(v.weightKg),
    activity: v.activity ?? undefined, goalMode: v.goalMode ?? undefined,
  };
}

/** Same bounds as the server schema, so the form never submits what the API rejects. */
export function bodyValid(b: Partial<BodyProfile>): b is BodyProfile {
  const y = new Date().getFullYear();
  return (
    isBodyProfileComplete(b) &&
    b.birthYear >= 1920 && b.birthYear <= y - 10 && Number.isInteger(b.birthYear) &&
    b.heightCm >= 100 && b.heightCm <= 250 &&
    b.weightKg >= 30 && b.weightKg <= 300
  );
}

type BodyLike = { [K in keyof BodyProfile]?: BodyProfile[K] | null };

export function valuesFrom(initial: BodyLike): BodyValues {
  return {
    gender: initial.gender ?? null,
    birthYear: initial.birthYear ? String(initial.birthYear) : '',
    heightCm: initial.heightCm ? String(initial.heightCm) : '',
    weightKg: initial.weightKg ? String(initial.weightKg) : '',
    activity: initial.activity ?? 'mid',
    goalMode: initial.goalMode ?? null,
  };
}

export function useBodyForm(initial: BodyLike) {
  return useState<BodyValues>(() => valuesFrom(initial));
}

export function BodyFields({ v, set, preview }: { v: BodyValues; set(v: BodyValues): void; preview?: boolean }) {
  const { t, num } = useI18n();
  const body = toBody(v);
  const goal = bodyValid(body) ? calcGoal(body) : null;
  const numField = (key: 'birthYear' | 'heightCm' | 'weightKg', label: string, ph: string) => (
    <label className="field">
      <span>{label}</span>
      <input className="input num" inputMode={key === 'weightKg' ? 'decimal' : 'numeric'} placeholder={ph} value={v[key]} onChange={(e) => set({ ...v, [key]: e.target.value })} />
    </label>
  );
  const hint = { low: t('act.lowHint'), mid: t('act.midHint'), high: t('act.highHint') }[v.activity ?? 'mid'];

  return (
    <div className="stack">
      <div className="field">
        <span>{t('profile.gender')}</span>
        <Segmented label={t('profile.gender')} value={v.gender} onChange={(gender) => set({ ...v, gender })}
          options={[{ id: 'female', label: t('profile.female') }, { id: 'male', label: t('profile.male') }]} />
      </div>
      <div className="grid3">
        {numField('birthYear', t('profile.birthYear'), '1995')}
        {numField('heightCm', `${t('profile.height')}, ${t('unit.cm')}`, '165')}
        {numField('weightKg', `${t('profile.weight')}, ${t('unit.kg')}`, '64')}
      </div>
      <div className="field">
        <span>{t('profile.activity')}</span>
        <Segmented label={t('profile.activity')} value={v.activity} onChange={(activity) => set({ ...v, activity })}
          options={[{ id: 'low', label: t('act.low') }, { id: 'mid', label: t('act.mid') }, { id: 'high', label: t('act.high') }]} />
        <span style={{ fontWeight: 400 }}>{hint}</span>
      </div>
      <div className="field">
        <span>{t('profile.goalMode')}</span>
        <Segmented label={t('profile.goalMode')} value={v.goalMode} onChange={(goalMode) => set({ ...v, goalMode })}
          options={[{ id: 'lose', label: t('goal.lose') }, { id: 'keep', label: t('goal.keep') }, { id: 'gain', label: t('goal.gain') }]} />
      </div>
      {preview && goal && (
        <div className="card pad fade-in">
          <div className="cap">{t('onb.result')}</div>
          <div className="num" style={{ fontSize: 40, lineHeight: '46px', fontWeight: 700, marginTop: 4 }}>
            {num(goal.calories)} <span className="muted" style={{ fontSize: 20, fontWeight: 600 }}>{t('unit.kcal')}</span>
          </div>
          <MacroSplit p={goal.protein} f={goal.fat} c={goal.carbs} />
        </div>
      )}
    </div>
  );
}

export function MacroSplit({ p, f, c }: { p: number; f: number; c: number }) {
  const { t, num } = useI18n();
  const items = [
    { label: t('macro.protein'), v: p, color: 'var(--lavender)' },
    { label: t('macro.fat'), v: f, color: 'var(--butter)' },
    { label: t('macro.carbs'), v: c, color: 'var(--rose)' },
  ];
  return (
    <div className="grid3" style={{ gap: 8, marginTop: 14 }}>
      {items.map((m) => (
        <div key={m.label} style={{ padding: '10px 12px', borderRadius: 16, background: 'var(--fill)' }}>
          <div className="small muted" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: m.color, flexShrink: 0 }} />{m.label}
          </div>
          <div className="num" style={{ fontSize: 20, fontWeight: 600, marginTop: 2 }}>{num(m.v)} {t('unit.g')}</div>
        </div>
      ))}
    </div>
  );
}
