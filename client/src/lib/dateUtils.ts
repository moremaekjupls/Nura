/**
 * Date utility functions for the calorie tracker
 */

/**
 * Get today's date as ISO string (YYYY-MM-DD)
 */
export function getTodayISO(): string {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

/**
 * Get yesterday's date as ISO string
 */
export function getYesterdayISO(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split('T')[0];
}

/**
 * Get tomorrow's date as ISO string
 */
export function getTomorrowISO(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
}

/**
 * Add days to a date string
 * @param dateISO ISO date string (YYYY-MM-DD)
 * @param days Number of days to add (can be negative)
 */
export function addDaysToISO(dateISO: string, days: number): string {
  const date = new Date(dateISO);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

/**
 * Format ISO date to readable string
 * @param dateISO ISO date string (YYYY-MM-DD)
 * @param locale Language locale (default: 'en-US')
 */
export function formatDate(dateISO: string, locale = 'ru-RU'): string {
  const [year, month, day] = dateISO.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format ISO date to full readable string
 * @param dateISO ISO date string (YYYY-MM-DD)
 * @param locale Language locale (default: 'en-US')
 */
export function formatDateFull(dateISO: string, locale = 'ru-RU'): string {
  const [year, month, day] = dateISO.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Check if a date is today
 */
export function isToday(dateISO: string): boolean {
  return dateISO === getTodayISO();
}

/**
 * Check if a date is in the future
 */
export function isFuture(dateISO: string): boolean {
  return dateISO > getTodayISO();
}

/**
 * Check if a date is in the past
 */
export function isPast(dateISO: string): boolean {
  return dateISO < getTodayISO();
}

/**
 * Get the day of week name
 */
export function getDayName(dateISO: string, locale = 'ru-RU'): string {
  const [year, month, day] = dateISO.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString(locale, { weekday: 'long' });
}

/**
 * Get short day name (Mon, Tue, etc.)
 */
export function getShortDayName(dateISO: string, locale = 'ru-RU'): string {
  const [year, month, day] = dateISO.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString(locale, { weekday: 'short' });
}
