import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Goal } from '@shared/nutrition';
import { AiResult, api, Day, Entry, EntryInput, FoodItem, HistoryDay, Profile } from '@/lib/api';

export const keys = {
  day: (date: string) => ['day', date] as const,
  history: (from: string, to: string) => ['history', from, to] as const,
  profile: ['profile'] as const,
  weights: ['weights'] as const,
  frequent: ['frequent'] as const,
};

export const useDay = (date: string) =>
  useQuery({ queryKey: keys.day(date), queryFn: () => api<Day>(`/api/day?date=${date}`) });

export const useHistory = (from: string, to: string) =>
  useQuery({
    queryKey: keys.history(from, to),
    queryFn: () => api<{ days: HistoryDay[]; goal: Goal }>(`/api/history?from=${from}&to=${to}`),
  });

export const useProfile = () =>
  useQuery({ queryKey: keys.profile, queryFn: () => api<{ profile: Profile; goal: Goal }>('/api/profile') });

export const useWeights = () =>
  useQuery({ queryKey: keys.weights, queryFn: () => api<{ date: string; kg: number }[]>('/api/weight') });

export const useFrequent = () =>
  useQuery({ queryKey: keys.frequent, queryFn: () => api<(FoodItem & { count: number })[]>('/api/foods/frequent'), staleTime: 60_000 });

/** Anything that changes what a day shows also changes history and "frequent". */
function useInvalidateFood() {
  const qc = useQueryClient();
  return (date?: string) => {
    if (date) qc.invalidateQueries({ queryKey: keys.day(date) });
    qc.invalidateQueries({ queryKey: ['history'] });
    qc.invalidateQueries({ queryKey: keys.frequent });
  };
}

export function useAddEntries() {
  const inv = useInvalidateFood();
  return useMutation({
    mutationFn: (entries: EntryInput[]) => api<Entry[]>('/api/entries', { method: 'POST', body: { entries } }),
    onSuccess: (_d, entries) => inv(entries[0]?.date),
  });
}

export function useUpdateEntry() {
  const inv = useInvalidateFood();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<EntryInput> }) =>
      api<Entry>(`/api/entries/${encodeURIComponent(id)}`, { method: 'PUT', body: patch }),
    onSuccess: (e) => inv(e.date),
  });
}

export function useDeleteEntry() {
  const inv = useInvalidateFood();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (e: Entry) => api(`/api/entries/${encodeURIComponent(e.id)}`, { method: 'DELETE' }),
    onMutate: async (e) => {
      // Optimistic: the row disappears immediately; rolled back on error.
      await qc.cancelQueries({ queryKey: keys.day(e.date) });
      const prev = qc.getQueryData<Day>(keys.day(e.date));
      if (prev) qc.setQueryData<Day>(keys.day(e.date), { ...prev, entries: prev.entries.filter((x) => x.id !== e.id) });
      return { prev };
    },
    onError: (_err, e, ctx) => ctx?.prev && qc.setQueryData(keys.day(e.date), ctx.prev),
    onSettled: (_d, _e, e) => inv(e.date),
  });
}

export function useWater(date: string) {
  const qc = useQueryClient();
  const add = useMutation({
    mutationFn: (ml: number) => api<{ id: string; ml: number }>('/api/water', { method: 'POST', body: { date, ml } }),
    onMutate: async (ml) => {
      await qc.cancelQueries({ queryKey: keys.day(date) });
      const prev = qc.getQueryData<Day>(keys.day(date));
      if (prev) qc.setQueryData<Day>(keys.day(date), { ...prev, water: { logs: [...prev.water.logs, { id: 'pending', ml }], total: prev.water.total + ml } });
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(keys.day(date), ctx.prev),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: keys.day(date) });
      qc.invalidateQueries({ queryKey: ['history'] });
    },
  });
  const undo = useMutation({
    mutationFn: (id: string) => api(`/api/water/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: keys.day(date) });
      const prev = qc.getQueryData<Day>(keys.day(date));
      if (prev) {
        const logs = prev.water.logs.filter((l) => l.id !== id);
        qc.setQueryData<Day>(keys.day(date), { ...prev, water: { logs, total: logs.reduce((a, l) => a + l.ml, 0) } });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(keys.day(date), ctx.prev),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: keys.day(date) });
      qc.invalidateQueries({ queryKey: ['history'] });
    },
  });
  return { add, undo };
}

/** Profile, goal and weight all feed the daily goal — refresh everything that shows it. */
function useInvalidateGoal() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: keys.profile });
    qc.invalidateQueries({ queryKey: ['day'] });
    qc.invalidateQueries({ queryKey: ['history'] });
  };
}

export function useSaveProfile() {
  const inv = useInvalidateGoal();
  return useMutation({
    mutationFn: (p: Partial<Omit<Profile, 'email' | 'telegram'>> & { autoGoal?: boolean }) =>
      api<{ profile: Profile; goal: Goal }>('/api/profile', { method: 'PUT', body: p }),
    onSuccess: inv,
  });
}

export function useSaveGoal() {
  const inv = useInvalidateGoal();
  return useMutation({
    mutationFn: (g: Omit<Goal, 'auto'>) => api<Goal>('/api/goal', { method: 'PUT', body: g }),
    onSuccess: inv,
  });
}

export function useLogWeight() {
  const inv = useInvalidateGoal();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (w: { date: string; kg: number }) => api<{ goal: Goal }>('/api/weight', { method: 'POST', body: w }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.weights });
      inv();
    },
  });
}

export function useRecognize() {
  return useMutation({
    mutationFn: (input: { kind: 'photo'; image: string; mediaType: string; lang: string } | { kind: 'text'; text: string; lang: string }) =>
      input.kind === 'photo'
        ? api<AiResult>('/api/ai/photo', { method: 'POST', body: { image: input.image, mediaType: input.mediaType, lang: input.lang } })
        : api<AiResult>('/api/ai/text', { method: 'POST', body: { text: input.text, lang: input.lang } }),
  });
}

export interface AppConfig {
  botUsername: string | null;
  passwordReset: boolean;
}
export const useConfig = () =>
  useQuery({ queryKey: ['config'], queryFn: () => api<AppConfig>('/api/config'), staleTime: 10 * 60_000 });

export interface ReminderSettings {
  meals: boolean;
  water: boolean;
  telegram: boolean;
  canWrite: boolean;
  available: boolean;
  botUsername: string | null;
}
export const useReminders = () => useQuery({ queryKey: ['reminders'], queryFn: () => api<ReminderSettings>('/api/reminders') });

export function useSaveReminders() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: { meals?: boolean; water?: boolean; allow?: boolean }) =>
      (p.allow ? api<ReminderSettings>('/api/reminders/allow', { method: 'POST' }) : Promise.resolve(null)).then(() =>
        api<ReminderSettings>('/api/reminders', { method: 'PUT', body: { meals: p.meals, water: p.water } }),
      ),
    onSuccess: (r) => qc.setQueryData(['reminders'], r),
  });
}
