/**
 * MacroTile Component
 * Colorful stat tile for a single macro/metric: big percentage, thin progress
 * bar and consumed/goal readout. Designed to sit in a 2x2 (or 4-up) grid.
 */

import React from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

export type MacroColor = 'calories' | 'carbs' | 'fat' | 'protein';

interface MacroTileProps {
  label: string;
  icon: LucideIcon;
  consumed: number;
  goal: number;
  unit: string;
  color: MacroColor;
  isOverGoal?: boolean;
}

const colorVar: Record<MacroColor, string> = {
  calories: 'var(--chart-1)',
  carbs: 'var(--chart-2)',
  fat: 'var(--chart-3)',
  protein: 'var(--secondary)',
};

export function MacroTile({ label, icon: Icon, consumed, goal, unit, color, isOverGoal }: MacroTileProps) {
  const percent = goal > 0 ? Math.round((consumed / goal) * 100) : 0;
  const barWidth = Math.min(100, percent);
  const accent = isOverGoal ? 'var(--destructive)' : colorVar[color];

  return (
    <Card className="border-0 shadow-sm p-4 sm:p-5 animate-fade-in-up">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: `color-mix(in oklch, ${accent} 16%, white)` }}
        >
          <Icon className="w-4 h-4" style={{ color: accent }} />
        </div>
      </div>

      <div className="flex items-baseline gap-1 mb-2">
        <span className="text-2xl sm:text-3xl font-display font-bold text-foreground">{percent}%</span>
      </div>

      <div className="h-2 rounded-full bg-muted overflow-hidden mb-2">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${barWidth}%`, backgroundColor: accent }}
        />
      </div>

      <p className={cn('text-xs', isOverGoal ? 'font-semibold' : 'text-muted-foreground')} style={isOverGoal ? { color: accent } : undefined}>
        {Math.round(consumed)}{unit} / {goal}{unit}
      </p>
    </Card>
  );
}
