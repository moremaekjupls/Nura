/**
 * MacroCircle Component
 * Displays a circular progress indicator for a single macro (or calories)
 * Shows consumed vs. goal with color coding
 */

import React from 'react';
import { cn } from '@/lib/utils';

interface MacroCircleProps {
  label: string;
  consumed: number;
  goal: number;
  unit: string;
  isOverGoal?: boolean;
  color?: 'peach' | 'green' | 'coral' | 'gold';
}

export function MacroCircle({
  label,
  consumed,
  goal,
  unit,
  isOverGoal = false,
  color = 'peach',
}: MacroCircleProps) {
  const percentage = Math.min((consumed / goal) * 100, 100);
  const circumference = 2 * Math.PI * 45; // radius = 45
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const colorClasses = {
    peach: 'text-primary',
    green: 'text-secondary',
    coral: 'text-destructive',
    gold: 'text-chart-4',
  };

  const bgColorClasses = {
    peach: 'bg-primary/10',
    green: 'bg-secondary/10',
    coral: 'bg-destructive/10',
    gold: 'bg-chart-4/10',
  };

  return (
    <div className="flex flex-col items-center gap-2 animate-fade-in-up">
      <div className="relative w-32 h-32">
        {/* Background circle */}
        <svg
          className="absolute inset-0 w-full h-full -rotate-90"
          viewBox="0 0 120 120"
        >
          <circle
            cx="60"
            cy="60"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-muted"
          />
          {/* Progress circle */}
          <circle
            cx="60"
            cy="60"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className={cn(
              'transition-all duration-700 ease-out',
              isOverGoal ? 'text-destructive' : colorClasses[color]
            )}
          />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-center">
            <div className="text-2xl font-heading font-bold text-foreground">
              {consumed}
            </div>
            <div className="text-xs text-muted-foreground">{unit}</div>
          </div>
        </div>
      </div>

      {/* Label and goal */}
      <div className="text-center">
        <h3 className="text-sm font-semibold text-foreground">{label}</h3>
        <p className={cn(
          'text-xs',
          isOverGoal ? 'text-destructive font-semibold' : 'text-muted-foreground'
        )}>
          {isOverGoal ? (
            <>+{consumed - goal} over</>
          ) : (
            <>{goal - consumed} left</>
          )}
        </p>
      </div>
    </div>
  );
}
