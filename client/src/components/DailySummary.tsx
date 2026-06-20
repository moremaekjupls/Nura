/**
 * DailySummary Component
 * Colorful dashboard: greeting header, macro percentage tiles and the water
 * tracker, all driven by the day's totals vs. goals.
 */

import React from 'react';
import { DailySummary as DailySummaryType, WaterLog } from '@/types';
import { MacroTile } from './MacroTile';
import { CaloriesRing } from './CaloriesRing';
import { WaterTracker } from './WaterTracker';
import { Button } from '@/components/ui/button';
import { formatDateFull } from '@/lib/dateUtils';
import { Settings, Wheat, Droplet, Beef } from 'lucide-react';

interface DailySummaryProps {
  summary: DailySummaryType;
  waterLogs: WaterLog[];
  onEditGoal?: () => void;
  onAddWaterCup: () => void;
  onAddWaterCustom: (ml: number) => void;
  onUndoWater: () => void;
}

export function DailySummary({
  summary,
  waterLogs,
  onEditGoal,
  onAddWaterCup,
  onAddWaterCustom,
  onUndoWater,
}: DailySummaryProps) {
  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-white flex items-center gap-2 drop-shadow-[0_1px_4px_rgba(0,0,0,0.5)]">
            Сегодня <span className="text-2xl">📅</span>
          </h1>
          <p className="text-sm text-white/85 mt-1 drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)]">
            {formatDateFull(summary.date)}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onEditGoal}
          className="rounded-full h-12 w-12 bg-[oklch(0.97_0.01_240)]/25 hover:bg-[oklch(0.97_0.01_240)]/35 backdrop-blur-xl backdrop-saturate-150 border border-white/30 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.4),0_4px_14px_-4px_rgba(0,0,0,0.4)] transition-colors"
        >
          <Settings className="w-6 h-6 text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)]" />
        </Button>
      </div>

      <CaloriesRing
        consumed={summary.totals.calories}
        goal={summary.goal.calories}
        isOverGoal={summary.isOverGoal.calories}
      />

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <MacroTile
          label="Углеводы"
          icon={Wheat}
          consumed={summary.totals.carbs}
          goal={summary.goal.carbs}
          unit="г"
          color="carbs"
          isOverGoal={summary.isOverGoal.carbs}
          sticker="🌾"
          compact
        />
        <MacroTile
          label="Жиры"
          icon={Droplet}
          consumed={summary.totals.fat}
          goal={summary.goal.fat}
          unit="г"
          color="fat"
          isOverGoal={summary.isOverGoal.fat}
          sticker="🥑"
          compact
        />
        <MacroTile
          label="Белки"
          icon={Beef}
          consumed={summary.totals.protein}
          goal={summary.goal.protein}
          unit="г"
          color="protein"
          isOverGoal={summary.isOverGoal.protein}
          sticker="🍗"
          compact
        />
      </div>

      <WaterTracker
        consumed={summary.water.consumed}
        goal={summary.water.goal}
        hasLogs={waterLogs.length > 0}
        onAddCup={onAddWaterCup}
        onAddCustom={onAddWaterCustom}
        onUndo={onUndoWater}
      />
    </div>
  );
}
