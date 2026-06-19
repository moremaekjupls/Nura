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
  const [water, setWater] = useState(goal.water.toString());
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Update form when goal changes
  useEffect(() => {
    setCalories(goal.calories.toString());
    setProtein(goal.protein.toString());
    setFat(goal.fat.toString());
    setCarbs(goal.carbs.toString());
    setWater(goal.water.toString());
  }, [goal, open]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!calories || parseFloat(calories) <= 0) newErrors.calories = 'Укажите корректные калории';
    if (!protein || parseFloat(protein) < 0) newErrors.protein = 'Укажите корректный белок';
    if (!fat || parseFloat(fat) < 0) newErrors.fat = 'Укажите корректные жиры';
    if (!carbs || parseFloat(carbs) < 0) newErrors.carbs = 'Укажите корректные углеводы';
    if (!water || parseFloat(water) <= 0) newErrors.water = 'Укажите корректную цель по воде';

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
      water: parseFloat(water),
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">Цели на день</DialogTitle>
          <DialogDescription>
            Задайте дневные цели по питанию
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="goal-calories" className="text-sm font-semibold">
              Калории *
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
                Белки (г) *
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
                Жиры (г) *
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
                Углеводы (г) *
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

          <div>
            <Label htmlFor="goal-water" className="text-sm font-semibold">
              Вода (мл) *
            </Label>
            <Input
              id="goal-water"
              type="number"
              value={water}
              onChange={(e) => setWater(e.target.value)}
              className="mt-1"
              min="0"
              step="250"
            />
            {errors.water && <p className="text-xs text-destructive mt-1">{errors.water}</p>}
          </div>

          <p className="text-xs text-muted-foreground pt-2">
            Эти цели применяются ко всем дням. Их можно изменить в любой момент.
          </p>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={handleSave}
            className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            Сохранить
          </Button>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            Отмена
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
