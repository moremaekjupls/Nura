export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface Entry {
  id: string;
  date: string;        // YYYY-MM-DD
  name: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  mealType?: MealType;
  time?: string;       // HH:MM
}

export interface Goal {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

export interface DailySummary {
  date: string;
  entries: Entry[];
  totals: { calories: number; protein: number; fat: number; carbs: number };
  goal: Goal;
  remaining: { calories: number; protein: number; fat: number; carbs: number };
  isOverGoal: { calories: boolean; protein: boolean; fat: boolean; carbs: boolean };
}
