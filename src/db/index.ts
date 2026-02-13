import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import path from 'path';
import fs from 'fs';
import { ensureSchema } from './ensureSchema';

const dbFile = process.env.SQLITE_DB_PATH
  ? path.resolve(process.env.SQLITE_DB_PATH)
  : path.resolve(process.cwd(), 'data', 'psycloud.db');

// Ensure folder exists
fs.mkdirSync(path.dirname(dbFile), { recursive: true });

// Ensure schema (create/alter tables)
ensureSchema();

const sqlite = new Database(dbFile);

export const db = drizzle(sqlite, { schema });
