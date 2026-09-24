import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const dataDir = process.env.DB_DIR || path.resolve(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });
export const dbPath = path.join(dataDir, 'calotrack.db');

export function openDb(file = dbPath): Database.Database {
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  migrate(db);
  db.pragma('foreign_keys = ON');
  return db;
}

// ---------------------------------------------------------------------------
// Migrations, tracked in PRAGMA user_version.
// v1 = the schema production databases already have (built ad hoc by the
// previous server, possibly missing later columns) — made idempotent here.
// ---------------------------------------------------------------------------

function columns(db: Database.Database, table: string): Set<string> {
  return new Set((db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name));
}

function v1Baseline(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT DEFAULT (datetime('now')), expires_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS entries (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, date TEXT NOT NULL, name TEXT NOT NULL,
      calories REAL NOT NULL, protein REAL NOT NULL, fat REAL NOT NULL, carbs REAL NOT NULL,
      meal_type TEXT, time TEXT, created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS goals (
      user_id TEXT PRIMARY KEY, calories REAL NOT NULL DEFAULT 2000, protein REAL NOT NULL DEFAULT 150,
      fat REAL NOT NULL DEFAULT 65, carbs REAL NOT NULL DEFAULT 250, updated_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS water_logs (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, date TEXT NOT NULL, ml REAL NOT NULL,
      created_at TEXT DEFAULT (datetime('now')));
    CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL DEFAULT 0, reset_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS ai_usage (user_id TEXT NOT NULL, date TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (user_id, date));
    CREATE INDEX IF NOT EXISTS idx_entries_user_date ON entries (user_id, date);
    CREATE INDEX IF NOT EXISTS idx_water_logs_user_date ON water_logs (user_id, date);
  `);
  if (!columns(db, 'goals').has('water_goal_ml')) {
    db.exec(`ALTER TABLE goals ADD COLUMN water_goal_ml REAL NOT NULL DEFAULT 2000`);
  }
  const u = columns(db, 'users');
  for (const [col, type] of [['name', 'TEXT'], ['height_cm', 'REAL'], ['weight_kg', 'REAL'], ['birth_year', 'INTEGER'], ['gender', 'TEXT']]) {
    if (!u.has(col)) db.exec(`ALTER TABLE users ADD COLUMN ${col} ${type}`);
  }
}

/**
 * v2: Telegram accounts (email/password become optional → users is rebuilt),
 * activity/goal/lang on the profile, auto-goal flag, entry portions,
 * weight log, and session tokens stored as SHA-256 hashes (existing
 * plaintext tokens are hashed in place, so nobody gets logged out).
 */
function v2(db: Database.Database) {
  db.exec(`
    CREATE TABLE users_new (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      password_hash TEXT,
      telegram_id INTEGER UNIQUE,
      name TEXT,
      gender TEXT,
      birth_year INTEGER,
      height_cm REAL,
      weight_kg REAL,
      activity TEXT,
      goal_mode TEXT,
      lang TEXT NOT NULL DEFAULT 'ru',
      created_at TEXT DEFAULT (datetime('now'))
    );
    INSERT INTO users_new (id, email, password_hash, name, gender, birth_year, height_cm, weight_kg, created_at)
      SELECT id, email, password_hash, name, gender, birth_year, height_cm, weight_kg, created_at FROM users;
    DROP TABLE users;
    ALTER TABLE users_new RENAME TO users;

    ALTER TABLE goals ADD COLUMN auto INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE entries ADD COLUMN portion TEXT;

    CREATE TABLE IF NOT EXISTS weight_logs (
      user_id TEXT NOT NULL, date TEXT NOT NULL, kg REAL NOT NULL,
      created_at TEXT DEFAULT (datetime('now')), PRIMARY KEY (user_id, date));
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);
  `);
  // Seed the weight log with each user's current profile weight.
  db.exec(`INSERT OR IGNORE INTO weight_logs (user_id, date, kg)
           SELECT id, date('now'), weight_kg FROM users WHERE weight_kg IS NOT NULL`);

  const rows = db.prepare('SELECT token FROM sessions').all() as { token: string }[];
  const upd = db.prepare('UPDATE sessions SET token = ? WHERE token = ?');
  for (const { token } of rows) {
    if (!/^[0-9a-f]{64}$/.test(token)) upd.run(createHash('sha256').update(token).digest('hex'), token);
  }
}

const MIGRATIONS: ((db: Database.Database) => void)[] = [v1Baseline, v2];

export function migrate(db: Database.Database) {
  const current = db.pragma('user_version', { simple: true }) as number;
  if (current >= MIGRATIONS.length) return;
  db.pragma('foreign_keys = OFF'); // table rebuilds need it off; cannot change inside a transaction
  for (let v = current; v < MIGRATIONS.length; v++) {
    db.transaction(() => {
      MIGRATIONS[v](db);
      db.pragma(`user_version = ${v + 1}`);
    })();
    console.log(`[db] migrated to v${v + 1}`);
  }
  const broken = db.pragma('foreign_key_check') as unknown[];
  if (broken.length) console.warn('[db] foreign_key_check reported', broken.length, 'rows');
}
