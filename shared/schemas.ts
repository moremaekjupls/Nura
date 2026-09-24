/** Request-body schemas, validated on the server. */
import { z } from 'zod';

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата в формате YYYY-MM-DD');
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const grams = z.number().finite().min(0).max(1000);

export const mealType = z.enum(['breakfast', 'lunch', 'dinner', 'snack']);

export const entryInput = z.object({
  date: isoDate,
  name: z.string().trim().min(1).max(120),
  portion: z.string().trim().max(60).nullish(),
  calories: z.number().finite().min(0).max(10000),
  protein: grams,
  fat: grams,
  carbs: grams,
  mealType: mealType,
  time: hhmm.nullish(),
});
export const entryBatch = z.object({ entries: z.array(entryInput).min(1).max(30) });
export const entryPatch = entryInput.partial();

export const goalInput = z.object({
  calories: z.number().finite().min(800).max(8000),
  protein: z.number().finite().min(0).max(500),
  fat: z.number().finite().min(0).max(400),
  carbs: z.number().finite().min(0).max(1000),
  water: z.number().finite().min(500).max(6000).optional(),
});

export const profileInput = z.object({
  name: z.string().trim().max(60).nullish(),
  gender: z.enum(['male', 'female']).nullish(),
  birthYear: z.number().int().min(1920).max(new Date().getFullYear() - 10).nullish(),
  heightCm: z.number().finite().min(100).max(250).nullish(),
  weightKg: z.number().finite().min(30).max(300).nullish(),
  activity: z.enum(['low', 'mid', 'high']).nullish(),
  goalMode: z.enum(['lose', 'keep', 'gain']).nullish(),
  lang: z.enum(['ru', 'uz']).nullish(),
  autoGoal: z.boolean().optional(),
});

export const waterInput = z.object({ date: isoDate, ml: z.number().finite().min(10).max(3000) });
export const weightInput = z.object({ date: isoDate, kg: z.number().finite().min(30).max(300) });

export const credentials = z.object({
  email: z.string().trim().toLowerCase().email('Некорректный email').max(200),
  password: z.string().min(8, 'Пароль — не короче 8 символов').max(200),
});
export const loginInput = z.object({ email: z.string().trim().toLowerCase().max(200), password: z.string().max(200) });
export const passwordChange = z.object({ current: z.string().max(200), next: credentials.shape.password });

export const aiPhotoInput = z.object({
  image: z.string().min(100).max(4_000_000), // base64, ~3 MB — the client resizes to ~1024 px first
  mediaType: z.enum(['image/jpeg', 'image/png', 'image/webp']).default('image/jpeg'),
  lang: z.enum(['ru', 'uz']).default('ru'),
});
export const aiTextInput = z.object({
  text: z.string().trim().min(2).max(500),
  lang: z.enum(['ru', 'uz']).default('ru'),
});

export const telegramAuthInput = z.object({ initData: z.string().min(10).max(4096) });
