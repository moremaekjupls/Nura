import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { ChevronRight } from 'lucide-react';
import type { Goal } from '@shared/nutrition';
import { api } from '@/lib/api';
import { todayISO } from '@/lib/dates';
import { errorText } from '@/lib/format';
import { useI18n, type Lang } from '@/lib/i18n';
import { useAuth } from '@/state/auth';
import { useLogWeight, useProfile, useSaveGoal, useSaveProfile } from '@/state/queries';
import { Segmented, Switch } from '@/ui/controls';
import { Sheet } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';
import { BodyFields, bodyValid, MacroSplit, toBody, useBodyForm, valuesFrom } from './BodyForm';
import type { Profile as ProfileData } from '@/lib/api';

export default function Profile() {
  const i18n = useI18n();
  const { t, num } = i18n;
  const toast = useToast();
  const { user, setUser, logout } = useAuth();
  const q = useProfile();
  const saveProfile = useSaveProfile();
  const [sheet, setSheet] = useState<null | 'body' | 'goal' | 'password' | 'delete'>(null);
  const fail = (e: unknown) => toast.show(errorText(e, i18n), { tone: 'error' });

  if (!q.data) {
    return (
      <main className="screen">
        <div className="head"><h1 className="large-title">{t('profile.title')}</h1></div>
        {q.isError ? <p className="error-text">{errorText(q.error, i18n)}</p> : <div className="skeleton" style={{ height: 320 }} />}
      </main>
    );
  }

  const { profile: p, goal } = q.data;
  const complete = bodyValid(toBody(valuesFrom(p)));
  const age = p.birthYear ? new Date().getFullYear() - p.birthYear : null;
  const display = p.name || p.email || 'Nura';

  const setLang = (lang: Lang) =>
    saveProfile.mutate({ lang }, { onSuccess: () => user && setUser({ ...user, lang }), onError: fail });

  const exportData = async () => {
    try {
      const data = await api<unknown>('/api/export');
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `nura-${todayISO()}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      fail(e);
    }
  };

  return (
    <main className="screen fade-in">
      <div className="head"><h1 className="large-title">{t('profile.title')}</h1></div>

      <section className="card row mb" style={{ minHeight: 76 }}>
        <div className="circ" style={{ width: 52, height: 52, background: 'var(--sage)', color: 'var(--on-pastel)', fontSize: 22, fontWeight: 600 }} aria-hidden>
          {display.charAt(0).toUpperCase()}
        </div>
        <div className="grow">
          <div style={{ fontSize: 19, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>{display}</div>
          {(p.telegram || (p.name && p.email)) && <div className="small muted">{p.telegram ? t('profile.viaTelegram') : p.email}</div>}
        </div>
      </section>

      <section className="card pad mb" aria-labelledby="goal-h">
        <h2 id="goal-h" className="cap">{t('profile.dailyGoal')}</h2>
        <div className="num" style={{ fontSize: 40, lineHeight: '46px', fontWeight: 700, marginTop: 4 }}>
          {num(goal.calories)} <span className="muted" style={{ fontSize: 20, fontWeight: 600 }}>{t('unit.kcal')}</span>
        </div>
        <div className="small muted">
          {goal.auto && complete ? t('profile.formula') : t('profile.manualNote')} · {t('profile.water')} {num(goal.water / 1000, 1)} {t('unit.l')}
        </div>
        <MacroSplit p={goal.protein} f={goal.fat} c={goal.carbs} />

        {complete && goal.auto && (
          <div className="stack" style={{ marginTop: 18 }}>
            <div className="field">
              <span>{t('profile.goalMode')}</span>
              <Segmented label={t('profile.goalMode')} value={p.goalMode} onChange={(goalMode) => saveProfile.mutate({ goalMode }, { onError: fail })}
                options={[{ id: 'lose', label: t('goal.lose') }, { id: 'keep', label: t('goal.keep') }, { id: 'gain', label: t('goal.gain') }]} />
            </div>
            <div className="field">
              <span>{t('profile.activity')}</span>
              <Segmented label={t('profile.activity')} value={p.activity} onChange={(activity) => saveProfile.mutate({ activity }, { onError: fail })}
                options={[{ id: 'low', label: t('act.low') }, { id: 'mid', label: t('act.mid') }, { id: 'high', label: t('act.high') }]} />
            </div>
          </div>
        )}
        <hr className="hairline" />
        {complete ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ flex: 1 }}>{t('profile.auto')}</span>
            <Switch label={t('profile.auto')} checked={goal.auto} onChange={(autoGoal) => saveProfile.mutate({ autoGoal }, { onError: fail })} />
          </div>
        ) : (
          <button className="btn block" onClick={() => setSheet('body')}>{t('profile.fill')}</button>
        )}
        {!goal.auto && (
          <button className="btn block secondary" style={{ marginTop: 12 }} onClick={() => setSheet('goal')}>{t('profile.editGoal')}</button>
        )}
      </section>

      {complete && (
        <>
          <div className="section-title"><h2>{t('profile.body')}</h2></div>
          <section className="card list mb-l">
            <div className="row"><span className="grow">{t('profile.gender')}</span><span className="value">{p.gender === 'male' ? t('profile.male') : t('profile.female')}</span></div>
            <div className="row"><span className="grow">{t('profile.birthYear')}</span><span className="value num">{p.birthYear} · {t('profile.years', { n: age ?? '' })}</span></div>
            <div className="row"><span className="grow">{t('profile.height')}</span><span className="value num">{num(p.heightCm ?? 0)} {t('unit.cm')}</span></div>
            <div className="row"><span className="grow">{t('profile.weight')}</span><span className="value num">{num(p.weightKg ?? 0, 1)} {t('unit.kg')}</span></div>
            <button className="row accent" onClick={() => setSheet('body')}>{t('profile.editBody')}</button>
          </section>
        </>
      )}

      <div className="section-title"><h2>{t('profile.settings')}</h2></div>
      <section className="card list mb">
        <div className="row">
          <span className="grow">{t('profile.language')}</span>
          <div style={{ width: 180 }}>
            <Segmented label={t('profile.language')} value={i18n.lang} onChange={setLang}
              options={[{ id: 'ru', label: 'Русский' }, { id: 'uz', label: 'Oʻzbekcha' }]} />
          </div>
        </div>
        <button className="row" onClick={exportData}><span className="grow">{t('profile.export')}</span><ChevronRight size={18} className="muted" aria-hidden /></button>
        {p.email && (
          <button className="row" onClick={() => setSheet('password')}><span className="grow">{t('profile.changePassword')}</span><ChevronRight size={18} className="muted" aria-hidden /></button>
        )}
        <Link href="/privacy" className="row" style={{ color: 'inherit', textDecoration: 'none' }}><span className="grow">{t('profile.privacy')}</span><ChevronRight size={18} className="muted" aria-hidden /></Link>
      </section>
      <section className="card list">
        {!p.telegram && <button className="row danger" onClick={logout}>{t('profile.logout')}</button>}
        <button className="row danger" onClick={() => setSheet('delete')}>{t('profile.deleteAccount')}</button>
      </section>

      <BodySheet open={sheet === 'body'} onClose={() => setSheet(null)} initial={p} />
      <GoalSheet open={sheet === 'goal'} onClose={() => setSheet(null)} goal={goal} />
      <PasswordSheet open={sheet === 'password'} onClose={() => setSheet(null)} hasPassword={!!user?.hasPassword} />
      <DeleteSheet open={sheet === 'delete'} onClose={() => setSheet(null)} />
    </main>
  );
}

function BodySheet({ open, onClose, initial }: { open: boolean; onClose(): void; initial: ProfileData }) {
  const i18n = useI18n();
  const { t } = i18n;
  const toast = useToast();
  const { refresh } = useAuth();
  const [v, set] = useBodyForm(initial);
  const save = useSaveProfile();
  const weight = useLogWeight();
  const body = toBody(v);
  const valid = bodyValid(body);

  useEffect(() => {
    if (open) set(valuesFrom(initial));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = async () => {
    if (!valid) return;
    try {
      const wasIncomplete = !bodyValid(toBody(valuesFrom(initial)));
      await save.mutateAsync({ ...body, ...(wasIncomplete ? { autoGoal: true } : {}) });
      if (body.weightKg !== initial.weightKg) await weight.mutateAsync({ date: todayISO(), kg: body.weightKg });
      await refresh();
      toast.show(t('profile.saved'));
      onClose();
    } catch (e) {
      toast.show(errorText(e, i18n), { tone: 'error' });
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={t('profile.body')}
      footer={<button className="btn block" disabled={!valid || save.isPending} onClick={submit}>{t('common.save')}</button>}>
      <BodyFields v={v} set={set} preview />
    </Sheet>
  );
}

function GoalSheet({ open, onClose, goal }: { open: boolean; onClose(): void; goal: Goal }) {
  const i18n = useI18n();
  const { t } = i18n;
  const toast = useToast();
  const save = useSaveGoal();
  const [f, setF] = useState({ calories: '', protein: '', fat: '', carbs: '', water: '' });
  useEffect(() => {
    if (open) setF({ calories: String(goal.calories), protein: String(goal.protein), fat: String(goal.fat), carbs: String(goal.carbs), water: String(goal.water) });
  }, [open, goal]);
  const n = (s: string) => Number(s.replace(',', '.'));
  const vals = { calories: n(f.calories), protein: n(f.protein), fat: n(f.fat), carbs: n(f.carbs), water: n(f.water) };
  const valid = vals.calories >= 800 && vals.calories <= 8000 && vals.water >= 500 && vals.water <= 6000 &&
    [vals.protein, vals.fat, vals.carbs].every((x) => Number.isFinite(x) && x >= 0);
  const input = (key: keyof typeof f, label: string) => (
    <label className="field">
      <span>{label}</span>
      <input className="input num" inputMode="numeric" value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })} />
    </label>
  );
  return (
    <Sheet open={open} onClose={onClose} title={t('profile.dailyGoal')} compact
      footer={<button className="btn block" disabled={!valid || save.isPending}
        onClick={() => save.mutate(vals, { onSuccess: onClose, onError: (e) => toast.show(errorText(e, i18n), { tone: 'error' }) })}>{t('common.save')}</button>}>
      <div className="grid2">
        {input('calories', `${t('add.calories')}, ${t('unit.kcal')}`)}
        {input('water', `${t('profile.water')}, ${t('unit.ml')}`)}
        {input('protein', `${t('macro.protein')}, ${t('unit.g')}`)}
        {input('fat', `${t('macro.fat')}, ${t('unit.g')}`)}
        {input('carbs', `${t('macro.carbs')}, ${t('unit.g')}`)}
      </div>
    </Sheet>
  );
}

function PasswordSheet({ open, onClose, hasPassword }: { open: boolean; onClose(): void; hasPassword: boolean }) {
  const i18n = useI18n();
  const { t } = i18n;
  const toast = useToast();
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!open) { setCur(''); setNext(''); } }, [open]);
  const submit = async () => {
    setBusy(true);
    try {
      await api('/api/auth/password', { method: 'POST', body: { current: cur, next } });
      toast.show(t('profile.passwordChanged'));
      onClose();
    } catch (e) {
      toast.show(errorText(e, i18n), { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title={t('profile.changePassword')} compact
      footer={<button className="btn block" disabled={next.length < 8 || busy} onClick={submit}>{t('common.save')}</button>}>
      <div className="stack">
        {hasPassword && (
          <label className="field"><span>{t('profile.currentPassword')}</span>
            <input className="input" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} /></label>
        )}
        <label className="field"><span>{t('profile.newPassword')}</span>
          <input className="input" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} /></label>
        <span className="small muted">{t('auth.passwordHint')}</span>
      </div>
    </Sheet>
  );
}

function DeleteSheet({ open, onClose }: { open: boolean; onClose(): void }) {
  const i18n = useI18n();
  const { t } = i18n;
  const toast = useToast();
  const { logout } = useAuth();
  const [busy, setBusy] = useState(false);
  const del = async () => {
    setBusy(true);
    try {
      await api('/api/account', { method: 'DELETE' });
      await logout();
    } catch (e) {
      toast.show(errorText(e, i18n), { tone: 'error' });
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title={t('profile.deleteAccount')} compact
      footer={
        <div className="stack" style={{ gap: 10 }}>
          <button className="btn block danger" disabled={busy} onClick={del}>{t('profile.deleteForever')}</button>
          <button className="btn block secondary" onClick={onClose}>{t('common.cancel')}</button>
        </div>
      }>
      <p style={{ margin: '4px 4px 8px', fontSize: 16, lineHeight: 1.45 }}>{t('profile.deleteConfirm')}</p>
    </Sheet>
  );
}
