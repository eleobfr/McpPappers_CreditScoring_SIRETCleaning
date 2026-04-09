import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { randomUUID } from "node:crypto";

import Database from "better-sqlite3";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  for (const line of content.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1);
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function deriveFullNameFromEmail(email) {
  return email
    .trim()
    .toLowerCase()
    .split("@")[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((chunk) => chunk[0]?.toUpperCase() + chunk.slice(1))
    .join(" ");
}

function ensureDatabaseDirectory(databasePath) {
  const normalizedPath = databasePath.replace(/^[./\\]+/, "");
  const absolutePath = path.isAbsolute(databasePath)
    ? databasePath
    : path.join(process.cwd(), normalizedPath);

  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  return absolutePath;
}

const [, , rawEmail, rawFullName] = process.argv;

if (!rawEmail) {
  console.error('Usage: npm run admin:create -- admin@entreprise.fr "Admin Credit Ops"');
  process.exit(1);
}

loadEnvFile(path.join(process.cwd(), ".env.local"));
loadEnvFile(path.join(process.cwd(), ".env"));

const email = rawEmail.trim().toLowerCase();
const fullName = rawFullName?.trim() || deriveFullNameFromEmail(email);
const databasePath = ensureDatabaseDirectory(
  process.env.DATABASE_PATH || "./data/credit-ops.sqlite",
);

const database = new Database(databasePath);
const now = new Date().toISOString();

database.exec(`
  CREATE TABLE IF NOT EXISTS app_users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    is_admin INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

const existing = database
  .prepare(
    `
      SELECT id
      FROM app_users
      WHERE email = ?
    `,
  )
  .get(email);

if (existing) {
  database
    .prepare(
      `
        UPDATE app_users
        SET full_name = ?,
            is_admin = 1,
            updated_at = ?
        WHERE id = ?
      `,
    )
    .run(fullName, now, existing.id);

  console.log(`Admin mis à jour : ${email}`);
  process.exit(0);
}

database
  .prepare(
    `
      INSERT INTO app_users (
        id,
        email,
        full_name,
        is_admin,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, 1, ?, ?)
    `,
  )
  .run(randomUUID(), email, fullName, now, now);

console.log(`Admin créé : ${email}`);
