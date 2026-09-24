import type { Goal, MealType } from '@shared/nutrition';

let token: string | null = null;

/** Inside Telegram the session travels as a Bearer token (cookies are unreliable in the webview/iframe). */
export function setToken(t: string | null) {
  token = t;
  try {
    if (t) sessionStorage.setItem('nura_token', t);
    else sessionStorage.removeItem('nura_token');
  } catch {
    /* storage unavailable */
  }
}

export function restoreToken() {
  try {
    token = sessionStorage.getItem('nura_token');
  } catch {
    token = null;
  }
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: init.method ?? 'GET',
      credentials: 'include',
      headers: {
        ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'offline');
  }
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const b = await res.json();
      if (b?.error) message = b.error;
    } catch {
      /* not JSON */
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Types mirrored from the server responses
// ---------------------------------------------------------------------------

export interface Me {
  id: string;
  email: string | null;
  telegram: boolean;
  hasPassword: boolean;
  name: string | null;
  lang: 'ru' | 'uz';
  profileComplete: boolean;
}

export interface Entry {
  id: string;
  date: string;
  name: string;
  portion: string | null;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  mealType: MealType;
  time: string | null;
}
export type EntryInput = Omit<Entry, 'id'>;

export interface Day {
  date: string;
  entries: Entry[];
  totals: { calories: number; protein: number; fat: number; carbs: number };
  water: { logs: { id: string; ml: number }[]; total: number };
  goal: Goal;
}

export interface HistoryDay {
  date: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  entries: number;
  water: number;
}

export interface Profile {
  name: string | null;
  gender: 'male' | 'female' | null;
  birthYear: number | null;
  heightCm: number | null;
  weightKg: number | null;
  activity: 'low' | 'mid' | 'high' | null;
  goalMode: 'lose' | 'keep' | 'gain' | null;
  lang: 'ru' | 'uz';
  email: string | null;
  telegram: boolean;
}

export interface FoodItem {
  name: string;
  portion: string | null;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

export interface AiResult {
  items: FoodItem[];
  confidence: 'high' | 'medium' | 'low';
  note: string;
}
