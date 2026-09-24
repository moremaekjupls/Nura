import { useState } from 'react';
import { addDays, todayISO } from '@/lib/dates';
import { cap, useI18n } from '@/lib/i18n';
import { errorText } from '@/lib/format';
import { useHistory, useLogWeight, useProfile, useWeights } from '@/state/queries';
import { Stepper } from '@/ui/controls';
import { useToast } from '@/ui/Toast';

export default function Progress() {
  const i18n = useI18n();
  const { t, num } = i18n;
  const today = todayISO();
  const hist = useHistory(addDays(today, -59), today);
  const days = hist.data?.days ?? [];
  const goal = hist.data?.goal.calories ?? 2000;
  const last7 = days.slice(-7);

  const logged = last7.filter((d) => d.entries > 0 && d.date !== today);
  const avg = logged.length ? logged.reduce((a, d) => a + d.calories, 0) / logged.length : 0;
  const waterAvg = last7.length ? last7.reduce((a, d) => a + d.water, 0) / last7.length / 1000 : 0;

  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].entries > 0) streak++;
    else if (days[i].date === today) continue; // today not logged yet doesn't break the streak
    else break;
  }

  const scale = Math.max(goal * 1.25, ...last7.map((d) => d.calories), 1);

  return (
    <main className="screen fade-in">
      <div className="head"><h1 className="large-title">{t('progress.title')}</h1></div>

      <WeightCard />

      <section className="card pad mb" aria-labelledby="cal7">
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <h2 id="cal7" className="cap">{t('progress.cal7')}</h2>
          {avg > 0 && <span className="small muted">{t('progress.avg')} <b className="num" style={{ color: 'var(--ink)' }}>{num(avg)}</b></span>}
        </div>
        {hist.isError ? (
          <p className="error-text">{errorText(hist.error, i18n)}</p>
        ) : (
          <>
            <div className="bars" role="img" aria-label={last7.map((d) => `${i18n.date(d.date, { weekday: 'short' })}: ${d.calories}`).join(', ')}>
              <div className="goal-line" style={{ top: 132 - (goal / scale) * 120 }} />
              <div className="cols">
                {last7.map((d) => (
                  <div key={d.date} style={{ height: (d.calories / scale) * 120, background: d.date === today ? 'var(--apricot)' : 'var(--butter)' }} />
                ))}
              </div>
            </div>
            <div className="bars-labels">
              {last7.map((d) => (
                <span key={d.date} style={{ fontWeight: d.date === today ? 700 : 500 }}>{cap(i18n.date(d.date, { weekday: 'short' })).replace('.', '').slice(0, 2)}</span>
              ))}
            </div>
          </>
        )}
      </section>

      <div className="grid2">
        <section className="card" style={{ padding: 16 }}>
          <div className="cap">{t('progress.streak')}</div>
          <div className="num" style={{ fontSize: 30, fontWeight: 700, marginTop: 4 }}>{streak} <span className="muted" style={{ fontSize: 15, fontWeight: 500 }}>{t('progress.days')}</span></div>
          <div className="small muted">{t('progress.streakSub')}</div>
        </section>
        <section className="card" style={{ padding: 16 }}>
          <div className="cap">{t('today.water')}</div>
          <div className="num" style={{ fontSize: 30, fontWeight: 700, marginTop: 4 }}>{num(waterAvg, 1)} <span className="muted" style={{ fontSize: 15, fontWeight: 500 }}>{t('progress.waterAvg')}</span></div>
          <div className="small muted">{t('progress.waterSub')}</div>
        </section>
      </div>
    </main>
  );
}

function WeightCard() {
  const i18n = useI18n();
  const { t, num } = i18n;
  const toast = useToast();
  const weights = useWeights();
  const profile = useProfile();
  const log = useLogWeight();
  const since = addDays(todayISO(), -90);
  const pts = (weights.data ?? []).filter((w) => w.date >= since);
  const latest = weights.data?.[weights.data.length - 1]?.kg ?? profile.data?.profile.weightKg ?? null;
  const [draft, setDraft] = useState<number | null>(null);
  const value = draft ?? latest ?? 70;

  const W = 320, H = 120, P = 8;
  let path = '';
  let dots: { x: number; y: number }[] = [];
  if (pts.length >= 2) {
    const lo = Math.min(...pts.map((p) => p.kg)) - 0.4;
    const hi = Math.max(...pts.map((p) => p.kg)) + 0.4;
    const t0 = new Date(pts[0].date).getTime();
    const t1 = new Date(pts[pts.length - 1].date).getTime() || t0 + 1;
    dots = pts.map((p) => ({
      x: P + ((new Date(p.date).getTime() - t0) / Math.max(1, t1 - t0)) * (W - 2 * P),
      y: P + ((hi - p.kg) / (hi - lo)) * (H - 2 * P),
    }));
    path = dots.map((d, i) => `${i ? 'L' : 'M'}${d.x.toFixed(1)},${d.y.toFixed(1)}`).join(' ');
  }
  const delta = pts.length >= 2 ? pts[pts.length - 1].kg - pts[0].kg : null;

  const save = () =>
    log.mutate(
      { date: todayISO(), kg: value },
      {
        onSuccess: () => {
          setDraft(null);
          toast.show(t('progress.weightSaved', { kg: num(value, 1) }));
        },
        onError: (e) => toast.show(errorText(e, i18n), { tone: 'error' }),
      },
    );

  return (
    <section className="card pad mb" aria-labelledby="weight-h">
      <h2 id="weight-h" className="cap">{t('progress.weight')}</h2>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, margin: '4px 0 12px' }}>
        <span className="num" style={{ fontSize: 40, lineHeight: '46px', fontWeight: 700 }}>
          {latest != null ? num(latest, 1) : '—'} <span className="muted" style={{ fontSize: 20, fontWeight: 600 }}>{t('unit.kg')}</span>
        </span>
        {delta != null && (
          <span className="delta num">
            {delta <= 0 ? '−' : '+'}{num(Math.abs(delta), 1)} {t('unit.kg')} · {t('progress.since', { date: i18n.date(pts[0].date, { day: 'numeric', month: 'short' }) })}
          </span>
        )}
      </div>
      {pts.length >= 2 ? (
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', overflow: 'visible' }} aria-hidden>
          <line x1="0" y1={H - 0.5} x2={W} y2={H - 0.5} stroke="var(--hair)" />
          <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {dots.map((d, i) => (
            <circle key={i} cx={d.x} cy={d.y} r={i === dots.length - 1 ? 5 : 3} fill="var(--card)" stroke="var(--accent)" strokeWidth="2.5" />
          ))}
        </svg>
      ) : (
        <p className="muted small" style={{ margin: '4px 0 0' }}>{t('progress.weightEmpty')}</p>
      )}
      <hr className="hairline" />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}>
        <Stepper
          value={`${num(value, 1)} ${t('unit.kg')}`}
          onDec={() => setDraft(Math.round((value - 0.1) * 10) / 10)}
          onInc={() => setDraft(Math.round((value + 0.1) * 10) / 10)}
          decLabel={t('progress.dec')}
          incLabel={t('progress.inc')}
        />
        <button className="btn small" onClick={save} disabled={log.isPending}>{t('progress.record')}</button>
      </div>
    </section>
  );
}
