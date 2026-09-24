import { useState } from 'react';
import { ChevronLeft, ChevronRight, Minus, Plus, UserRound } from 'lucide-react';
import { Link } from 'wouter';
import { MEAL_TYPES, type MealType } from '@shared/nutrition';
import { addDays, todayISO, weekStart } from '@/lib/dates';
import { cap, useI18n } from '@/lib/i18n';
import { errorText } from '@/lib/format';
import type { Entry } from '@/lib/api';
import { haptic } from '@/lib/telegram';
import { useAuth } from '@/state/auth';
import { useAddEntries, useDay, useDeleteEntry, useHistory, useWater } from '@/state/queries';
import { useToast } from '@/ui/Toast';
import { Ring } from '@/ui/controls';
import EntrySheet from './EntrySheet';

const CUP = 250;

export default function Today({ date, setDate, onAdd }: { date: string; setDate(d: string): void; onAdd(meal?: MealType): void }) {
  const i18n = useI18n();
  const { t, num } = i18n;
  const { user } = useAuth();
  const toast = useToast();
  const today = todayISO();
  const day = useDay(date);
  const [editing, setEditing] = useState(false);
  const [openEntry, setOpenEntry] = useState<Entry | null>(null);
  const del = useDeleteEntry();
  const add = useAddEntries();
  const water = useWater(date);

  const title =
    date === today ? t('today.title') : date === addDays(today, -1) ? t('today.yesterday') : cap(i18n.date(date, { weekday: 'long' }));
  const subtitle = i18n.date(date, { weekday: date === today || date === addDays(today, -1) ? 'long' : undefined, day: 'numeric', month: 'long' });

  const remove = (e: Entry) => {
    del.mutate(e, {
      onSuccess: () =>
        toast.show(t('today.deleted', { name: e.name }), {
          undo: () => {
            const { id: _id, ...rest } = e;
            add.mutate([rest], { onError: (err) => toast.show(errorText(err, i18n), { tone: 'error' }) });
          },
        }),
      onError: (err) => toast.show(errorText(err, i18n), { tone: 'error' }),
    });
  };

  return (
    <main className="screen fade-in">
      <div className="head">
        <div>
          <div className="cap">{subtitle}</div>
          <h1 className="large-title">{title}</h1>
        </div>
        {!!day.data?.entries.length && (
          <button className="pill-btn glass" onClick={() => setEditing((v) => !v)}>
            {editing ? t('common.done') : t('common.edit')}
          </button>
        )}
      </div>

      <WeekStrip date={date} setDate={setDate} />

      {user && !user.profileComplete && (
        <Link href="/profile" className="banner mb" style={{ textDecoration: 'none' }}>
          <UserRound size={22} aria-hidden />
          <span>{t('today.banner')}</span>
        </Link>
      )}

      {day.isError && !day.data ? (
        <div className="card pad mb">
          <p className="error-text" style={{ marginTop: 0 }}>{errorText(day.error, i18n)}</p>
          <button className="btn small secondary" onClick={() => day.refetch()}>{t('common.retry')}</button>
        </div>
      ) : !day.data ? (
        <>
          <div className="skeleton mb" style={{ height: 360 }} />
          <div className="skeleton mb-l" style={{ height: 110 }} />
        </>
      ) : (
        <>
          {renderSummary()}
          {renderWater()}
          {MEAL_TYPES.map((m) => {
            const items = day.data.entries.filter((e) => e.mealType === m);
            const kcal = items.reduce((a, e) => a + e.calories, 0);
            return (
              <section key={m} className="mb-l" aria-labelledby={`meal-${m}`}>
                <div className="section-title">
                  <h2 id={`meal-${m}`}>{t(`meal.${m}`)}</h2>
                  {items.length > 0 && <span className="num muted" style={{ fontSize: 15 }}>{num(kcal)} {t('unit.kcal')}</span>}
                </div>
                <div className="card list">
                  {items.map((e) => (
                    <div key={e.id} className="row fade-in">
                      {editing && (
                        <button className="circ del-btn" onClick={() => remove(e)} aria-label={`${t('common.delete')}: ${e.name}`}>
                          <Minus size={16} strokeWidth={2.6} />
                        </button>
                      )}
                      <button className="grow" style={{ textAlign: 'left', minWidth: 0 }} onClick={() => setOpenEntry(e)}>
                        <div className="title">{e.name}</div>
                        {(e.portion || e.time) && <div className="sub">{[e.portion, e.time].filter(Boolean).join(' · ')}</div>}
                      </button>
                      <span className="num" style={{ fontSize: 17, fontWeight: 500 }}>{num(e.calories)}</span>
                    </div>
                  ))}
                  <button className="row accent" onClick={() => onAdd(m)}>
                    <Plus size={20} strokeWidth={2.2} aria-hidden />
                    <span>{cap(t('meal.addRow', { meal: t(`mealLower.${m}`) }))}</span>
                  </button>
                </div>
              </section>
            );
          })}
        </>
      )}

      <EntrySheet entry={openEntry} onClose={() => setOpenEntry(null)} onDelete={(e) => { setOpenEntry(null); remove(e); }} />
    </main>
  );

  function renderSummary() {
    const d = day.data!;
    const g = d.goal;
    const rem = g.calories - d.totals.calories;
    const macros = [
      { label: t('macro.protein'), cur: d.totals.protein, goal: g.protein, color: 'var(--lavender)' },
      { label: t('macro.fat'), cur: d.totals.fat, goal: g.fat, color: 'var(--butter)' },
      { label: t('macro.carbs'), cur: d.totals.carbs, goal: g.carbs, color: 'var(--rose)' },
    ];
    return (
      <section className="card mb" style={{ padding: '22px 20px 20px' }} aria-label={t('unit.kcal')}>
        <div className="ring-wrap">
          <Ring size={196} stroke={16} value={d.totals.calories / g.calories} color="var(--apricot)" />
          <div className="ring-center">
            <span className="big num">{num(Math.abs(rem))}</span>
            <span className="muted" style={{ fontSize: 15 }}>{rem >= 0 ? t('today.left') : t('today.over')}</span>
          </div>
        </div>
        <div className="ring-meta">
          <span>{t('today.eaten')} <b className="num">{num(d.totals.calories)}</b></span>
          <span>{t('today.goal')} <b className="num">{num(g.calories)}</b></span>
        </div>
        <hr className="hairline" />
        <div className="grid3">
          {macros.map((m) => (
            <div key={m.label} className="macro">
              <div className="small muted">{m.label}</div>
              <div className="v num">{num(m.cur)} <span>/ {num(m.goal)} {t('unit.g')}</span></div>
              <div className="bar"><div style={{ width: `${Math.min(100, (m.cur / Math.max(1, m.goal)) * 100)}%`, background: m.color }} /></div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  function liters(ml: number) {
    const l = Math.round(ml / 10) / 100;
    return num(l, l % 1 === 0 ? 0 : Math.round(l * 100) % 10 === 0 ? 1 : 2);
  }

  /** In-app version of the water reminder: behind the 08:00–21:00 pace by more than a glass. */
  function nudge() {
    const d = day.data!;
    if (date !== today) return null;
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    const expected = d.goal.water * Math.min(1, Math.max(0, (minutes - 480) / (1260 - 480)));
    if (d.water.total >= expected - CUP || d.water.total >= d.goal.water) return null;
    return (
      <p className="small fade-in" style={{ margin: '-4px 0 12px', color: 'var(--ink2)' }}>
        {t('today.waterNudge', { x: liters(Math.round(expected / CUP) * CUP) })}
      </p>
    );
  }

  function renderWater() {
    const d = day.data!;
    const cups = Math.min(16, Math.max(4, Math.ceil(d.goal.water / CUP)));
    const filled = Math.floor(d.water.total / CUP);
    const tap = (i: number) => {
      haptic('select');
      if (i < filled) {
        const last = d.water.logs[d.water.logs.length - 1];
        if (last && last.id !== 'pending') water.undo.mutate(last.id, { onError: (e) => toast.show(errorText(e, i18n), { tone: 'error' }) });
      } else {
        water.add.mutate((i + 1) * CUP - d.water.total, { onError: (e) => toast.show(errorText(e, i18n), { tone: 'error' }) });
      }
    };
    return (
      <section className="card mb-l" style={{ padding: 16 }} aria-labelledby="water-h">
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 id="water-h" style={{ fontSize: 17, fontWeight: 600 }}>{t('today.water')}</h2>
          <span className="num muted" style={{ fontSize: 15 }}>
            {t('today.waterOf', { a: liters(d.water.total), b: liters(d.goal.water) })}
          </span>
        </div>
        {nudge()}
        <div className="cups" style={{ gridTemplateColumns: `repeat(${Math.min(cups, 8)}, minmax(0, 1fr))` }}>
          {Array.from({ length: cups }, (_, i) => (
            <button key={i} className="cup" aria-pressed={i < filled} aria-label={t('today.cup', { n: i + 1 })} onClick={() => tap(i)} />
          ))}
        </div>
      </section>
    );
  }
}

function WeekStrip({ date, setDate }: { date: string; setDate(d: string): void }) {
  const i18n = useI18n();
  const { t } = i18n;
  const today = todayISO();
  const start = weekStart(date);
  const end = addDays(start, 6);
  const hist = useHistory(start, end);
  const goal = hist.data?.goal.calories ?? 2000;
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return (
    <div className="week">
      <button className="arrow" onClick={() => setDate(addDays(date, -7))} aria-label={t('today.prevWeek')}>
        <ChevronLeft size={20} />
      </button>
      {days.map((d) => {
        const kcal = hist.data?.days.find((x) => x.date === d)?.calories ?? 0;
        const future = d > today;
        return (
          <button
            key={d}
            className="day-btn"
            disabled={future}
            aria-pressed={d === date}
            aria-current={d === today ? 'date' : undefined}
            aria-label={i18n.date(d, { weekday: 'long', day: 'numeric', month: 'long' })}
            onClick={() => setDate(d)}
          >
            <span className="dow">{cap(i18n.date(d, { weekday: 'short' })).replace('.', '').slice(0, 2)}</span>
            <span className="dial">
              <Ring size={36} stroke={3} value={kcal / goal} color="var(--apricot)" />
              <span className="num">{Number(d.slice(8))}</span>
            </span>
          </button>
        );
      })}
      <button className="arrow" onClick={() => setDate(addDays(date, 7) > today ? today : addDays(date, 7))} disabled={end >= today} aria-label={t('today.nextWeek')}>
        <ChevronRight size={20} />
      </button>
    </div>
  );
}
