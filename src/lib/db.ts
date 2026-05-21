import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

type Db = ReturnType<typeof drizzle<typeof schema>>;

let _db: Db | null = null;

// Lazily construct the Drizzle instance so that `DATABASE_URL` is read on first
// use rather than at import time. This keeps scripts that load `.env.local`
// after their import statements (ESM hoisting) working, while Next.js — which
// has the env populated before any module evaluates — is unaffected.
function getDb(): Db {
  if (_db) return _db;
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }
  const sql = neon(process.env.DATABASE_URL);
  _db = drizzle(sql, { schema });
  return _db;
}

export const db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb() as object, prop, receiver);
  },
}) as Db;
