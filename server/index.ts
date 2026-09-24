import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dataDir, openDb } from './db.js';
import { createApp } from './app.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const production = process.env.NODE_ENV === 'production';
const db = openDb();

// ---------------------------------------------------------------------------
// Backups: rotating on-volume snapshots guard against bad migrations; the
// admin route lets the file be pulled off-instance against volume loss.
// ---------------------------------------------------------------------------

const BACKUP_DIR = path.join(dataDir, 'backups');
const BACKUP_RETENTION_DAYS = 7;

async function runBackup(): Promise<string | null> {
  try {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const dest = path.join(BACKUP_DIR, `nura-${new Date().toISOString().slice(0, 10)}.db`);
    await db.backup(dest);
    const cutoff = Date.now() - BACKUP_RETENTION_DAYS * 864e5;
    for (const file of fs.readdirSync(BACKUP_DIR)) {
      const full = path.join(BACKUP_DIR, file);
      if (fs.statSync(full).mtimeMs < cutoff) fs.unlinkSync(full);
    }
    return dest;
  } catch (err) {
    console.error('[backup] failed:', err);
    return null;
  }
}

function housekeeping() {
  db.prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')").run();
  db.prepare('DELETE FROM rate_limits WHERE reset_at < ?').run(Date.now());
  db.prepare("DELETE FROM ai_usage WHERE date < date('now', '-30 days')").run();
}

const app = createApp(db, {
  botToken: process.env.TELEGRAM_BOT_TOKEN,
  geminiKey: process.env.GEMINI_API_KEY,
  adminKey: process.env.ADMIN_KEY,
  production,
  runBackup,
});

// ---------------------------------------------------------------------------
// Static frontend. Vite output under /assets is content-hashed → immutable;
// index.html must always revalidate so a deploy is picked up immediately.
// ---------------------------------------------------------------------------

const staticPath = path.resolve(__dirname, 'public');
app.use('/assets', express.static(path.join(staticPath, 'assets'), { maxAge: '1y', immutable: true }));
app.use(express.static(staticPath, { maxAge: '1d', index: false }));
app.get('*', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(staticPath, 'index.html'));
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log(`Nura server on http://localhost:${port}/`));

setTimeout(() => { runBackup(); housekeeping(); }, 30_000);
setInterval(() => { runBackup(); housekeeping(); }, 24 * 60 * 60 * 1000);
