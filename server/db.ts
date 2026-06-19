import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir =
  process.env.DB_DIR ||
  path.resolve(__dirname, '..', 'data');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'calotrack.db');

const db = new Database(dbPath);

// Enable WAL for better concurrent read performance
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS entries (
    id         TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    date       TEXT NOT NULL,
    name       TEXT NOT NULL,
    calories   REAL NOT NULL,
    protein    REAL NOT NULL,
    fat        REAL NOT NULL,
    carbs      REAL NOT NULL,
    meal_type  TEXT,
    time       TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS goals (
    session_id TEXT PRIMARY KEY,
    calories   REAL NOT NULL DEFAULT 2000,
    protein    REAL NOT NULL DEFAULT 150,
    fat        REAL NOT NULL DEFAULT 65,
    carbs      REAL NOT NULL DEFAULT 250,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_entries_session_date
    ON entries (session_id, date);
`);

export default db;
