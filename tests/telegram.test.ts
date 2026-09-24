import { describe, expect, it } from 'vitest';
import { verifyTelegramInitData } from '../server/auth';
import { signInitData } from './helpers';

const TOKEN = '123456:TEST-token';
const now = 1_790_000_000;
const user = JSON.stringify({ id: 42, first_name: 'Мадина', language_code: 'uz' });

describe('verifyTelegramInitData', () => {
  it('accepts correctly signed data', () => {
    const data = signInitData(TOKEN, { auth_date: String(now - 60), query_id: 'AAE', user });
    expect(verifyTelegramInitData(data, TOKEN, 86400, now)).toMatchObject({ id: 42, first_name: 'Мадина' });
  });
  it('rejects a wrong bot token', () => {
    const data = signInitData('other:token', { auth_date: String(now), user });
    expect(verifyTelegramInitData(data, TOKEN, 86400, now)).toBeNull();
  });
  it('rejects tampered fields', () => {
    const data = signInitData(TOKEN, { auth_date: String(now), user }).replace('42', '43');
    expect(verifyTelegramInitData(data, TOKEN, 86400, now)).toBeNull();
  });
  it('rejects stale data', () => {
    const data = signInitData(TOKEN, { auth_date: String(now - 2 * 86400), user });
    expect(verifyTelegramInitData(data, TOKEN, 86400, now)).toBeNull();
  });
});
