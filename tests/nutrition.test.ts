import { describe, expect, it } from 'vitest';
import { calcGoal, calcWater, mealForHour } from '../shared/nutrition';

describe('calcGoal', () => {
  it('Mifflin–St Jeor, female, moderate activity, cutting', () => {
    const g = calcGoal({ gender: 'female', birthYear: 1997, heightCm: 165, weightKg: 64, activity: 'mid', goalMode: 'lose' }, 2026);
    expect(g).toEqual({ calories: 1800, protein: 115, fat: 58, carbs: 205 });
  });

  it('male maintenance is higher and uses 1.6 g/kg protein', () => {
    const g = calcGoal({ gender: 'male', birthYear: 1990, heightCm: 180, weightKg: 80, activity: 'mid', goalMode: 'keep' }, 2026);
    // BMR = 800 + 1125 − 180 + 5 = 1750; × 1.55 = 2712.5 → 2710
    expect(g.calories).toBe(2710);
    expect(g.protein).toBe(128);
  });

  it('never goes below the 1200 kcal floor', () => {
    const g = calcGoal({ gender: 'female', birthYear: 1950, heightCm: 145, weightKg: 40, activity: 'low', goalMode: 'lose' }, 2026);
    expect(g.calories).toBe(1200);
  });
});

describe('helpers', () => {
  it('water goal ~30 ml/kg in 250 ml steps, clamped', () => {
    expect(calcWater(64)).toBe(2000);
    expect(calcWater(40)).toBe(1500);
    expect(calcWater(150)).toBe(3500);
  });
  it('meal by hour', () => {
    expect(mealForHour(8)).toBe('breakfast');
    expect(mealForHour(13)).toBe('lunch');
    expect(mealForHour(19)).toBe('dinner');
    expect(mealForHour(1)).toBe('snack');
  });
});
