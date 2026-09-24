import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { Server } from 'http';
import type Database from 'better-sqlite3';
import { openDb } from '../server/db';
import { createApp } from '../server/app';
import { Bot } from '../server/telegram';
import { createReminders, expectedWater, localTime } from '../server/reminders';
import type { Mailer } from '../server/mail';
import { signInitData } from './helpers';

const BOT = '123456:TEST-token';
const APP = 'https://nura.test';

/** Fake Telegram API: records every call, answers ok. Chat 403 simulates a blocked bot. */
const calls: { method: string; params: Record<string, unknown> }[] = [];
const fakeFetch = (async (url: string | URL | Request, init?: RequestInit) => {
  const method = String(url).split('/').pop()!;
  const params = JSON.parse(String(init?.body ?? '{}'));
  calls.push({ method, params });
  if (params.chat_id === 403) return new Response(JSON.stringify({ ok: false, error_code: 403, description: 'Forbidden: bot was blocked by the user' }));
  return new Response(JSON.stringify({ ok: true, result: method === 'getMe' ? { username: 'nura_test_bot' } : true }));
}) as typeof fetch;

const mails: { to: string; subject: string; text: string }[] = [];
const mailer: Mailer = { send: async (m) => { mails.push(m); } };

let db: Database.Database;
let server: Server;
let base = '';
const bot = new Bot(BOT, fakeFetch);
let reminders: ReturnType<typeof createReminders>;

async function call(method: string, url: string, body?: unknown, token?: string, headers: Record<string, string> = {}) {
  const res = await fetch(base + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

beforeAll(async () => {
  db = openDb(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'nura-rem-')), 'db.sqlite'));
  reminders = createReminders(db, bot, APP);
  await bot.setup(APP);
  const app = createApp(db, { botToken: BOT, appUrl: APP, mailer, bot, reminders });
  await new Promise<void>((r) => { server = app.listen(0, () => r()); });
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
});
afterAll(() => server?.close());

describe('bot setup', () => {
  it('registers webhook with a secret, commands and the Mini App menu button', () => {
    const hook = calls.find((c) => c.method === 'setWebhook')!;
    expect(hook.params.url).toBe(`${APP}/api/telegram/webhook`);
    expect(hook.params.secret_token).toBe(bot.webhookSecret);
    expect(calls.find((c) => c.method === 'setChatMenuButton')!.params).toMatchObject({ menu_button: { type: 'web_app', web_app: { url: APP } } });
    expect(bot.username).toBe('nura_test_bot');
  });
});

describe('password reset', () => {
  it('emails a one-time link and resets the password', async () => {
    await call('POST', '/api/auth/register', { email: 'reset@nura.uz', password: 'oldpassword' });
    expect((await call('POST', '/api/auth/forgot', { email: 'nobody@nura.uz' })).status).toBe(204); // no enumeration
    expect(mails).toHaveLength(0);
    expect((await call('POST', '/api/auth/forgot', { email: 'Reset@nura.uz', lang: 'ru' })).status).toBe(204);
    expect(mails).toHaveLength(1);
    const token = /#token=([\w-]+)/.exec(mails[0].text)![1];
    expect(mails[0].text).toContain(`${APP}/reset#token=`);

    expect((await call('POST', '/api/auth/reset', { token: 'x'.repeat(40), password: 'newpassword' })).status).toBe(400);
    const r = await call('POST', '/api/auth/reset', { token, password: 'newpassword' });
    expect(r.status).toBe(200);
    expect(r.body.user.email).toBe('reset@nura.uz');
    expect((await call('POST', '/api/auth/reset', { token, password: 'another1' })).status).toBe(400); // single use
    expect((await call('POST', '/api/auth/login', { email: 'reset@nura.uz', password: 'oldpassword' })).status).toBe(401);
    expect((await call('POST', '/api/auth/login', { email: 'reset@nura.uz', password: 'newpassword' })).status).toBe(200);
  });
});

describe('reminders', () => {
  let token = '';
  let userId = '';
  const tgId = 424242;

  it('webhook rejects requests without the secret', async () => {
    expect((await call('POST', '/api/telegram/webhook', { message: {} })).status).toBe(403);
  });

  it('/start via webhook marks the chat writable and replies with the Mini App button', async () => {
    const initData = signInitData(BOT, { auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify({ id: tgId, first_name: 'Лола' }) });
    const r = await call('POST', '/api/auth/telegram', { initData });
    token = r.body.token;
    userId = r.body.user.id;
    expect((await call('GET', '/api/reminders', undefined, token)).body).toMatchObject({ telegram: true, canWrite: false, available: true });

    calls.length = 0;
    const res = await call('POST', '/api/telegram/webhook', { message: { chat: { id: tgId, type: 'private' }, from: { id: tgId }, text: '/start' } }, undefined,
      { 'X-Telegram-Bot-Api-Secret-Token': bot.webhookSecret });
    expect(res.status).toBe(200);
    await new Promise((r) => setTimeout(r, 50));
    const sent = calls.find((c) => c.method === 'sendMessage')!;
    expect(sent.params.chat_id).toBe(tgId);
    expect(JSON.stringify(sent.params.reply_markup)).toContain(APP);
    expect((await call('GET', '/api/reminders', undefined, token)).body.canWrite).toBe(true);
  });

  it('email-only users cannot turn reminders on', async () => {
    const r = await call('POST', '/api/auth/register', { email: 'pwa-only@nura.uz', password: 'password1' });
    expect((await call('PUT', '/api/reminders', { water: true }, r.body.token)).status).toBe(400);
  });

  it('sends a lunch reminder only when lunch is not logged, once per day', async () => {
    await call('PUT', '/api/reminders', { meals: true }, token);
    const at1340 = new Date('2026-09-24T08:40:00Z'); // 13:40 in Tashkent
    calls.length = 0;
    expect(await reminders.tick(at1340)).toEqual([`${userId}:lunch`]);
    expect(await reminders.tick(new Date('2026-09-24T08:50:00Z'))).toEqual([]); // already sent today
    expect(String(calls[0].params.text)).toContain('обед');

    await call('POST', '/api/entries', { entries: [{ date: '2026-09-24', name: 'Плов', calories: 650, protein: 22, fat: 28, carbs: 70, mealType: 'dinner' }] }, token);
    expect(await reminders.tick(new Date('2026-09-24T14:35:00Z'))).toEqual([]); // 19:35, dinner already logged
  });

  it('water reminder fires only when behind pace, and its button logs water', async () => {
    await call('PUT', '/api/reminders', { meals: false, water: true }, token);
    await call('POST', '/api/water', { date: '2026-09-24', ml: 1000 }, token);
    expect(await reminders.tick(new Date('2026-09-24T06:05:00Z'))).toEqual([]); // 11:05, 1 l drunk — on pace
    calls.length = 0;
    expect(await reminders.tick(new Date('2026-09-24T12:10:00Z'))).toEqual([`${userId}:water-17`]); // 17:10, behind
    const msg = calls.find((c) => c.method === 'sendMessage')!;
    expect(String(msg.params.text)).toContain('<b>1</b> из 2 л');
    expect(JSON.stringify(msg.params.reply_markup)).toContain('w:250:2026-09-24');

    calls.length = 0;
    await call('POST', '/api/telegram/webhook', {
      callback_query: { id: 'cb1', from: { id: tgId }, data: 'w:500:2026-09-24', message: { message_id: 7, chat: { id: tgId } } },
    }, undefined, { 'X-Telegram-Bot-Api-Secret-Token': bot.webhookSecret });
    await new Promise((r) => setTimeout(r, 50));
    const day = await call('GET', '/api/day?date=2026-09-24', undefined, token);
    expect(day.body.water.total).toBe(1500);
    expect(calls.map((c) => c.method)).toEqual(['answerCallbackQuery', 'editMessageText']);
    expect(String(calls[1].params.text)).toContain('<b>1,5</b> из 2 л');
  });

  it('/stop turns reminders off; a blocked chat is not messaged again', async () => {
    await call('POST', '/api/telegram/webhook', { message: { chat: { id: tgId, type: 'private' }, from: { id: tgId }, text: '/stop' } }, undefined,
      { 'X-Telegram-Bot-Api-Secret-Token': bot.webhookSecret });
    await new Promise((r) => setTimeout(r, 50));
    expect((await call('GET', '/api/reminders', undefined, token)).body).toMatchObject({ meals: false, water: false });

    // A user whose chat returns 403 gets marked blocked after the first failed send.
    db.prepare("INSERT INTO users (id, telegram_id, lang) VALUES ('u403', 403, 'ru')").run();
    db.prepare("UPDATE users SET remind_meals = 1 WHERE id = 'u403'").run();
    db.prepare('INSERT INTO telegram_chats (telegram_id) VALUES (403)').run();
    await reminders.tick(new Date('2026-09-25T04:40:00Z')); // 09:40 breakfast
    expect((db.prepare('SELECT blocked FROM telegram_chats WHERE telegram_id = 403').get() as { blocked: number }).blocked).toBe(1);
    expect(await reminders.tick(new Date('2026-09-25T08:40:00Z'))).toEqual([]);
  });
});

describe('helpers', () => {
  it('local time in the user zone and the water pace', () => {
    expect(localTime('Asia/Tashkent', new Date('2026-09-24T19:30:00Z'))).toEqual({ date: '2026-09-25', minutes: 30 });
    expect(expectedWater(2000, 8 * 60)).toBe(0);
    expect(expectedWater(2000, 21 * 60)).toBe(2000);
    expect(Math.round(expectedWater(2000, 14 * 60 + 30))).toBe(1000);
  });
});
