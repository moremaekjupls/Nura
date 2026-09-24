import { createHash, createHmac, pbkdf2, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const pbkdf2Async = promisify(pbkdf2);

// ---------------------------------------------------------------------------
// Passwords. New hashes: "pbkdf2$<iterations>$<salt>$<hash>".
// Legacy hashes from v1: "<salt>:<hash>" at 100k iterations — still verified.
// Async so a login doesn't block the event loop for ~100 ms.
// ---------------------------------------------------------------------------

const ITERATIONS = 310_000;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const hash = (await pbkdf2Async(password, salt, ITERATIONS, 64, 'sha512')).toString('hex');
  return `pbkdf2$${ITERATIONS}$${salt}$${hash}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  let salt: string, hash: string, iterations: number;
  if (stored.startsWith('pbkdf2$')) {
    const [, it, s, h] = stored.split('$');
    iterations = Number(it); salt = s; hash = h;
  } else {
    [salt, hash] = stored.split(':');
    iterations = 100_000;
  }
  if (!salt || !hash || !iterations) return false;
  const verify = (await pbkdf2Async(password, salt, iterations, 64, 'sha512')).toString('hex');
  return safeEqual(hash, verify);
}

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

// ---------------------------------------------------------------------------
// Session tokens: the client holds a random token, the DB only its SHA-256,
// so a leaked backup can't be replayed as live sessions.
// ---------------------------------------------------------------------------

export function newSessionToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// ---------------------------------------------------------------------------
// Telegram Mini App init data verification
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
// ---------------------------------------------------------------------------

export interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export function verifyTelegramInitData(
  initData: string,
  botToken: string,
  maxAgeSec = 24 * 60 * 60,
  nowSec = Math.floor(Date.now() / 1000),
): TelegramUser | null {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = createHmac('sha256', secret).update(dataCheckString).digest('hex');
  if (!safeEqual(expected, hash)) return null;

  const authDate = Number(params.get('auth_date'));
  if (!authDate || nowSec - authDate > maxAgeSec) return null;

  try {
    const user = JSON.parse(params.get('user') || 'null') as TelegramUser | null;
    return user && typeof user.id === 'number' ? user : null;
  } catch {
    return null;
  }
}
