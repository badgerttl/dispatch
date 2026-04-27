import { DatabaseSync } from 'node:sqlite'
import { mkdirSync, existsSync } from 'fs'
import { dirname } from 'path'

const DB_PATH = process.env.DB_PATH || './data/dispatch.db'

let db = null

export function getDB() {
  if (!db) {
    const dir = dirname(DB_PATH)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    db = new DatabaseSync(DB_PATH)
  }
  return db
}

export function initDB() {
  const db = getDB()
  db.exec(`
    CREATE TABLE IF NOT EXISTS collections (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS requests (
      id TEXT PRIMARY KEY,
      collection_id TEXT NOT NULL,
      name TEXT NOT NULL,
      method TEXT NOT NULL DEFAULT 'GET',
      url TEXT NOT NULL DEFAULT '',
      headers TEXT DEFAULT '[]',
      params TEXT DEFAULT '[]',
      body TEXT DEFAULT '',
      body_type TEXT DEFAULT 'json',
      pre_script TEXT DEFAULT '',
      post_script TEXT DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS environments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      variables TEXT DEFAULT '[]',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS history (
      id TEXT PRIMARY KEY,
      method TEXT NOT NULL,
      url TEXT NOT NULL,
      headers TEXT DEFAULT '[]',
      params TEXT DEFAULT '[]',
      body TEXT DEFAULT '',
      body_type TEXT DEFAULT 'json',
      status INTEGER,
      duration INTEGER,
      size INTEGER,
      response_body TEXT DEFAULT '',
      response_headers TEXT DEFAULT '{}',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      collection_id TEXT NOT NULL,
      parent_folder_id TEXT,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `)

  // Idempotent migrations for existing DBs
  for (const col of ['pre_script', 'post_script']) {
    try { db.exec(`ALTER TABLE requests ADD COLUMN ${col} TEXT DEFAULT ''`) } catch {}
  }
  try { db.exec(`ALTER TABLE history ADD COLUMN name TEXT DEFAULT ''`) } catch {}
  try { db.exec(`ALTER TABLE history ADD COLUMN raw_request TEXT DEFAULT ''`) } catch {}
  try { db.exec(`ALTER TABLE history ADD COLUMN raw_response TEXT DEFAULT ''`) } catch {}
  try { db.exec(`ALTER TABLE requests ADD COLUMN folder_id TEXT`) } catch {}
  try { db.exec(`ALTER TABLE collections ADD COLUMN variables TEXT DEFAULT '[]'`) } catch {}

  console.log(`DB ready: ${DB_PATH}`)
}
