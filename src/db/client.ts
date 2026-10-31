import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

const sqlite = new Database(process.env.DB_PATH ?? './data/db.sqlite');
sqlite.pragma('foreign_keys = ON');
export const db = drizzle(sqlite, { schema });

migrate(db, { migrationsFolder: './drizzle' });
