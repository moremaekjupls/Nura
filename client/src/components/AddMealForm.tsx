/**
 * AddMealForm Component
 * Form for adding or editing a meal entry
 */

import React, { useState, useEffect } from 'react';
import { Entry, MealType } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';

interface AddMealFormProps {
  date: string;
  editingEntry?: Entry | null;
  onSubmit: (entry: Omit<Entry, 'id'>) => void;
  onCancel?: () => void;
}

export function AddMealForm({
  date,
  editingEntry,
  onSubmit,
  onCancel,
}: AddMealFormProps) {
  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [fat, setFat] = useState('');
  const [carbs, setCarbs] = useState('');
  const [mealType, setMealType] = useState<MealType>('snack');
  const [time, setTime] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Populate form if editing
  useEffect(() => {
    if (editingEntry) {
      setName(editingEntry.name);
      setCalories(editingEntry.calories.toString());
      setProtein(editingEntry.protein.toString());
      setFat(editingEntry.fat.toString());
      setCarbs(editingEntry.carbs.toString());
      setMealType(editingEntry.mealType || 'snack');
      setTime(editingEntry.time || '');
    }
  }, [editingEntry]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) newErrors.name = 'Meal name is required';
    if (!calories || parseFloat(calories) < 0) newErrors.calories = 'Valid calories required';
    if (!protein || parseFloat(protein) < 0) newErrors.protein = 'Valid protein required';
    if (!fat || parseFloat(fat) < 0) newErrors.fat = 'Valid fat required';
    if (!carbs || parseFloat(carbs) < 0) newErrors.carbs = 'Valid carbs required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    onSubmit({
      date,
      name: name.trim(),
      calories: parseFloat(calories),
      protein: parseFloat(protein),
      fat: parseFloat(fat),
      carbs: parseFloat(carbs),
      mealType,
      time: time || undefined,
    });

    // Reset form
    setName('');
    setCalories('');
    setProtein('');
    setFat('');
    setCarbs('');
    setMealType('snack');
    setTime('');
    setErrors({});
  };

  return (
    <Card className="border-primary/20 bg-primary/5 animate-scale-in">
      <div className="p-6">
        <h2 className="text-lg font-heading font-bold text-foreground mb-6">
          {editingEntry ? 'Edit Meal' : 'Add Meal'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Meal name */}
          <div>
            <Label htmlFor="name" className="text-sm font-semibold">
              Meal Name *
            </Label>
            <Input
              id="name"
              placeholder="e.g., Grilled chicken with rice"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1"
            />
            {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
          </div>

          {/* Meal type and time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="mealType" className="text-sm font-semibold">
                Meal Type
              </Label>
              <Select value={mealType} onValueChange={(value) => setMealType(value as MealType)}>
                <SelectTrigger id="mealType" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="breakfast">Breakfast</SelectItem>
                  <SelectItem value="lunch">Lunch</SelectItem>
                  <SelectItem value="dinner">Dinner</SelectItem>
                  <SelectItem value="snack">Snack</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="time" className="text-sm font-semibold">
                Time (optional)
              </Label>
              <Input
                id="time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          {/* Macros */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="calories" className="text-sm font-semibold">
                Calories *
              </Label>
              <Input
                id="calories"
                type="number"
                placeholder="0"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
                className="mt-1"
                min="0"
                step="1"
              />
              {errors.calories && <p className="text-xs text-destructive mt-1">{errors.calories}</p>}
            </div>

            <div>
              <Label htmlFor="protein" className="text-sm font-semibold">
                Protein (g) *
              </Label>
              <Input
                id="protein"
                type="number"
                placeholder="0"
                value={protein}
                onChange={(e) => setProtein(e.target.value)}
                className="mt-1"
                min="0"
                step="0.1"
              />
              {errors.protein && <p className="text-xs text-destructive mt-1">{errors.protein}</p>}
            </div>

            <div>
              <Label htmlFor="fat" className="text-sm font-semibold">
                Fat (g) *
              </Label>
              <Input
                id="fat"
                type="number"
                placeholder="0"
                value={fat}
                onChange={(e) => setFat(e.target.value)}
                className="mt-1"
                min="0"
                step="0.1"
              />
              {errors.fat && <p className="text-xs text-destructive mt-1">{errors.fat}</p>}
            </div>

            <div>
              <Label htmlFor="carbs" className="text-sm font-semibold">
                Carbs (g) *
              </Label>
              <Input
                id="carbs"
                type="number"
                placeholder="0"
                value={carbs}
                onChange={(e) => setCarbs(e.target.value)}
                className="mt-1"
                min="0"
                step="0.1"
              />
              {errors.carbs && <p className="text-xs text-destructive mt-1">{errors.carbs}</p>}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
          <Button
            type="submit"
            className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-200"
          >
            {editingEntry ? 'Update Meal' : 'Add Meal'}
          </Button>
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                className="flex-1"
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      </div>
    </Card>
  );
}
