import type { PresetFood } from '@shared/foods';
import { ApiError } from './api';
import type { I18n } from './i18n';

export function portionOf(f: Pick<PresetFood, 'amount' | 'unit'>, qty: number, { t, num }: I18n): string {
  const amount = f.amount * qty;
  return `${num(amount, amount % 1 ? 1 : 0)} ${t(`unit.${f.unit}` as 'unit.g')}`;
}

export function errorText(err: unknown, { t }: I18n): string {
  if (err instanceof ApiError) return err.status === 0 ? t('common.offline') : err.message;
  return t('common.error');
}
