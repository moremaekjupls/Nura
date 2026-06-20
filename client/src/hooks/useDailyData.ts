/**
 * Custom hook for managing daily nutrition data.
 * Wraps the async storageService and provides React state management.
 */

import { useEffect, useState, useCallback } from 'react';
import { DailySummary, Entry, Goal, WaterLog } from '@/types';
import * as storageService from '@/lib/storageService';

export function useDailyData(date: string) {
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [waterLogs, setWaterLogs] = useState<WaterLog[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [data, water] = await Promise.all([
        storageService.getDailySummary(date),
        storageService.getWaterLogs(date),
      ]);
      setSummary(data);
      setWaterLogs(water.logs);
    } catch (error) {
      console.error('Error loading daily data:', error);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const addEntry = useCallback(
    async (entry: Omit<Entry, 'id'>) => {
      try {
        await storageService.addEntry(entry);
        await loadData();
      } catch (error) {
        console.error('Error adding entry:', error);
      }
    },
    [loadData]
  );

  // Add several entries in one go, then refresh the summary exactly once
  // (used by the food-picker dialog when committing a multi-item selection).
  const addEntries = useCallback(
    async (entries: Omit<Entry, 'id'>[]) => {
      try {
        await Promise.all(entries.map((entry) => storageService.addEntry(entry)));
        await loadData();
      } catch (error) {
        console.error('Error adding entries:', error);
      }
    },
    [loadData]
  );

  const updateEntry = useCallback(
    async (id: string, updates: Partial<Entry>) => {
      try {
        await storageService.updateEntry(id, updates);
        await loadData();
      } catch (error) {
        console.error('Error updating entry:', error);
      }
    },
    [loadData]
  );

  const deleteEntry = useCallback(
    async (id: string) => {
      try {
        await storageService.deleteEntry(id);
        await loadData();
      } catch (error) {
        console.error('Error deleting entry:', error);
      }
    },
    [loadData]
  );

  const updateGoal = useCallback(
    async (goal: Goal) => {
      try {
        await storageService.setGoal(goal);
        await loadData();
      } catch (error) {
        console.error('Error updating goal:', error);
      }
    },
    [loadData]
  );

  const addWater = useCallback(
    async (ml: number) => {
      try {
        await storageService.addWater(date, ml);
        await loadData();
      } catch (error) {
        console.error('Error adding water:', error);
      }
    },
    [date, loadData]
  );

  const removeLastWater = useCallback(async () => {
    if (waterLogs.length === 0) return;
    const last = waterLogs[waterLogs.length - 1];
    try {
      await storageService.deleteWaterLog(last.id);
      await loadData();
    } catch (error) {
      console.error('Error removing water log:', error);
    }
  }, [waterLogs, loadData]);

  return {
    summary,
    waterLogs,
    loading,
    addEntry,
    addEntries,
    updateEntry,
    deleteEntry,
    updateGoal,
    addWater,
    removeLastWater,
    refresh: loadData,
  };
}
