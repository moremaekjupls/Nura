import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { pbkdf2Sync, createHash } from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { Server } from 'http';
import { openDb } from '../server/db';
import { createApp } from '../server/app';
import { signInitData } from './helpers';
import { verifyPassword } from '../server/auth';

const BOT = '123456:TEST-token';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nura-'));
let server: Server;
let base = '';

async function call(method: string, url: string, body?: unknown, token?: string) {
  const res = await fetch(base + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

describe('migration from the v1 production schema', () => {
  it('keeps users, entries and sessions; hashes tokens; old passwords still work', async () => {
    const file = path.join(tmp, 'legacy.db');
    const old = new Database(file);
    old.exec(`
      CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')), name TEXT, height_cm REAL, weight_kg REAL, birth_year INTEGER, gender TEXT);
      CREATE TABLE sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at TEXT DEFAULT (datetime('now')), expires_at TEXT NOT NULL);
      CREATE TABLE entries (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, date TEXT NOT NULL, name TEXT NOT NULL, calories REAL NOT NULL, protein REAL NOT NULL, fat REAL NOT NULL, carbs REAL NOT NULL, meal_type TEXT, time TEXT, created_at TEXT DEFAULT (datetime('now')));
      CREATE TABLE goals (user_id TEXT PRIMARY KEY, calories REAL NOT NULL DEFAULT 2000, protein REAL NOT NULL DEFAULT 150, fat REAL NOT NULL DEFAULT 65, carbs REAL NOT NULL DEFAULT 250, updated_at TEXT, water_goal_ml REAL NOT NULL DEFAULT 2000);
    `);
    const salt = 'abcd';
    const legacyHash = `${salt}:${pbkdf2Sync('secret1', salt, 100_000, 64, 'sha512').toString('hex')}`;
    old.prepare('INSERT INTO users (id, email, password_hash, weight_kg) VALUES (?, ?, ?, ?)').run('user_old', 'old@nura.uz', legacyHash, 70);
    old.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES ('plain-token-48', 'user_old', '2099-01-01')").run();
    old.prepare("INSERT INTO entries (id, user_id, date, name, calories, protein, fat, carbs) VALUES ('e1', 'user_old', '2026-09-01', 'Плов', 650, 22, 28, 70)").run();
    old.prepare("INSERT INTO goals (user_id, calories) VALUES ('user_old', 2100)").run();
    old.close();

    const db = openDb(file);
    expect(db.pragma('user_version', { simple: true })).toBe(3);
    expect((db.prepare('SELECT COUNT(*) n FROM entries').get() as { n: number }).n).toBe(1);
    const s = db.prepare('SELECT token FROM sessions').get() as { token: string };
    expect(s.token).toBe(createHash('sha256').update('plain-token-48').digest('hex'));
    const g = db.prepare('SELECT calories, auto FROM goals').get() as { calories: number; auto: number };
    expect(g).toEqual({ calories: 2100, auto: 0 }); // existing manual goals stay manual
    expect((db.prepare('SELECT kg FROM weight_logs').get() as { kg: number }).kg).toBe(70);
    expect(db.pragma('foreign_key_check')).toEqual([]);
    const u = db.prepare('SELECT password_hash FROM users').get() as { password_hash: string };
    expect(await verifyPassword('secret1', u.password_hash)).toBe(true);
    expect(await verifyPassword('wrong', u.password_hash)).toBe(false);
    db.close();
  });
});

describe('API', () => {
  let token = '';

  beforeAll(async () => {
    const db = openDb(path.join(tmp, 'api.db'));
    const app = createApp(db, { botToken: BOT });
    await new Promise<void>((r) => { server = app.listen(0, () => r()); });
    const addr = server.address();
    base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
  });
  afterAll(() => server?.close());

  it('registers and rejects weak input', async () => {
    expect((await call('POST', '/api/auth/register', { email: 'bad', password: '12345678' })).status).toBe(400);
    expect((await call('POST', '/api/auth/register', { email: 'a@nura.uz', password: 'short' })).status).toBe(400);
    const r = await call('POST', '/api/auth/register', { email: 'A@Nura.uz', password: 'password1' });
    expect(r.status).toBe(201);
    expect(r.body.user).toMatchObject({ email: 'a@nura.uz', profileComplete: false });
    token = r.body.token;
    expect((await call('GET', '/api/auth/me', undefined, token)).body.email).toBe('a@nura.uz');
    expect((await call('GET', '/api/auth/me')).status).toBe(401);
  });

  it('validates entries instead of crashing', async () => {
    const bad = await call('POST', '/api/entries', { entries: [{ date: 'hello', name: 'x', calories: -5, protein: 1, fat: 1, carbs: 1, mealType: 'lunch' }] }, token);
    expect(bad.status).toBe(400);
    const nan = await call('POST', '/api/entries', { entries: [{ date: '2026-09-24', name: 'x', calories: 'abc', protein: 1, fat: 1, carbs: 1, mealType: 'lunch' }] }, token);
    expect(nan.status).toBe(400);
    expect((await call('PUT', '/api/goal', { calories: 0, protein: -1, fat: 1, carbs: 1 }, token)).status).toBe(400);
  });

  it('adds a batch and summarises the day', async () => {
    const r = await call('POST', '/api/entries', {
      entries: [
        { date: '2026-09-24', name: 'Самса', portion: '1 шт', calories: 290, protein: 9, fat: 18, carbs: 22, mealType: 'lunch', time: '13:10' },
        { date: '2026-09-24', name: 'Чай', calories: 40, protein: 0, fat: 0, carbs: 10, mealType: 'lunch' },
      ],
    }, token);
    expect(r.status).toBe(201);
    expect(r.body).toHaveLength(2);
    await call('POST', '/api/water', { date: '2026-09-24', ml: 250 }, token);
    const day = await call('GET', '/api/day?date=2026-09-24', undefined, token);
    expect(day.body.totals.calories).toBe(330);
    expect(day.body.water.total).toBe(250);
    expect(day.body.entries[0].portion).toBe('1 шт');
    const del = await call('DELETE', `/api/entries/${r.body[0].id}`, undefined, token);
    expect(del.status).toBe(204);
    expect((await call('GET', '/api/day?date=2026-09-24', undefined, token)).body.totals.calories).toBe(40);
  });

  it('computes an automatic goal from the profile and follows the weight log', async () => {
    const p = await call('PUT', '/api/profile', { gender: 'female', birthYear: 1997, heightCm: 165, weightKg: 64, activity: 'mid', goalMode: 'lose', autoGoal: true }, token);
    expect(p.status).toBe(200);
    expect(p.body.goal.auto).toBe(true);
    expect(p.body.goal.protein).toBe(115);
    const w = await call('POST', '/api/weight', { date: '2026-09-24', kg: 60 }, token);
    expect(w.body.goal.protein).toBe(108);
    const manual = await call('PUT', '/api/goal', { calories: 1700, protein: 110, fat: 55, carbs: 180 }, token);
    expect(manual.body.auto).toBe(false);
    const after = await call('POST', '/api/weight', { date: '2026-09-25', kg: 59.5 }, token);
    expect(after.body.goal.calories).toBe(1700); // manual goal is not overwritten
    expect((await call('GET', '/api/auth/me', undefined, token)).body.profileComplete).toBe(true);
  });

  it('history fills every day and caps the range', async () => {
    const h = await call('GET', '/api/history?from=2026-09-20&to=2026-09-26', undefined, token);
    expect(h.body.days).toHaveLength(7);
    expect(h.body.days.find((d: { date: string }) => d.date === '2026-09-24').calories).toBe(40);
    expect((await call('GET', '/api/history?from=2026-01-01&to=2026-09-26', undefined, token)).status).toBe(400);
  });

  it('logs in with Telegram and reuses the account', async () => {
    const initData = signInitData(BOT, {
      auth_date: String(Math.floor(Date.now() / 1000)),
      user: JSON.stringify({ id: 777, first_name: 'Азиз', language_code: 'uz' }),
    });
    const a = await call('POST', '/api/auth/telegram', { initData });
    expect(a.status).toBe(200);
    expect(a.body.user).toMatchObject({ telegram: true, name: 'Азиз', lang: 'uz', email: null });
    const b = await call('POST', '/api/auth/telegram', { initData });
    expect(b.body.user.id).toBe(a.body.user.id);
    expect((await call('POST', '/api/auth/telegram', { initData: initData.replace('777', '778') })).status).toBe(401);
  });

  it('links a Telegram account into an existing email account, moving its data', async () => {
    const reg = await call('POST', '/api/auth/register', { email: 'pwa@nura.uz', password: 'password1' });
    const emailToken = reg.body.token;
    await call('POST', '/api/entries', { entries: [{ date: '2026-09-20', name: 'Лагман', calories: 480, protein: 20, fat: 16, carbs: 58, mealType: 'lunch' }] }, emailToken);

    const initData = signInitData(BOT, {
      auth_date: String(Math.floor(Date.now() / 1000)),
      user: JSON.stringify({ id: 555, first_name: 'Нодира' }),
    });
    const tgToken = (await call('POST', '/api/auth/telegram', { initData })).body.token;
    await call('POST', '/api/entries', { entries: [{ date: '2026-09-21', name: 'Самса', calories: 290, protein: 9, fat: 18, carbs: 22, mealType: 'snack' }] }, tgToken);
    await call('POST', '/api/weight', { date: '2026-09-21', kg: 61 }, tgToken);

    expect((await call('POST', '/api/auth/link-email', { email: 'pwa@nura.uz', password: 'wrong' }, tgToken)).status).toBe(401);
    const link = await call('POST', '/api/auth/link-email', { email: 'pwa@nura.uz', password: 'password1' }, tgToken);
    expect(link.status).toBe(200);
    expect(link.body.user).toMatchObject({ id: reg.body.user.id, email: 'pwa@nura.uz', telegram: true });
    expect((await call('GET', '/api/auth/me', undefined, tgToken)).status).toBe(401); // old Telegram-only session is gone

    const h = await call('GET', '/api/history?from=2026-09-20&to=2026-09-21', undefined, link.body.token);
    expect(h.body.days.map((d: { calories: number }) => d.calories)).toEqual([480, 290]);
    expect((await call('GET', '/api/weight', undefined, emailToken)).body).toEqual([{ date: '2026-09-21', kg: 61 }]);
    // Next Telegram login lands in the merged account.
    expect((await call('POST', '/api/auth/telegram', { initData })).body.user.id).toBe(reg.body.user.id);
  });

  it('lets a Telegram user add email + password', async () => {
    const initData = signInitData(BOT, { auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify({ id: 556 }) });
    const tok = (await call('POST', '/api/auth/telegram', { initData })).body.token;
    expect((await call('POST', '/api/auth/set-email', { email: 'pwa@nura.uz', password: 'password1' }, tok)).status).toBe(409);
    const r = await call('POST', '/api/auth/set-email', { email: 'tg@nura.uz', password: 'password2' }, tok);
    expect(r.body.user).toMatchObject({ email: 'tg@nura.uz', telegram: true, hasPassword: true });
    expect((await call('POST', '/api/auth/login', { email: 'tg@nura.uz', password: 'password2' })).status).toBe(200);
  });

  it('unknown API route is a JSON 404; AI without key is 503', async () => {
    expect((await call('GET', '/api/nope', undefined, token)).status).toBe(404);
    expect((await call('POST', '/api/ai/text', { text: 'самса и чай' }, token)).status).toBe(503);
  });

  it('deletes the account with all data', async () => {
    expect((await call('DELETE', '/api/account', undefined, token)).status).toBe(204);
    expect((await call('GET', '/api/auth/me', undefined, token)).status).toBe(401);
    expect((await call('POST', '/api/auth/login', { email: 'a@nura.uz', password: 'password1' })).status).toBe(401);
  });
});
