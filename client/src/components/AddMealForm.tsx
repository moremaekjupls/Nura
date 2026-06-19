import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Entry, MealType } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { getRecentFoods, getFrequentFoods, QuickFood } from '@/lib/storageService';

// ---------------------------------------------------------------------------
// Open Food Facts search
// ---------------------------------------------------------------------------

interface OFFProduct {
  product_name: string;
  nutriments: {
    'energy-kcal_100g'?: number;
    proteins_100g?: number;
    fat_100g?: number;
    carbohydrates_100g?: number;
  };
  serving_size?: string;
}

async function searchFoodFacts(query: string): Promise<OFFProduct[]> {
  if (!query.trim()) return [];
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=8&fields=product_name,nutriments,serving_size&lc=ru,en`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.products || []).filter(
      (p: OFFProduct) =>
        p.product_name &&
        p.nutriments?.['energy-kcal_100g'] != null
    );
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AddMealFormProps {
  date: string;
  editingEntry?: Entry | null;
  onSubmit: (entry: Omit<Entry, 'id'>) => void;
  onCancel?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AddMealForm({ date, editingEntry, onSubmit, onCancel }: AddMealFormProps) {
  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [fat, setFat] = useState('');
  const [carbs, setCarbs] = useState('');
  const [mealType, setMealType] = useState<MealType>('snack');
  const [time, setTime] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Search state
  const [searchResults, setSearchResults] = useState<OFFProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Quick-add foods
  const [recentFoods, setRecentFoods] = useState<QuickFood[]>([]);
  const [frequentFoods, setFrequentFoods] = useState<QuickFood[]>([]);

  useEffect(() => {
    if (editingEntry) {
      setName(editingEntry.name);
      setCalories(editingEntry.calories.toString());
      setProtein(editingEntry.protein.toString());
      setFat(editingEntry.fat.toString());
      setCarbs(editingEntry.carbs.toString());
      setMealType(editingEntry.mealType as MealType || 'snack');
      setTime(editingEntry.time || '');
    }
  }, [editingEntry]);

  useEffect(() => {
    if (!editingEntry) {
      getRecentFoods(8).then(setRecentFoods).catch(() => {});
      getFrequentFoods(5).then(setFrequentFoods).catch(() => {});
    }
  }, [editingEntry]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Debounced search
  const handleNameChange = useCallback((value: string) => {
    setName(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (value.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      const results = await searchFoodFacts(value);
      setSearchResults(results);
      setShowDropdown(results.length > 0);
      setSearching(false);
    }, 500);
  }, []);

  // Fill form from OFF product (per 100g)
  const selectOFFProduct = (p: OFFProduct) => {
    setName(p.product_name);
    const n = p.nutriments;
    setCalories(Math.round(n['energy-kcal_100g'] ?? 0).toString());
    setProtein(Number(n.proteins_100g ?? 0).toFixed(1));
    setFat(Number(n.fat_100g ?? 0).toFixed(1));
    setCarbs(Number(n.carbohydrates_100g ?? 0).toFixed(1));
    setShowDropdown(false);
    setSearchResults([]);
  };

  // Fill form from quick-add food
  const selectQuickFood = (f: QuickFood) => {
    setName(f.name);
    setCalories(Math.round(f.calories).toString());
    setProtein(Number(f.protein).toFixed(1));
    setFat(Number(f.fat).toFixed(1));
    setCarbs(Number(f.carbs).toFixed(1));
    if (f.mealType) setMealType(f.mealType as MealType);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Введите название';
    if (!calories || parseFloat(calories) < 0) newErrors.calories = 'Укажите калории';
    if (!protein || parseFloat(protein) < 0) newErrors.protein = 'Укажите белки';
    if (!fat || parseFloat(fat) < 0) newErrors.fat = 'Укажите жиры';
    if (!carbs || parseFloat(carbs) < 0) newErrors.carbs = 'Укажите углеводы';
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
    setName('');
    setCalories('');
    setProtein('');
    setFat('');
    setCarbs('');
    setMealType('snack');
    setTime('');
    setErrors({});
  };

  // Combine recent + frequent, dedup, show frequent first
  const quickFoods = [
    ...frequentFoods,
    ...recentFoods.filter((r) => !frequentFoods.some((f) => f.name === r.name)),
  ].slice(0, 8);

  return (
    <Card className="border-primary/20 bg-primary/5 animate-scale-in">
      <div className="p-6">
        <h2 className="text-lg font-heading font-bold text-foreground mb-4">
          {editingEntry ? 'Редактировать' : 'Добавить приём пищи'}
        </h2>

        {/* Quick-add chips */}
        {!editingEntry && quickFoods.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
              Быстрый повтор
            </p>
            <div className="flex flex-wrap gap-2">
              {quickFoods.map((f, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => selectQuickFood(f)}
                  className="text-xs bg-background border border-border rounded-full px-3 py-1 hover:bg-primary/10 hover:border-primary/40 transition-colors truncate max-w-[160px]"
                  title={`${f.name} — ${Math.round(f.calories)} ккал`}
                >
                  {f.name}
                  <span className="ml-1 text-muted-foreground">{Math.round(f.calories)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name with autocomplete */}
          <div className="relative" ref={dropdownRef}>
            <Label htmlFor="name" className="text-sm font-semibold">
              Название {searching && <span className="text-muted-foreground font-normal">(поиск...)</span>}
            </Label>
            <Input
              id="name"
              placeholder="Гречка, куриная грудка..."
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
              className="mt-1"
              autoComplete="off"
            />
            {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}

            {/* Dropdown with OFF results */}
            {showDropdown && (
              <div className="absolute z-50 mt-1 w-full bg-background border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
                <div className="px-3 py-1.5 text-xs text-muted-foreground border-b border-border">
                  Open Food Facts • данные на 100 г
                </div>
                {searchResults.map((p, i) => {
                  const n = p.nutriments;
                  return (
                    <button
                      key={i}
                      type="button"
                      className="w-full text-left px-3 py-2.5 hover:bg-muted/60 transition-colors border-b border-border/50 last:border-0"
                      onMouseDown={() => selectOFFProduct(p)}
                    >
                      <div className="font-medium text-sm truncate">{p.product_name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {Math.round(n['energy-kcal_100g'] ?? 0)} ккал
                        &nbsp;·&nbsp;Б {Number(n.proteins_100g ?? 0).toFixed(1)}г
                        &nbsp;·&nbsp;Ж {Number(n.fat_100g ?? 0).toFixed(1)}г
                        &nbsp;·&nbsp;У {Number(n.carbohydrates_100g ?? 0).toFixed(1)}г
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Meal type and time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="mealType" className="text-sm font-semibold">Приём пищи</Label>
              <Select value={mealType} onValueChange={(v) => setMealType(v as MealType)}>
                <SelectTrigger id="mealType" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="breakfast">Завтрак</SelectItem>
                  <SelectItem value="lunch">Обед</SelectItem>
                  <SelectItem value="dinner">Ужин</SelectItem>
                  <SelectItem value="snack">Перекус</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="time" className="text-sm font-semibold">Время</Label>
              <Input id="time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className="mt-1" />
            </div>
          </div>

          {/* Macros */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="calories" className="text-sm font-semibold">Калории *</Label>
              <Input id="calories" type="number" placeholder="0" value={calories}
                onChange={(e) => setCalories(e.target.value)} className="mt-1" min="0" step="1" />
              {errors.calories && <p className="text-xs text-destructive mt-1">{errors.calories}</p>}
            </div>
            <div>
              <Label htmlFor="protein" className="text-sm font-semibold">Белки (г) *</Label>
              <Input id="protein" type="number" placeholder="0" value={protein}
                onChange={(e) => setProtein(e.target.value)} className="mt-1" min="0" step="0.1" />
              {errors.protein && <p className="text-xs text-destructive mt-1">{errors.protein}</p>}
            </div>
            <div>
              <Label htmlFor="fat" className="text-sm font-semibold">Жиры (г) *</Label>
              <Input id="fat" type="number" placeholder="0" value={fat}
                onChange={(e) => setFat(e.target.value)} className="mt-1" min="0" step="0.1" />
              {errors.fat && <p className="text-xs text-destructive mt-1">{errors.fat}</p>}
            </div>
            <div>
              <Label htmlFor="carbs" className="text-sm font-semibold">Углеводы (г) *</Label>
              <Input id="carbs" type="number" placeholder="0" value={carbs}
                onChange={(e) => setCarbs(e.target.value)} className="mt-1" min="0" step="0.1" />
              {errors.carbs && <p className="text-xs text-destructive mt-1">{errors.carbs}</p>}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground">
              {editingEntry ? 'Сохранить' : 'Добавить'}
            </Button>
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
                Отмена
              </Button>
            )}
          </div>
        </form>
      </div>
    </Card>
  );
}
