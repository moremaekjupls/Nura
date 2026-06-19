/**
 * DateNavigator Component
 * Allows navigation between days
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { formatDate, isToday, addDaysToISO } from '@/lib/dateUtils';

interface DateNavigatorProps {
  date: string;
  onDateChange: (date: string) => void;
}

export function DateNavigator({ date, onDateChange }: DateNavigatorProps) {
  const handlePrevious = () => {
    onDateChange(addDaysToISO(date, -1));
  };

  const handleNext = () => {
    onDateChange(addDaysToISO(date, 1));
  };

  const handleToday = () => {
    const today = new Date().toISOString().split('T')[0];
    onDateChange(today);
  };

  return (
    <div className="flex items-center justify-between gap-2">
      <Button
        variant="outline"
        size="icon"
        onClick={handlePrevious}
        className="rounded-full"
      >
        <ChevronLeft className="w-4 h-4" />
      </Button>

      <div className="flex-1 text-center">
        <button
          onClick={handleToday}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full hover:bg-muted transition-colors"
        >
          <Calendar className="w-4 h-4 text-primary" />
          <span className="font-semibold text-foreground">
            {formatDate(date)}
            {isToday(date) && <span className="text-xs text-primary ml-1">(Today)</span>}
          </span>
        </button>
      </div>

      <Button
        variant="outline"
        size="icon"
        onClick={handleNext}
        className="rounded-full"
      >
        <ChevronRight className="w-4 h-4" />
      </Button>
    </div>
  );
}
