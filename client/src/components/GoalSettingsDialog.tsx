/**
 * GoalSettingsDialog Component
 * Modal for editing daily nutrition goals
 */

import React, { useState, useEffect } from 'react';
import { Goal } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface GoalSettingsDialogProps {
  open: boolean;
  goal: Goal;
  onSave: (goal: Goal) => void;
  onOpenChange: (open: boolean) => void;
}

export function GoalSettingsDialog({
  open,
  goal,
  onSave,
  onOpenChange,
}: GoalSettingsDialogProps) {
  const [calories, setCalories] = useState(goal.calories.toString());
  const [protein, setProtein] = useState(goal.protein.toString());
  const [fat, setFat] = useState(goal.fat.toString());
  const [carbs, setCarbs] = useState(goal.carbs.toString());
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Update form when goal changes
  useEffect(() => {
    setCalories(goal.calories.toString());
    setProtein(goal.protein.toString());
    setFat(goal.fat.toString());
    setCarbs(goal.carbs.toString());
  }, [goal, open]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!calories || parseFloat(calories) <= 0) newErrors.calories = 'Valid calories required';
    if (!protein || parseFloat(protein) < 0) newErrors.protein = 'Valid protein required';
    if (!fat || parseFloat(fat) < 0) newErrors.fat = 'Valid fat required';
    if (!carbs || parseFloat(carbs) < 0) newErrors.carbs = 'Valid carbs required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validateForm()) return;

    onSave({
      calories: parseFloat(calories),
      protein: parseFloat(protein),
      fat: parseFloat(fat),
      carbs: parseFloat(carbs),
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">Daily Goals</DialogTitle>
          <DialogDescription>
            Set your daily nutrition targets
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="goal-calories" className="text-sm font-semibold">
              Calories *
            </Label>
            <Input
              id="goal-calories"
              type="number"
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
              className="mt-1"
              min="0"
              step="50"
            />
            {errors.calories && <p className="text-xs text-destructive mt-1">{errors.calories}</p>}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="goal-protein" className="text-sm font-semibold">
                Protein (g) *
              </Label>
              <Input
                id="goal-protein"
                type="number"
                value={protein}
                onChange={(e) => setProtein(e.target.value)}
                className="mt-1"
                min="0"
                step="5"
              />
              {errors.protein && <p className="text-xs text-destructive mt-1">{errors.protein}</p>}
            </div>

            <div>
              <Label htmlFor="goal-fat" className="text-sm font-semibold">
                Fat (g) *
              </Label>
              <Input
                id="goal-fat"
                type="number"
                value={fat}
                onChange={(e) => setFat(e.target.value)}
                className="mt-1"
                min="0"
                step="5"
              />
              {errors.fat && <p className="text-xs text-destructive mt-1">{errors.fat}</p>}
            </div>

            <div>
              <Label htmlFor="goal-carbs" className="text-sm font-semibold">
                Carbs (g) *
              </Label>
              <Input
                id="goal-carbs"
                type="number"
                value={carbs}
                onChange={(e) => setCarbs(e.target.value)}
                className="mt-1"
                min="0"
                step="5"
              />
              {errors.carbs && <p className="text-xs text-destructive mt-1">{errors.carbs}</p>}
            </div>
          </div>

          <p className="text-xs text-muted-foreground pt-2">
            These goals apply to all days. You can edit them anytime.
          </p>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={handleSave}
            className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            Save Goals
          </Button>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
