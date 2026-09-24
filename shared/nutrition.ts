/**
 * Nutrition math shared by the server (auto-goal recompute) and the client
 * (live preview in onboarding / profile). Pure functions, no I/O.
 */

export type Gender = 'male' | 'female';
export type Activity = 'low' | 'mid' | 'high';
export type GoalMode = 'lose' | 'keep' | 'gain';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export interface Macros {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

export interface Goal extends Macros {
  water: number; // ml per day
  auto: boolean; // true = recomputed from the profile whenever it changes
}

export interface BodyProfile {
  gender: Gender;
  birthYear: number;
  heightCm: number;
  weightKg: number;
  activity: Activity;
  goalMode: GoalMode;
}

export const ACTIVITY_FACTOR: Record<Activity, number> = { low: 1.375, mid: 1.55, high: 1.725 };
export const GOAL_FACTOR: Record<GoalMode, number> = { lose: 0.85, keep: 1, gain: 1.1 };

/** Mifflin–St Jeor basal metabolic rate, kcal/day. */
export function bmr(p: Pick<BodyProfile, 'gender' | 'birthYear' | 'heightCm' | 'weightKg'>, year: number): number {
  const age = year - p.birthYear;
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * age;
  return p.gender === 'male' ? base + 5 : base - 161;
}

/**
 * Daily target: BMR × activity × goal adjustment, rounded to 10 kcal.
 * Protein 1.6 g/kg (maintain) or 1.8 g/kg (cut/bulk), fat 0.9 g/kg,
 * carbs fill the remainder. Floors keep extreme inputs sane.
 */
export function calcGoal(p: BodyProfile, year = new Date().getFullYear()): Macros {
  const kcal = Math.max(1200, Math.round((bmr(p, year) * ACTIVITY_FACTOR[p.activity] * GOAL_FACTOR[p.goalMode]) / 10) * 10);
  const protein = Math.round(p.weightKg * (p.goalMode === 'keep' ? 1.6 : 1.8));
  const fat = Math.round(p.weightKg * 0.9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { calories: kcal, protein, fat, carbs };
}

/** Water: ~30 ml per kg, rounded to 250 ml, 1.5–3.5 l. */
export function calcWater(weightKg: number): number {
  return Math.min(3500, Math.max(1500, Math.round((weightKg * 30) / 250) * 250));
}

export function isBodyProfileComplete(p: Partial<BodyProfile>): p is BodyProfile {
  return !!(p.gender && p.birthYear && p.heightCm && p.weightKg && p.activity && p.goalMode);
}

/** Meal slot for a local hour — used to pre-select the meal in the add sheet. */
export function mealForHour(h: number): MealType {
  if (h >= 4 && h < 11) return 'breakfast';
  if (h >= 11 && h < 16) return 'lunch';
  if (h >= 16 && h < 22) return 'dinner';
  return 'snack';
}
