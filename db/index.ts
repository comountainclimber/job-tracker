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
  updated_at integer not null,
  notion_page_id text,
  notion_synced_at integer,
  notion_last_edited_time text
);
CREATE UNIQUE INDEX IF NOT EXISTS applications_job_url_unique ON applications(job_url) WHERE job_url IS NOT NULL;
CREATE TABLE IF NOT EXISTS settings (
  key text primary key,
  value text not null
);
CREATE TABLE IF NOT EXISTS application_stage_history (
  id integer primary key autoincrement,
  application_id text not null references applications(id) on delete cascade,
  stage text not null,
  recorded_at integer not null
);
CREATE INDEX IF NOT EXISTS application_stage_history_application_id ON application_stage_history(application_id);
`;

function columnNames(sqlite: Database.Database, table: string): Set<string> {
  const rows = sqlite.prepare(`PRAGMA table_info(${table})`).all() as {
    name: string;
  }[];
  return new Set(rows.map((row) => row.name));
}

function addColumnIfMissing(
  sqlite: Database.Database,
  table: string,
  column: string,
  ddl: string,
) {
  if (!columnNames(sqlite, table).has(column)) {
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}

function migrate(sqlite: Database.Database) {
  addColumnIfMissing(sqlite, "applications", "notion_page_id", "notion_page_id text");
  addColumnIfMissing(
    sqlite,
    "applications",
    "notion_synced_at",
    "notion_synced_at integer",
  );
  addColumnIfMissing(
    sqlite,
    "applications",
    "notion_last_edited_time",
    "notion_last_edited_time text",
  );
  sqlite.exec(
    `CREATE UNIQUE INDEX IF NOT EXISTS applications_notion_page_id_unique ON applications(notion_page_id) WHERE notion_page_id IS NOT NULL`,
  );
  sqlite.exec(`INSERT INTO application_stage_history (application_id, stage, recorded_at)
    SELECT a.id, a.stage, a.updated_at FROM applications a
    WHERE NOT EXISTS (SELECT 1 FROM application_stage_history h WHERE h.application_id = a.id)`);
  sqlite.exec(`
    CREATE TRIGGER IF NOT EXISTS applications_stage_insert AFTER INSERT ON applications BEGIN
      INSERT INTO application_stage_history (application_id, stage, recorded_at)
      VALUES (NEW.id, NEW.stage, NEW.updated_at);
    END;
    CREATE TRIGGER IF NOT EXISTS applications_stage_update AFTER UPDATE OF stage ON applications
    WHEN OLD.stage != NEW.stage BEGIN
      INSERT INTO application_stage_history (application_id, stage, recorded_at)
      VALUES (NEW.id, NEW.stage, NEW.updated_at);
    END;
    CREATE TRIGGER IF NOT EXISTS applications_stage_delete AFTER DELETE ON applications BEGIN
      DELETE FROM application_stage_history WHERE application_id = OLD.id;
    END;
  `);
}

function bootstrap(sqlite: Database.Database) {
  sqlite.pragma("journal_mode = WAL");
  sqlite.exec(BOOTSTRAP_SQL);
  migrate(sqlite);
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
export { applications, applicationStageHistory, settings } from "./schema";
export type { ApplicationRow, SettingRow } from "./schema";
