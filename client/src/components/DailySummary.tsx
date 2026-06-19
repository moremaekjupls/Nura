/**
 * DailySummary Component
 * Displays the daily nutrition summary with circular progress indicators
 */

import React from 'react';
import { DailySummary as DailySummaryType } from '@/types';
import { MacroCircle } from './MacroCircle';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatDateFull } from '@/lib/dateUtils';
import { Settings } from 'lucide-react';

interface DailySummaryProps {
  summary: DailySummaryType;
  onEditGoal?: () => void;
}

export function DailySummary({ summary, onEditGoal }: DailySummaryProps) {
  return (
    <Card className="bg-gradient-to-br from-primary/5 to-secondary/5 border-0 shadow-sm animate-fade-in-up">
      <div className="p-6 sm:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">
              Your Nutrition
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {formatDateFull(summary.date)}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onEditGoal}
            className="rounded-full hover:bg-primary/10 transition-colors"
          >
            <Settings className="w-5 h-5 text-primary" />
          </Button>
        </div>

        {/* Macro circles grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
          <MacroCircle
            label="Calories"
            consumed={summary.totals.calories}
            goal={summary.goal.calories}
            unit="kcal"
            isOverGoal={summary.isOverGoal.calories}
            color="peach"
          />
          <MacroCircle
            label="Protein"
            consumed={Math.round(summary.totals.protein)}
            goal={summary.goal.protein}
            unit="g"
            isOverGoal={summary.isOverGoal.protein}
            color="green"
          />
          <MacroCircle
            label="Fat"
            consumed={Math.round(summary.totals.fat)}
            goal={summary.goal.fat}
            unit="g"
            isOverGoal={summary.isOverGoal.fat}
            color="coral"
          />
          <MacroCircle
            label="Carbs"
            consumed={Math.round(summary.totals.carbs)}
            goal={summary.goal.carbs}
            unit="g"
            isOverGoal={summary.isOverGoal.carbs}
            color="gold"
          />
        </div>

        {/* Summary text */}
        <div className="mt-8 pt-6 border-t border-border">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center text-sm">
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wide">Calories</p>
              <p className="text-lg font-semibold text-foreground mt-1">
                {summary.totals.calories} / {summary.goal.calories}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wide">Protein</p>
              <p className="text-lg font-semibold text-foreground mt-1">
                {Math.round(summary.totals.protein)}g / {summary.goal.protein}g
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wide">Fat</p>
              <p className="text-lg font-semibold text-foreground mt-1">
                {Math.round(summary.totals.fat)}g / {summary.goal.fat}g
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wide">Carbs</p>
              <p className="text-lg font-semibold text-foreground mt-1">
                {Math.round(summary.totals.carbs)}g / {summary.goal.carbs}g
              </p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
