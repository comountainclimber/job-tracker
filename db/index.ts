import { mkdirSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

const DATA_DIR = join(process.cwd(), "data");
const DB_PATH = join(DATA_DIR, "tracker.db");

export type AppDatabase = BetterSQLite3Database<typeof schema>;

const globalForDb = globalThis as typeof globalThis & {
  __jobTrackerSqlite?: Database.Database;
  __jobTrackerDb?: AppDatabase;
};

const BOOTSTRAP_SQL = `
CREATE TABLE IF NOT EXISTS applications (
  id text primary key,
  company text not null,
  role text not null,
  stage text not null,
  job_url text,
  source text,
  location text,
  resume_label text,
  applied_at integer,
  apply_by integer,
  next_action text,
  next_action_at integer,
  notes text,
  archived integer not null default 0,
  created_at integer not null,
  updated_at integer not null
);
CREATE UNIQUE INDEX IF NOT EXISTS applications_job_url_unique ON applications(job_url) WHERE job_url IS NOT NULL;
`;

function bootstrap(sqlite: Database.Database) {
  sqlite.pragma("journal_mode = WAL");
  sqlite.exec(BOOTSTRAP_SQL);
}

function createDb(): AppDatabase {
  if (globalForDb.__jobTrackerDb) {
    return globalForDb.__jobTrackerDb;
  }

  mkdirSync(DATA_DIR, { recursive: true });

  const sqlite = globalForDb.__jobTrackerSqlite ?? new Database(DB_PATH);
  if (!globalForDb.__jobTrackerSqlite) {
    bootstrap(sqlite);
    globalForDb.__jobTrackerSqlite = sqlite;
  }

  const db = drizzle(sqlite, { schema });
  globalForDb.__jobTrackerDb = db;
  return db;
}

export const db = createDb();
export { applications } from "./schema";
export type { ApplicationRow } from "./schema";
