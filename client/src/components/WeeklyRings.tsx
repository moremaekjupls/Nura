/**
 * WeeklyRings Component
 * Apple-Watch-style concentric activity rings summarising the last 7 days:
 * average daily calories/protein/fat/carbs as a % of the daily goal. Each
 * macro gets its own ring (same colour mapping as MacroTile/CaloriesRing
 * elsewhere in the app), nested from outside in: calories, protein, fat,
 * carbs. Rings cap visually at 100% (a full circle) but the % label keeps
 * showing the real number so "over goal" is still visible as text.
 */

import React, { useId } from 'react';

interface RingMetric {
  avg: number;
  goal: number;
  label: string;
  color: string;
  unit: string;
}

interface WeeklyRingsProps {
  metrics: RingMetric[]; // outer to inner
}

const SIZE = 200;
const STROKE = 14;
const GAP = 5;

export function WeeklyRings({ metrics }: WeeklyRingsProps) {
  const gradBase = useId();
  const center = SIZE / 2;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
      <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90">
          <defs>
            {metrics.map((m, i) => (
              <linearGradient key={i} id={`${gradBase}-${i}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={m.color} stopOpacity={0.55} />
                <stop offset="100%" stopColor={m.color} />
              </linearGradient>
            ))}
          </defs>
          {metrics.map((m, i) => {
            const radius = center - STROKE / 2 - i * (STROKE + GAP);
            const circumference = 2 * Math.PI * radius;
            const pct = m.goal > 0 ? Math.min(100, Math.max(0, (m.avg / m.goal) * 100)) : 0;
            const offset = circumference - (pct / 100) * circumference;
            return (
              <g key={i}>
                <circle cx={center} cy={center} r={radius} fill="none" stroke="var(--muted)" strokeWidth={STROKE} />
                <circle
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke={`url(#${gradBase}-${i})`}
                  strokeWidth={STROKE}
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={offset}
                  style={{ transition: 'stroke-dashoffset 0.7s ease-out' }}
                />
              </g>
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl">📊</span>
          <span className="text-[11px] text-muted-foreground mt-1">за неделю</span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-1 gap-3 w-full sm:w-auto">
        {metrics.map((m, i) => {
          const pct = m.goal > 0 ? Math.round((m.avg / m.goal) * 100) : 0;
          return (
            <div key={i} className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: m.color }} />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground leading-tight">{m.label}</p>
                <p className="text-sm font-semibold text-foreground leading-tight">
                  {Math.round(m.avg)}{m.unit} <span className="text-xs font-normal text-muted-foreground">/ {m.goal}{m.unit} · {pct}%</span>
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
