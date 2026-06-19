import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { nanoid } from 'nanoid';
import db from './db.js';
import { COOKIE_NAME, ONE_YEAR_MS } from '../shared/const.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Entry {
  id: string;
  date: string;
  name: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  mealType?: string;
  time?: string;
}

interface Goal {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

interface DbEntry {
  id: string;
  session_id: string;
  date: string;
  name: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  meal_type: string | null;
  time: string | null;
}

interface DbGoal {
  session_id: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

declare global {
  namespace Express {
    interface Request {
      sessionId: string;
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_GOAL: Goal = { calories: 2000, protein: 150, fat: 65, carbs: 250 };

function parseCookies(header: string): Record<string, string> {
  return Object.fromEntries(
    header
      .split(';')
      .map((c) => c.trim().split('='))
      .filter((p) => p.length === 2)
      .map(([k, v]) => [k.trim(), decodeURIComponent(v.trim())])
  );
}

function rowToEntry(row: DbEntry): Entry {
  return {
    id: row.id,
    date: row.date,
    name: row.name,
    calories: row.calories,
    protein: row.protein,
    fat: row.fat,
    carbs: row.carbs,
    ...(row.meal_type ? { mealType: row.meal_type } : {}),
    ...(row.time ? { time: row.time } : {}),
  };
}

function getGoalForSession(sessionId: string): Goal {
  const row = db
    .prepare('SELECT * FROM goals WHERE session_id = ?')
    .get(sessionId) as DbGoal | undefined;
  return row
    ? { calories: row.calories, protein: row.protein, fat: row.fat, carbs: row.carbs }
    : DEFAULT_GOAL;
}

function computeSummary(entries: Entry[], goal: Goal, date: string) {
  const totals = entries.reduce(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      protein: acc.protein + e.protein,
      fat: acc.fat + e.fat,
      carbs: acc.carbs + e.carbs,
    }),
    { calories: 0, protein: 0, fat: 0, carbs: 0 }
  );
  return {
    date,
    entries,
    totals,
    goal,
    remaining: {
      calories: Math.max(0, goal.calories - totals.calories),
      protein: Math.max(0, goal.protein - totals.protein),
      fat: Math.max(0, goal.fat - totals.fat),
      carbs: Math.max(0, goal.carbs - totals.carbs),
    },
    isOverGoal: {
      calories: totals.calories > goal.calories,
      protein: totals.protein > goal.protein,
      fat: totals.fat > goal.fat,
      carbs: totals.carbs > goal.carbs,
    },
  };
}

// ---------------------------------------------------------------------------
// Prepared statements
// ---------------------------------------------------------------------------

const stmts = {
  getEntries: db.prepare<[string, string]>(
    "SELECT * FROM entries WHERE session_id = ? AND date = ? ORDER BY COALESCE(time, '99:99'), id"
  ),
  getEntry: db.prepare<[string, string]>(
    'SELECT * FROM entries WHERE id = ? AND session_id = ?'
  ),
  insertEntry: db.prepare(
    `INSERT INTO entries (id, session_id, date, name, calories, protein, fat, carbs, meal_type, time)
     VALUES (@id, @session_id, @date, @name, @calories, @protein, @fat, @carbs, @meal_type, @time)`
  ),
  updateEntry: db.prepare(
    `UPDATE entries SET name=@name, calories=@calories, protein=@protein, fat=@fat,
     carbs=@carbs, meal_type=@meal_type, time=@time, date=@date
     WHERE id=@id AND session_id=@session_id`
  ),
  deleteEntry: db.prepare<[string, string]>(
    'DELETE FROM entries WHERE id = ? AND session_id = ?'
  ),
  upsertGoal: db.prepare(
    `INSERT INTO goals (session_id, calories, protein, fat, carbs)
     VALUES (@session_id, @calories, @protein, @fat, @carbs)
     ON CONFLICT(session_id) DO UPDATE SET
       calories=excluded.calories, protein=excluded.protein,
       fat=excluded.fat, carbs=excluded.carbs,
       updated_at=datetime('now')`
  ),
  recentFoods: db.prepare<[string, number]>(
    `SELECT name, calories, protein, fat, carbs, meal_type
     FROM entries
     WHERE session_id = ?
     GROUP BY name
     ORDER BY MAX(created_at) DESC
     LIMIT ?`
  ),
  frequentFoods: db.prepare<[string, number]>(
    `SELECT name, calories, protein, fat, carbs, meal_type, COUNT(*) as count
     FROM entries
     WHERE session_id = ?
     GROUP BY name
     ORDER BY count DESC
     LIMIT ?`
  ),
};

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.use(express.json());

  // Session middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    const cookies = parseCookies(req.headers.cookie || '');
    let sessionId = cookies[COOKIE_NAME];
    if (!sessionId) {
      sessionId = nanoid();
      const maxAge = Math.floor(ONE_YEAR_MS / 1000);
      res.setHeader(
        'Set-Cookie',
        `${COOKIE_NAME}=${sessionId}; Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=Lax`
      );
    }
    req.sessionId = sessionId;
    next();
  });

  // -------------------------------------------------------------------------
  // Entries
  // -------------------------------------------------------------------------

  app.get('/api/entries', (req: Request, res: Response) => {
    const { date } = req.query as { date?: string };
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ error: 'date query param required (YYYY-MM-DD)' });
      return;
    }
    const rows = stmts.getEntries.all(req.sessionId, date) as DbEntry[];
    res.json(rows.map(rowToEntry));
  });

  app.post('/api/entries', (req: Request, res: Response) => {
    const { date, name, calories, protein, fat, carbs, mealType, time } =
      req.body as Partial<Entry>;
    if (!date || !name || calories == null || protein == null || fat == null || carbs == null) {
      res.status(400).json({ error: 'date, name, calories, protein, fat, carbs are required' });
      return;
    }
    const id = `entry_${Date.now()}_${nanoid(9)}`;
    stmts.insertEntry.run({
      id,
      session_id: req.sessionId,
      date,
      name,
      calories: Number(calories),
      protein: Number(protein),
      fat: Number(fat),
      carbs: Number(carbs),
      meal_type: mealType ?? null,
      time: time ?? null,
    });
    const row = stmts.getEntry.get(id, req.sessionId) as DbEntry;
    res.status(201).json(rowToEntry(row));
  });

  app.put('/api/entries/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const existing = stmts.getEntry.get(id, req.sessionId) as DbEntry | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Entry not found' });
      return;
    }
    const body = req.body as Partial<Entry>;
    stmts.updateEntry.run({
      id,
      session_id: req.sessionId,
      date: body.date ?? existing.date,
      name: body.name ?? existing.name,
      calories: body.calories != null ? Number(body.calories) : existing.calories,
      protein: body.protein != null ? Number(body.protein) : existing.protein,
      fat: body.fat != null ? Number(body.fat) : existing.fat,
      carbs: body.carbs != null ? Number(body.carbs) : existing.carbs,
      meal_type: body.mealType !== undefined ? (body.mealType ?? null) : existing.meal_type,
      time: body.time !== undefined ? (body.time ?? null) : existing.time,
    });
    const updated = stmts.getEntry.get(id, req.sessionId) as DbEntry;
    res.json(rowToEntry(updated));
  });

  app.delete('/api/entries/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const result = stmts.deleteEntry.run(id, req.sessionId);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Entry not found' });
      return;
    }
    res.status(204).end();
  });

  // -------------------------------------------------------------------------
  // Goal
  // -------------------------------------------------------------------------

  app.get('/api/goal', (req: Request, res: Response) => {
    res.json(getGoalForSession(req.sessionId));
  });

  app.put('/api/goal', (req: Request, res: Response) => {
    const { calories, protein, fat, carbs } = req.body as Partial<Goal>;
    if (calories == null || protein == null || fat == null || carbs == null) {
      res.status(400).json({ error: 'calories, protein, fat, carbs are required' });
      return;
    }
    const goal: Goal = {
      calories: Number(calories),
      protein: Number(protein),
      fat: Number(fat),
      carbs: Number(carbs),
    };
    stmts.upsertGoal.run({ session_id: req.sessionId, ...goal });
    res.json(goal);
  });

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------

  app.get('/api/summary', (req: Request, res: Response) => {
    const { date } = req.query as { date?: string };
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ error: 'date query param required (YYYY-MM-DD)' });
      return;
    }
    const rows = stmts.getEntries.all(req.sessionId, date) as DbEntry[];
    const entries = rows.map(rowToEntry);
    const goal = getGoalForSession(req.sessionId);
    res.json(computeSummary(entries, goal, date));
  });

  // -------------------------------------------------------------------------
  // Recent & frequent foods
  // -------------------------------------------------------------------------

  // GET /api/foods/recent?limit=10
  app.get('/api/foods/recent', (req: Request, res: Response) => {
    const limit = Math.min(Number(req.query.limit) || 10, 30);
    const rows = stmts.recentFoods.all(req.sessionId, limit) as any[];
    res.json(rows.map((r) => ({
      name: r.name,
      calories: r.calories,
      protein: r.protein,
      fat: r.fat,
      carbs: r.carbs,
      mealType: r.meal_type,
    })));
  });

  // GET /api/foods/frequent?limit=5
  app.get('/api/foods/frequent', (req: Request, res: Response) => {
    const limit = Math.min(Number(req.query.limit) || 5, 20);
    const rows = stmts.frequentFoods.all(req.sessionId, limit) as any[];
    res.json(rows.map((r) => ({
      name: r.name,
      calories: r.calories,
      protein: r.protein,
      fat: r.fat,
      carbs: r.carbs,
      mealType: r.meal_type,
      count: r.count,
    })));
  });

  // -------------------------------------------------------------------------
  // Static frontend
  // -------------------------------------------------------------------------

  const staticPath = path.resolve(__dirname, 'public');
  app.use(express.static(staticPath));
  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.join(staticPath, 'index.html'));
  });

  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    console.log(`CaloTrack server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
