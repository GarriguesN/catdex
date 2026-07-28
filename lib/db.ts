import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "data", "catdex.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  // Ensure data directory exists
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrateSchema(db);
  return db;
}

function migrateSchema(db: Database.Database) {
  db.exec(`
    -- Users (from Google OAuth)
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      image TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Cats (per user)
    CREATE TABLE IF NOT EXISTS cats (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      hash TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      last_seen INTEGER NOT NULL,
      photo_count INTEGER NOT NULL DEFAULT 0,
      thumb_blob_id TEXT,
      notes TEXT,
      manually_named INTEGER NOT NULL DEFAULT 0,
      color TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- Photos (per cat)
    CREATE TABLE IF NOT EXISTS photos (
      id TEXT PRIMARY KEY,
      cat_id TEXT NOT NULL REFERENCES cats(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id),
      file_path TEXT NOT NULL,
      thumb_path TEXT NOT NULL,
      taken_at INTEGER NOT NULL,
      lat REAL,
      lng REAL,
      location_accuracy REAL,
      phash TEXT NOT NULL DEFAULT '',
      width INTEGER NOT NULL DEFAULT 0,
      height INTEGER NOT NULL DEFAULT 0,
      bytes INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (cat_id) REFERENCES cats(id) ON DELETE CASCADE
    );

    -- Achievements (per user)
    CREATE TABLE IF NOT EXISTS achievements (
      id TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id),
      cat_id TEXT,
      unlocked_at INTEGER NOT NULL,
      seen INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (id, user_id)
    );

    -- Settings (per user, key-value)
    CREATE TABLE IF NOT EXISTS settings (
      user_id TEXT NOT NULL REFERENCES users(id),
      key TEXT NOT NULL,
      value TEXT,
      PRIMARY KEY (user_id, key)
    );

    -- NextAuth accounts/sessions
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      type TEXT NOT NULL,
      provider TEXT NOT NULL,
      provider_account_id TEXT NOT NULL,
      refresh_token TEXT,
      access_token TEXT,
      expires_at INTEGER,
      token_type TEXT,
      scope TEXT,
      id_token TEXT,
      session_state TEXT,
      UNIQUE(provider, provider_account_id)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      session_token TEXT UNIQUE NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id),
      expires INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS verification_tokens (
      identifier TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires INTEGER NOT NULL,
      PRIMARY KEY (identifier, token)
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_cats_user ON cats(user_id);
    CREATE INDEX IF NOT EXISTS idx_photos_cat ON photos(cat_id);
    CREATE INDEX IF NOT EXISTS idx_photos_user ON photos(user_id);
    CREATE INDEX IF NOT EXISTS idx_achievements_user ON achievements(user_id);
  `);
}
