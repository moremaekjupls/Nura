import express, { NextFunction, Request, RequestHandler, Response } from 'express';
import type Database from 'better-sqlite3';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import {
  aiPhotoInput, aiTextInput, credentials, entryBatch, entryPatch, goalInput, isoDate, loginInput,
  passwordChange, profileInput, telegramAuthInput, waterInput, weightInput,
} from '../shared/schemas.js';
import { calcGoal, calcWater, isBodyProfileComplete, type BodyProfile, type Goal } from '../shared/nutrition.js';
import { hashPassword, hashToken, newSessionToken, safeEqual, verifyPassword, verifyTelegramInitData } from './auth.js';
import { AiError, recognize } from './ai.js';

declare global {
  namespace Express {
    interface Request {
      userId: string;
    }
  }
}

export interface AppOptions {
  botToken?: string;
  geminiKey?: string;
  adminKey?: string;
  production?: boolean;
  runBackup?: () => Promise<string | null>;
}

export const AUTH_COOKIE = 'ct_auth';
const SESSION_DAYS = 180;
const AI_DAILY_LIMIT = 30;
const TZ = 'Asia/Tashkent';

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const r = schema.safeParse(data);
  if (!r.success) {
    const issue = r.error.issues[0];
    const field = issue?.path.join('.');
    throw new HttpError(400, field ? `${field}: ${issue.message}` : issue?.message || 'Некорректные данные');
  }
  return r.data;
}

/** Express 4 does not catch rejected promises — forward them to the error handler. */
const h = (fn: (req: Request, res: Response) => unknown): RequestHandler => (req, res, next) => {
  Promise.resolve()
    .then(() => fn(req, res))
    .catch(next);
};

/** Today's date in Tashkent, for per-day quotas that must not depend on the server's TZ. */
function todayTashkent(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

const r1 = (n: number) => Math.round(n * 10) / 10;

// ---------------------------------------------------------------------------

export function createApp(db: Database.Database, opts: AppOptions = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // -------------------------------------------------------------------------
  // Statements
  // -------------------------------------------------------------------------

  const q = {
    userById: db.prepare('SELECT * FROM users WHERE id = ?'),
    userByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
    userByTelegram: db.prepare('SELECT * FROM users WHERE telegram_id = ?'),
    insertUser: db.prepare(
      `INSERT INTO users (id, email, password_hash, telegram_id, name, lang)
       VALUES (@id, @email, @password_hash, @telegram_id, @name, @lang)`,
    ),
    insertSession: db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)'),
    session: db.prepare("SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime('now')"),
    deleteSession: db.prepare('DELETE FROM sessions WHERE token = ?'),

    goal: db.prepare('SELECT * FROM goals WHERE user_id = ?'),
    upsertGoal: db.prepare(
      `INSERT INTO goals (user_id, calories, protein, fat, carbs, water_goal_ml, auto)
       VALUES (@user_id, @calories, @protein, @fat, @carbs, @water, @auto)
       ON CONFLICT(user_id) DO UPDATE SET calories=excluded.calories, protein=excluded.protein,
         fat=excluded.fat, carbs=excluded.carbs, water_goal_ml=excluded.water_goal_ml,
         auto=excluded.auto, updated_at=datetime('now')`,
    ),

    entriesForDate: db.prepare(
      "SELECT * FROM entries WHERE user_id = ? AND date = ? ORDER BY COALESCE(time, '99:99'), created_at, id",
    ),
    entry: db.prepare('SELECT * FROM entries WHERE id = ? AND user_id = ?'),
    insertEntry: db.prepare(
      `INSERT INTO entries (id, user_id, date, name, portion, calories, protein, fat, carbs, meal_type, time)
       VALUES (@id, @user_id, @date, @name, @portion, @calories, @protein, @fat, @carbs, @meal_type, @time)`,
    ),
    updateEntry: db.prepare(
      `UPDATE entries SET date=@date, name=@name, portion=@portion, calories=@calories, protein=@protein,
         fat=@fat, carbs=@carbs, meal_type=@meal_type, time=@time WHERE id=@id AND user_id=@user_id`,
    ),
    deleteEntry: db.prepare('DELETE FROM entries WHERE id = ? AND user_id = ?'),

    waterForDate: db.prepare('SELECT id, ml, created_at FROM water_logs WHERE user_id = ? AND date = ? ORDER BY created_at, id'),
    insertWater: db.prepare('INSERT INTO water_logs (id, user_id, date, ml) VALUES (?, ?, ?, ?)'),
    deleteWater: db.prepare('DELETE FROM water_logs WHERE id = ? AND user_id = ?'),

    weights: db.prepare('SELECT date, kg FROM weight_logs WHERE user_id = ? AND date >= ? ORDER BY date'),
    upsertWeight: db.prepare(
      `INSERT INTO weight_logs (user_id, date, kg) VALUES (?, ?, ?)
       ON CONFLICT(user_id, date) DO UPDATE SET kg = excluded.kg, created_at = datetime('now')`,
    ),
    deleteWeight: db.prepare('DELETE FROM weight_logs WHERE user_id = ? AND date = ?'),
    latestWeight: db.prepare('SELECT kg FROM weight_logs WHERE user_id = ? ORDER BY date DESC LIMIT 1'),
    setUserWeight: db.prepare('UPDATE users SET weight_kg = ? WHERE id = ?'),

    historyEntries: db.prepare(
      `SELECT date, SUM(calories) calories, SUM(protein) protein, SUM(fat) fat, SUM(carbs) carbs, COUNT(*) n
       FROM entries WHERE user_id = ? AND date BETWEEN ? AND ? GROUP BY date`,
    ),
    historyWater: db.prepare(
      'SELECT date, SUM(ml) ml FROM water_logs WHERE user_id = ? AND date BETWEEN ? AND ? GROUP BY date',
    ),
    frequent: db.prepare(
      `SELECT e.name, e.portion, e.calories, e.protein, e.fat, e.carbs, e.meal_type, g.cnt
       FROM entries e
       JOIN (SELECT name, COUNT(*) cnt, MAX(created_at) last FROM entries
             WHERE user_id = ? AND date >= ? GROUP BY name) g
         ON g.name = e.name AND e.created_at = g.last
       WHERE e.user_id = ? ORDER BY g.cnt DESC, g.last DESC LIMIT 24`,
    ),

    rate: db.prepare('SELECT count, reset_at FROM rate_limits WHERE key = ?'),
    upsertRate: db.prepare(
      `INSERT INTO rate_limits (key, count, reset_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET count = excluded.count, reset_at = excluded.reset_at`,
    ),
    aiUsage: db.prepare('SELECT count FROM ai_usage WHERE user_id = ? AND date = ?'),
    bumpAi: db.prepare(
      `INSERT INTO ai_usage (user_id, date, count) VALUES (?, ?, 1)
       ON CONFLICT(user_id, date) DO UPDATE SET count = count + 1`,
    ),
  };

  type UserRow = {
    id: string; email: string | null; password_hash: string | null; telegram_id: number | null; name: string | null;
    gender: BodyProfile['gender'] | null; birth_year: number | null; height_cm: number | null; weight_kg: number | null;
    activity: BodyProfile['activity'] | null; goal_mode: BodyProfile['goalMode'] | null; lang: 'ru' | 'uz';
  };
  type EntryRow = {
    id: string; date: string; name: string; portion: string | null; calories: number; protein: number;
    fat: number; carbs: number; meal_type: string | null; time: string | null;
  };

  const getUser = (id: string) => q.userById.get(id) as UserRow | undefined;

  const bodyOf = (u: UserRow): Partial<BodyProfile> => ({
    gender: u.gender ?? undefined, birthYear: u.birth_year ?? undefined, heightCm: u.height_cm ?? undefined,
    weightKg: u.weight_kg ?? undefined, activity: u.activity ?? undefined, goalMode: u.goal_mode ?? undefined,
  });

  const me = (u: UserRow) => ({
    id: u.id,
    email: u.email,
    telegram: u.telegram_id != null,
    hasPassword: !!u.password_hash,
    name: u.name,
    lang: u.lang,
    profileComplete: isBodyProfileComplete(bodyOf(u)),
  });

  const profileOf = (u: UserRow) => ({
    name: u.name, gender: u.gender, birthYear: u.birth_year, heightCm: u.height_cm, weightKg: u.weight_kg,
    activity: u.activity, goalMode: u.goal_mode, lang: u.lang, email: u.email, telegram: u.telegram_id != null,
  });

  function goalOf(userId: string): Goal {
    const g = q.goal.get(userId) as
      | { calories: number; protein: number; fat: number; carbs: number; water_goal_ml: number; auto: number }
      | undefined;
    if (!g) return { calories: 2000, protein: 100, fat: 65, carbs: 250, water: 2000, auto: true };
    return { calories: g.calories, protein: g.protein, fat: g.fat, carbs: g.carbs, water: g.water_goal_ml, auto: !!g.auto };
  }

  /** Recompute an auto goal from the profile; no-op for manual goals or incomplete profiles. */
  function refreshAutoGoal(userId: string): Goal {
    const goal = goalOf(userId);
    const u = getUser(userId);
    const body = u ? bodyOf(u) : {};
    if (goal.auto && isBodyProfileComplete(body)) {
      const m = calcGoal(body);
      q.upsertGoal.run({ user_id: userId, ...m, water: calcWater(body.weightKg), auto: 1 });
      return goalOf(userId);
    }
    return goal;
  }

  const entryOut = (e: EntryRow) => ({
    id: e.id, date: e.date, name: e.name, portion: e.portion, calories: e.calories, protein: e.protein,
    fat: e.fat, carbs: e.carbs, mealType: e.meal_type ?? 'snack', time: e.time,
  });

  // -------------------------------------------------------------------------
  // Middleware
  // -------------------------------------------------------------------------

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "script-src 'self' https://telegram.org",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "connect-src 'self'",
        // Telegram Web opens Mini Apps in an iframe; mobile clients use a webview.
        'frame-ancestors https://web.telegram.org https://*.telegram.org',
      ].join('; '),
    );
    if (opts.production) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    next();
  });

  app.use('/api/ai/photo', express.json({ limit: '5mb' }));
  app.use(express.json({ limit: '100kb' }));

  function rateLimit(bucket: string, max: number, windowMs: number): RequestHandler {
    return (req, res, next) => {
      const key = `${bucket}:${req.ip || 'unknown'}`;
      const now = Date.now();
      const row = q.rate.get(key) as { count: number; reset_at: number } | undefined;
      if (!row || row.reset_at < now) {
        q.upsertRate.run(key, 1, now + windowMs);
        return next();
      }
      if (row.count >= max) {
        res.status(429).json({ error: 'Слишком много попыток. Попробуйте позже' });
        return;
      }
      q.upsertRate.run(key, row.count + 1, row.reset_at);
      next();
    };
  }
  const authLimit = rateLimit('auth', 20, 15 * 60 * 1000);

  function readToken(req: Request): string | null {
    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer ')) return auth.slice(7).trim() || null;
    const cookie = req.headers.cookie
      ?.split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${AUTH_COOKIE}=`));
    return cookie ? decodeURIComponent(cookie.slice(AUTH_COOKIE.length + 1)) : null;
  }

  function startSession(res: Response, userId: string): string {
    const { token, hash } = newSessionToken();
    const expires = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString().replace('T', ' ').slice(0, 19);
    q.insertSession.run(hash, userId, expires);
    const secure = opts.production ? '; Secure' : '';
    // Lax cookie for the PWA. Inside Telegram (incl. the Telegram Web iframe, where a Lax
    // cookie is not sent) the client uses the returned token as a Bearer header instead.
    res.setHeader('Set-Cookie', `${AUTH_COOKIE}=${token}; Max-Age=${SESSION_DAYS * 86400}; Path=/; HttpOnly; SameSite=Lax${secure}`);
    return token;
  }

  const requireAuth: RequestHandler = (req, res, next) => {
    const token = readToken(req);
    const row = token ? (q.session.get(hashToken(token)) as { user_id: string } | undefined) : undefined;
    if (!row) {
      res.status(401).json({ error: 'Требуется вход' });
      return;
    }
    req.userId = row.user_id;
    next();
  };

  // -------------------------------------------------------------------------
  // Auth
  // -------------------------------------------------------------------------

  app.post('/api/auth/register', authLimit, h(async (req, res) => {
    const { email, password } = parse(credentials, req.body);
    if (q.userByEmail.get(email)) throw new HttpError(409, 'Этот email уже зарегистрирован');
    const id = `user_${nanoid(12)}`;
    q.insertUser.run({ id, email, password_hash: await hashPassword(password), telegram_id: null, name: null, lang: 'ru' });
    const token = startSession(res, id);
    res.status(201).json({ user: me(getUser(id)!), token });
  }));

  app.post('/api/auth/login', authLimit, h(async (req, res) => {
    const { email, password } = parse(loginInput, req.body);
    const u = q.userByEmail.get(email) as UserRow | undefined;
    if (!u || !(await verifyPassword(password, u.password_hash))) throw new HttpError(401, 'Неверный email или пароль');
    const token = startSession(res, u.id);
    res.json({ user: me(u), token });
  }));

  app.post('/api/auth/telegram', authLimit, h((req, res) => {
    if (!opts.botToken) throw new HttpError(503, 'Вход через Telegram не настроен');
    const { initData } = parse(telegramAuthInput, req.body);
    const tg = verifyTelegramInitData(initData, opts.botToken);
    if (!tg) throw new HttpError(401, 'Не удалось подтвердить данные Telegram');
    let u = q.userByTelegram.get(tg.id) as UserRow | undefined;
    if (!u) {
      const id = `user_${nanoid(12)}`;
      q.insertUser.run({
        id, email: null, password_hash: null, telegram_id: tg.id,
        name: [tg.first_name, tg.last_name].filter(Boolean).join(' ').slice(0, 60) || null,
        lang: tg.language_code === 'uz' ? 'uz' : 'ru',
      });
      u = getUser(id)!;
    }
    const token = startSession(res, u.id);
    res.json({ user: me(u), token });
  }));

  app.post('/api/auth/logout', (req, res) => {
    const token = readToken(req);
    if (token) q.deleteSession.run(hashToken(token));
    res.setHeader('Set-Cookie', `${AUTH_COOKIE}=; Max-Age=0; Path=/; HttpOnly`);
    res.status(204).end();
  });

  // -------------------------------------------------------------------------
  // Admin (key in a header, never in the URL where proxies would log it)
  // -------------------------------------------------------------------------

  const requireAdmin: RequestHandler = (req, res, next) => {
    const key = req.header('x-admin-key') || '';
    if (!opts.adminKey || !safeEqual(key, opts.adminKey)) {
      res.status(403).json({ error: 'Доступ запрещён' });
      return;
    }
    next();
  };

  app.get('/api/admin/stats', rateLimit('admin', 20, 15 * 60 * 1000), requireAdmin, (_req, res) => {
    const one = (sql: string) => (db.prepare(sql).get() as { n: number }).n;
    res.json({
      users: one('SELECT COUNT(*) n FROM users'),
      telegramUsers: one('SELECT COUNT(*) n FROM users WHERE telegram_id IS NOT NULL'),
      activeLast7d: one("SELECT COUNT(DISTINCT user_id) n FROM entries WHERE created_at >= datetime('now','-7 days')"),
      entries: one('SELECT COUNT(*) n FROM entries'),
    });
  });

  app.get('/api/admin/backup', rateLimit('admin', 20, 15 * 60 * 1000), requireAdmin, h(async (_req, res) => {
    const dest = opts.runBackup ? await opts.runBackup() : null;
    if (!dest) throw new HttpError(500, 'Не удалось создать бэкап');
    res.download(dest);
  }));

  // -------------------------------------------------------------------------
  // Everything below requires a session
  // -------------------------------------------------------------------------

  app.use('/api', requireAuth);

  app.get('/api/auth/me', (req, res) => {
    const u = getUser(req.userId);
    if (!u) throw new HttpError(401, 'Требуется вход');
    res.json(me(u));
  });

  app.post('/api/auth/password', authLimit, h(async (req, res) => {
    const { current, next } = parse(passwordChange, req.body);
    const u = getUser(req.userId)!;
    if (u.password_hash && !(await verifyPassword(current, u.password_hash))) throw new HttpError(400, 'Текущий пароль неверный');
    if (!u.email) throw new HttpError(400, 'Сначала укажите email');
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(await hashPassword(next), u.id);
    // Log out every other device.
    const token = readToken(req);
    db.prepare('DELETE FROM sessions WHERE user_id = ? AND token != ?').run(u.id, token ? hashToken(token) : '');
    res.status(204).end();
  }));

  app.delete('/api/account', (req, res) => {
    const id = req.userId;
    db.transaction(() => {
      for (const t of ['entries', 'water_logs', 'weight_logs', 'goals', 'ai_usage', 'sessions']) {
        db.prepare(`DELETE FROM ${t} WHERE user_id = ?`).run(id);
      }
      db.prepare('DELETE FROM users WHERE id = ?').run(id);
    })();
    res.setHeader('Set-Cookie', `${AUTH_COOKIE}=; Max-Age=0; Path=/; HttpOnly`);
    res.status(204).end();
  });

  app.get('/api/export', (req, res) => {
    const u = getUser(req.userId)!;
    const all = (t: string, cols = '*') => db.prepare(`SELECT ${cols} FROM ${t} WHERE user_id = ? ORDER BY date`).all(u.id);
    res.setHeader('Content-Disposition', 'attachment; filename="nura-export.json"');
    res.json({
      exportedAt: new Date().toISOString(),
      profile: profileOf(u),
      goal: goalOf(u.id),
      entries: (all('entries') as EntryRow[]).map(entryOut),
      water: all('water_logs', 'date, ml, created_at'),
      weight: all('weight_logs', 'date, kg'),
    });
  });

  // -------------------------------------------------------------------------
  // Profile & goal
  // -------------------------------------------------------------------------

  app.get('/api/profile', (req, res) => {
    res.json({ profile: profileOf(getUser(req.userId)!), goal: goalOf(req.userId) });
  });

  app.put('/api/profile', (req, res) => {
    const p = parse(profileInput, req.body);
    const map: Record<string, string> = {
      name: 'name', gender: 'gender', birthYear: 'birth_year', heightCm: 'height_cm', weightKg: 'weight_kg',
      activity: 'activity', goalMode: 'goal_mode', lang: 'lang',
    };
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const [k, col] of Object.entries(map)) {
      const v = (p as Record<string, unknown>)[k];
      if (v === undefined || (k === 'lang' && v === null)) continue;
      sets.push(`${col} = ?`);
      vals.push(v);
    }
    db.transaction(() => {
      if (sets.length) db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...vals, req.userId);
      if (p.autoGoal !== undefined) {
        const g = goalOf(req.userId);
        q.upsertGoal.run({ user_id: req.userId, ...g, auto: p.autoGoal ? 1 : 0 });
      }
    })();
    const goal = refreshAutoGoal(req.userId);
    res.json({ profile: profileOf(getUser(req.userId)!), goal });
  });

  app.put('/api/goal', (req, res) => {
    const g = parse(goalInput, req.body);
    const current = goalOf(req.userId);
    q.upsertGoal.run({ user_id: req.userId, ...g, water: g.water ?? current.water, auto: 0 });
    res.json(goalOf(req.userId));
  });

  // -------------------------------------------------------------------------
  // Day: entries + water + goal in one request
  // -------------------------------------------------------------------------

  app.get('/api/day', (req, res) => {
    const date = parse(isoDate, req.query.date);
    const entries = (q.entriesForDate.all(req.userId, date) as EntryRow[]).map(entryOut);
    const water = q.waterForDate.all(req.userId, date) as { id: string; ml: number }[];
    const totals = entries.reduce(
      (a, e) => ({ calories: a.calories + e.calories, protein: a.protein + e.protein, fat: a.fat + e.fat, carbs: a.carbs + e.carbs }),
      { calories: 0, protein: 0, fat: 0, carbs: 0 },
    );
    res.json({
      date,
      entries,
      totals: { calories: Math.round(totals.calories), protein: r1(totals.protein), fat: r1(totals.fat), carbs: r1(totals.carbs) },
      water: { logs: water.map((w) => ({ id: w.id, ml: w.ml })), total: water.reduce((a, w) => a + w.ml, 0) },
      goal: goalOf(req.userId),
    });
  });

  app.post('/api/entries', (req, res) => {
    const { entries } = parse(entryBatch, req.body);
    const stamp = Date.now();
    const ids = entries.map((_, i) => `entry_${stamp}_${i}_${nanoid(6)}`);
    db.transaction(() => {
      entries.forEach((e, i) =>
        q.insertEntry.run({
          id: ids[i], user_id: req.userId, date: e.date, name: e.name, portion: e.portion ?? null,
          calories: Math.round(e.calories), protein: r1(e.protein), fat: r1(e.fat), carbs: r1(e.carbs),
          meal_type: e.mealType, time: e.time ?? null,
        }),
      );
    })();
    res.status(201).json(ids.map((id) => entryOut(q.entry.get(id, req.userId) as EntryRow)));
  });

  app.put('/api/entries/:id', (req, res) => {
    const cur = q.entry.get(req.params.id, req.userId) as EntryRow | undefined;
    if (!cur) throw new HttpError(404, 'Запись не найдена');
    const p = parse(entryPatch, req.body);
    q.updateEntry.run({
      id: cur.id, user_id: req.userId, date: p.date ?? cur.date, name: p.name ?? cur.name,
      portion: p.portion !== undefined ? p.portion : cur.portion,
      calories: p.calories ?? cur.calories, protein: p.protein ?? cur.protein, fat: p.fat ?? cur.fat,
      carbs: p.carbs ?? cur.carbs, meal_type: p.mealType ?? cur.meal_type, time: p.time !== undefined ? p.time : cur.time,
    });
    res.json(entryOut(q.entry.get(cur.id, req.userId) as EntryRow));
  });

  app.delete('/api/entries/:id', (req, res) => {
    if (q.deleteEntry.run(req.params.id, req.userId).changes === 0) throw new HttpError(404, 'Запись не найдена');
    res.status(204).end();
  });

  app.post('/api/water', (req, res) => {
    const { date, ml } = parse(waterInput, req.body);
    const id = `water_${Date.now()}_${nanoid(6)}`;
    q.insertWater.run(id, req.userId, date, ml);
    res.status(201).json({ id, ml });
  });

  app.delete('/api/water/:id', (req, res) => {
    if (q.deleteWater.run(req.params.id, req.userId).changes === 0) throw new HttpError(404, 'Запись не найдена');
    res.status(204).end();
  });

  // -------------------------------------------------------------------------
  // Weight
  // -------------------------------------------------------------------------

  app.get('/api/weight', (req, res) => {
    const from = req.query.from ? parse(isoDate, req.query.from) : '0000-00-00';
    res.json(q.weights.all(req.userId, from));
  });

  app.post('/api/weight', (req, res) => {
    const { date, kg } = parse(weightInput, req.body);
    db.transaction(() => {
      q.upsertWeight.run(req.userId, date, kg);
      const latest = q.latestWeight.get(req.userId) as { kg: number };
      q.setUserWeight.run(latest.kg, req.userId);
    })();
    res.status(201).json({ date, kg, goal: refreshAutoGoal(req.userId) });
  });

  app.delete('/api/weight/:date', (req, res) => {
    const date = parse(isoDate, req.params.date);
    q.deleteWeight.run(req.userId, date);
    const latest = q.latestWeight.get(req.userId) as { kg: number } | undefined;
    if (latest) q.setUserWeight.run(latest.kg, req.userId);
    res.json({ goal: refreshAutoGoal(req.userId) });
  });

  // -------------------------------------------------------------------------
  // History & foods
  // -------------------------------------------------------------------------

  app.get('/api/history', (req, res) => {
    const from = parse(isoDate, req.query.from);
    const to = parse(isoDate, req.query.to);
    if (from > to || addDays(from, 120) < to) throw new HttpError(400, 'Диапазон — до 120 дней');
    const food = new Map((q.historyEntries.all(req.userId, from, to) as { date: string }[]).map((r) => [r.date, r]));
    const water = new Map((q.historyWater.all(req.userId, from, to) as { date: string; ml: number }[]).map((r) => [r.date, r.ml]));
    const out = [];
    for (let d = from; d <= to; d = addDays(d, 1)) {
      const f = food.get(d) as { calories: number; protein: number; fat: number; carbs: number; n: number } | undefined;
      out.push({
        date: d,
        calories: Math.round(f?.calories ?? 0), protein: r1(f?.protein ?? 0), fat: r1(f?.fat ?? 0), carbs: r1(f?.carbs ?? 0),
        entries: f?.n ?? 0,
        water: water.get(d) ?? 0,
      });
    }
    res.json({ days: out, goal: goalOf(req.userId) });
  });

  app.get('/api/foods/frequent', (req, res) => {
    const since = addDays(todayTashkent(), -60);
    const rows = q.frequent.all(req.userId, since, req.userId) as (EntryRow & { cnt: number })[];
    const seen = new Set<string>();
    res.json(
      rows
        .filter((r) => !seen.has(r.name) && seen.add(r.name))
        .map((r) => ({ name: r.name, portion: r.portion, calories: r.calories, protein: r.protein, fat: r.fat, carbs: r.carbs, count: r.cnt })),
    );
  });

  // -------------------------------------------------------------------------
  // AI recognition (shared Gemini quota → per-user daily cap)
  // -------------------------------------------------------------------------

  function spendAi(userId: string) {
    if (!opts.geminiKey) throw new HttpError(503, 'Распознавание не настроено');
    const day = todayTashkent();
    const used = (q.aiUsage.get(userId, day) as { count: number } | undefined)?.count ?? 0;
    if (used >= AI_DAILY_LIMIT) throw new HttpError(429, `Лимит распознаваний на сегодня (${AI_DAILY_LIMIT}) исчерпан`);
    q.bumpAi.run(userId, day);
    return opts.geminiKey;
  }

  app.post('/api/ai/photo', h(async (req, res) => {
    const input = parse(aiPhotoInput, req.body);
    const key = spendAi(req.userId);
    res.json(await recognize(key, { kind: 'photo', image: input.image, mediaType: input.mediaType }, input.lang));
  }));

  app.post('/api/ai/text', h(async (req, res) => {
    const input = parse(aiTextInput, req.body);
    const key = spendAi(req.userId);
    res.json(await recognize(key, { kind: 'text', text: input.text }, input.lang));
  }));

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Не найдено' });
  });

  // -------------------------------------------------------------------------
  // Errors
  // -------------------------------------------------------------------------

  app.use('/api', (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError || err instanceof AiError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    if ((err as { type?: string }).type === 'entity.too.large') {
      res.status(413).json({ error: 'Слишком большой запрос' });
      return;
    }
    if ((err as { type?: string }).type === 'entity.parse.failed') {
      res.status(400).json({ error: 'Некорректный JSON' });
      return;
    }
    console.error('[api] unhandled:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  });

  return app;
}
