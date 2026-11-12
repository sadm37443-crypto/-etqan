import { readdir, readFile } from 'node:fs/promises';
import mysql from 'mysql2/promise';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
let pool;
let initialization;

export function getPool() {
  if (pool) return pool;
  if (!process.env.DATABASE_URL) return null;
  pool = mysql.createPool(process.env.DATABASE_URL);
  return pool;
}

export async function initDatabase() {
  if (initialization) return initialization;
  initialization = (async () => {
    const db = getPool();
    if (!db) return { ok: false, reason: 'DATABASE_URL_MISSING' };
    const [appliedRows] = await db.query('SELECT id FROM schema_migrations');
    const applied = new Set(appliedRows.map((row) => row.id));
    const files = (await readdir(join(here, 'db'))).filter((file) => /^\d+_.*\.sql$/.test(file)).sort();
    for (const file of files) {
      const migrationId = file.replace(/\.sql$/, '');
      if (applied.has(migrationId)) continue;
      const sql = await readFile(join(here, 'db', file), 'utf8');
      const statements = sql.split(/;\s*(?:\n|$)/).map((statement) => statement.trim()).filter(Boolean);
      for (const statement of statements) await db.query(statement);
      await db.query('INSERT INTO schema_migrations (id) VALUES (?)', [migrationId]);
    }
    return { ok: true };
  })().catch((error) => ({ ok: false, reason: error.code || 'DATABASE_INIT_FAILED', message: error.message }));
  return initialization;
}

export async function query(sql, params = []) {
  const db = getPool();
  if (!db) throw Object.assign(new Error('Database is not configured'), { code: 'DATABASE_URL_MISSING' });
  const [rows] = await db.query(sql, params);
  return rows;
}

export async function pingDatabase() {
  try {
    const db = getPool();
    if (!db) return { ok: false, reason: 'DATABASE_URL_MISSING' };
    await db.query('SELECT 1');
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: error.code || 'DATABASE_UNAVAILABLE' };
  }
}
