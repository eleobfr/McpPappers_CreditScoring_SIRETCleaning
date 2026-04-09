import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

import { appEnv } from "@/lib/env";

let databaseInstance: Database.Database | null = null;

function ensureDatabaseDirectory(databasePath: string) {
  const normalizedPath = databasePath.replace(/^[./\\]+/, "");
  const absolutePath = path.isAbsolute(databasePath)
    ? databasePath
    : path.join(/*turbopackIgnore: true*/ process.cwd(), normalizedPath);

  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  return absolutePath;
}

function createDatabase() {
  const resolvedPath = ensureDatabaseDirectory(appEnv.databasePath);
  const database = new Database(resolvedPath);

  // WAL is great on native disks, but it is brittle on Docker Desktop bind mounts,
  // especially on Windows. Use a conservative mode to avoid intermittent IO errors.
  database.pragma("journal_mode = DELETE");
  database.pragma("busy_timeout = 5000");
  database.pragma("foreign_keys = ON");

  database.exec(`
    CREATE TABLE IF NOT EXISTS app_users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      is_admin INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS auth_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      session_token TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES app_users(id)
    );

    CREATE INDEX IF NOT EXISTS auth_sessions_user_id_idx
      ON auth_sessions (user_id);

    CREATE TABLE IF NOT EXISTS auth_magic_links (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      consumed_at TEXT,
      delivery_status TEXT NOT NULL,
      delivery_meta_json TEXT
    );

    CREATE INDEX IF NOT EXISTS auth_magic_links_email_idx
      ON auth_magic_links (email, created_at DESC);

    CREATE TABLE IF NOT EXISTS user_feedback_drafts (
      user_id TEXT PRIMARY KEY,
      feedback_text TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES app_users(id)
    );

    CREATE TABLE IF NOT EXISTS verification_checks (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      input_json TEXT NOT NULL,
      selected_company_json TEXT NOT NULL,
      match_confidence INTEGER NOT NULL,
      risk_level TEXT NOT NULL,
      recommended_action TEXT NOT NULL,
      suggested_credit_limit REAL NOT NULL,
      suggested_payment_terms TEXT NOT NULL,
      reason_codes_json TEXT NOT NULL,
      decision_trace_json TEXT NOT NULL,
      human_explanation TEXT NOT NULL,
      manual_review_required INTEGER NOT NULL,
      warnings_json TEXT NOT NULL,
      provider_name TEXT NOT NULL,
      provider_mode TEXT NOT NULL,
      override_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS verification_checks_created_at_idx
      ON verification_checks (created_at DESC);

    CREATE TABLE IF NOT EXISTS app_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  const checkColumns = database
    .prepare("PRAGMA table_info(verification_checks)")
    .all() as Array<{ name: string }>;

  if (!checkColumns.some((column) => column.name === "user_id")) {
    database.exec("ALTER TABLE verification_checks ADD COLUMN user_id TEXT");
  }

  const userColumns = database
    .prepare("PRAGMA table_info(app_users)")
    .all() as Array<{ name: string }>;

  if (!userColumns.some((column) => column.name === "is_admin")) {
    database.exec(
      "ALTER TABLE app_users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0",
    );
  }

  database.exec(`
    CREATE INDEX IF NOT EXISTS verification_checks_user_id_idx
      ON verification_checks (user_id, created_at DESC);
  `);

  return database;
}

export function getDatabase() {
  if (!databaseInstance) {
    databaseInstance = createDatabase();
  }

  return databaseInstance;
}
