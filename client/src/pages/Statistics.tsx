/**
 * Statistics page
 * Third bottom-nav tab. Aggregates the last 7 days (via /api/history) into:
 *  - WeeklyRings: avg daily calories/protein/fat/carbs as concentric rings
 *    (Apple-Watch-style), same colour mapping as MacroTile elsewhere.
 *  - a small water ring (avg ml/day vs goal).
 *  - a day-by-day calorie bar list so the weekly *trend* is visible too,
 *    not just a single blended average.
 *
 * Module-level cache (historyCache) follows the same pattern as
 * Profile.tsx's profileCache — this page unmounts on every tab switch, so
 * caching the last fetch avoids a flash of "Пока нет данных" before the
 * background refetch resolves.
 */

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { WeeklyRings } from '@/components/WeeklyRings';
import * as storageService from '@/lib/storageService';
import { DailySummary } from '@/types';
import { getTodayISO, addDaysToISO, getShortDayName, formatDate } from '@/lib/dateUtils';
import { GLASS_CARD } from '@/lib/glass';
import { cn } from '@/lib/utils';
import { Loader2, Droplets, BarChart3 } from 'lucide-react';

let historyCache: DailySummary[] | null = null;

export default function Statistics() {
  const [history, setHistory] = useState<DailySummary[] | null>(historyCache);
  const [loading, setLoading] = useState(!historyCache);

  useEffect(() => {
    const today = getTodayISO();
    const from = addDaysToISO(today, -6);
    let active = true;
    storageService
      .getHistory(from, today)
      .then((data) => {
        if (!active) return;
        historyCache = data;
        setHistory(data);
      })
      .catch((err) => console.error('Error loading history:', err))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const header = (
    <header className="sticky top-0 z-40 bg-[oklch(0.97_0.01_240)]/82 backdrop-blur-xl backdrop-saturate-150 border-b border-[oklch(0.97_0.01_240)]/45">
      <div
        className="container app-shell py-4"
        style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}
      >
        <h1 className="text-2xl font-display font-bold text-primary flex items-center gap-2">
          <BarChart3 className="w-6 h-6" /> Статистика
        </h1>
        {history && history.length > 0 && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatDate(history[0].date)} – {formatDate(history[history.length - 1].date)}
          </p>
        )}
      </div>
    </header>
  );

  if (loading && !history) {
    return (
      <div className="min-h-screen pb-24">
        {header}
        <main className="container app-shell py-6 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className="min-h-screen pb-24">
        {header}
        <main className="container app-shell py-6">
          <Card className={cn('p-6 text-center text-sm text-muted-foreground', GLASS_CARD)}>
            Пока нет данных за неделю — добавьте пару приёмов пищи и загляните сюда снова
          </Card>
        </main>
      </div>
    );
  }

  const n = history.length;
  const sum = (sel: (d: DailySummary) => number) => history.reduce((a, d) => a + sel(d), 0);
  const avgCalories = sum((d) => d.totals.calories) / n;
  const avgProtein = sum((d) => d.totals.protein) / n;
  const avgFat = sum((d) => d.totals.fat) / n;
  const avgCarbs = sum((d) => d.totals.carbs) / n;
  const avgWater = sum((d) => d.water.consumed) / n;

  const latest = history[history.length - 1];
  const goal = latest.goal;
  const waterGoal = latest.water.goal;
  const waterPct = waterGoal > 0 ? Math.round((avgWater / waterGoal) * 100) : 0;
  const waterClamped = Math.min(100, Math.max(0, waterPct));

  const RING_R = 32;
  const RING_C = 2 * Math.PI * RING_R;
  const waterOffset = RING_C - (waterClamped / 100) * RING_C;

  const metrics = [
    { avg: avgCalories, goal: goal.calories, label: 'Калории', color: 'var(--chart-1)', unit: '' },
    { avg: avgProtein, goal: goal.protein, label: 'Белки', color: 'var(--secondary)', unit: 'г' },
    { avg: avgFat, goal: goal.fat, label: 'Жиры', color: 'var(--chart-3)', unit: 'г' },
    { avg: avgCarbs, goal: goal.carbs, label: 'Углеводы', color: 'var(--chart-2)', unit: 'г' },
  ];

  const maxDayCalories = Math.max(...history.map((d) => d.totals.calories), goal.calories, 1);

  return (
    <div className="min-h-screen pb-24">
      {header}
      <main className="container app-shell py-6 space-y-4">
        <Card className={cn('p-5 border', GLASS_CARD)}>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">
            Среднее в день · калории и БЖУ
          </p>
          <WeeklyRings metrics={metrics} />
        </Card>

        <Card className={cn('p-5 border', GLASS_CARD)}>
          <div className="flex items-center gap-4">
            <div className="relative shrink-0" style={{ width: 76, height: 76 }}>
              <svg width={76} height={76} viewBox="0 0 76 76" className="-rotate-90">
                <circle cx={38} cy={38} r={RING_R} fill="none" stroke="var(--muted)" strokeWidth={10} />
                <circle
                  cx={38}
                  cy={38}
                  r={RING_R}
                  fill="none"
                  stroke="var(--chart-5)"
                  strokeWidth={10}
                  strokeLinecap="round"
                  strokeDasharray={RING_C}
                  strokeDashoffset={waterOffset}
                  style={{ transition: 'stroke-dashoffset 0.7s ease-out' }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <Droplets className="w-6 h-6" style={{ color: 'var(--chart-5)' }} />
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Вода — среднее в день
              </p>
              <p className="text-xl font-display font-bold text-foreground mt-1">
                {Math.round(avgWater)}
                <span className="text-sm font-normal text-muted-foreground"> / {waterGoal} мл · {waterPct}%</span>
              </p>
            </div>
          </div>
        </Card>

        <Card className={cn('p-5 border', GLASS_CARD)}>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">По дням</p>
          <div className="space-y-2.5">
            {history.map((d) => {
              const pct = Math.min(100, Math.round((d.totals.calories / maxDayCalories) * 100));
              const over = d.totals.calories > d.goal.calories;
              return (
                <div key={d.date} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-9 shrink-0 capitalize">
                    {getShortDayName(d.date)}
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: over ? 'var(--destructive)' : 'var(--chart-1)',
                      }}
                    />
                  </div>
                  <span className="text-xs text-foreground font-medium w-16 text-right shrink-0 tabular-nums">
                    {Math.round(d.totals.calories)} ккал
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      </main>
    </div>
  );
}
