import { createHash, randomUUID } from "node:crypto";

import { getDatabase } from "@/lib/db";
import { logEvent } from "@/lib/logger";

export interface AppUser {
  id: string;
  email: string;
  fullName: string;
  isAdmin: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MagicLinkRecord {
  id: string;
  email: string;
  expiresAt: string;
  deliveryStatus: "sent" | "preview";
  deliveryMetaJson: string | null;
}

interface UserRow {
  id: string;
  email: string;
  full_name: string;
  is_admin: number;
  created_at: string;
  updated_at: string;
}

function mapUser(row: UserRow): AppUser {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    isAdmin: Boolean(row.is_admin),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isAdminEmail(email: string) {
  return Boolean(findUserByEmail(email)?.isAdmin);
}

export function deriveFullNameFromEmail(email: string) {
  const localPart = normalizeEmail(email).split("@")[0] ?? "utilisateur";
  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((chunk) => chunk[0]?.toUpperCase() + chunk.slice(1))
    .join(" ");
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function findUserByEmail(email: string) {
  const database = getDatabase();
  const row = database
    .prepare(
      `
        SELECT *
        FROM app_users
        WHERE email = ?
      `,
    )
    .get(normalizeEmail(email)) as UserRow | undefined;

  return row ? mapUser(row) : null;
}

export function findUserById(userId: string) {
  const row = getDatabase()
    .prepare(
      `
        SELECT *
        FROM app_users
        WHERE id = ?
      `,
    )
    .get(userId) as UserRow | undefined;

  return row ? mapUser(row) : null;
}

export function listAdminUsers() {
  const rows = getDatabase()
    .prepare(
      `
        SELECT *
        FROM app_users
        WHERE is_admin = 1
        ORDER BY email ASC
      `,
    )
    .all() as UserRow[];

  return rows.map(mapUser);
}

export function createOrUpdateUser(input: {
  email: string;
  fullName?: string;
  isAdmin: boolean;
}) {
  const database = getDatabase();
  const email = normalizeEmail(input.email);
  const fullName = input.fullName?.trim() || deriveFullNameFromEmail(email);
  const existingUser = findUserByEmail(email);
  const now = new Date().toISOString();

  if (existingUser) {
    database
      .prepare(
        `
          UPDATE app_users
          SET full_name = ?,
              is_admin = ?,
              updated_at = ?
          WHERE id = ?
        `,
      )
      .run(fullName, input.isAdmin ? 1 : 0, now, existingUser.id);

    return {
      ...existingUser,
      fullName,
      isAdmin: input.isAdmin,
      updatedAt: now,
    };
  }

  const user: AppUser = {
    id: randomUUID(),
    email,
    fullName,
    isAdmin: input.isAdmin,
    createdAt: now,
    updatedAt: now,
  };

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
        ) VALUES (?, ?, ?, ?, ?, ?)
      `,
    )
    .run(
      user.id,
      user.email,
      user.fullName,
      user.isAdmin ? 1 : 0,
      user.createdAt,
      user.updatedAt,
    );

  return user;
}

export function createSession(userId: string, durationMinutes: number) {
  const database = getDatabase();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + durationMinutes * 60 * 1000);
  const session = {
    id: randomUUID(),
    userId,
    sessionToken: randomUUID(),
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  database
    .prepare(
      `
        INSERT INTO auth_sessions (
          id,
          user_id,
          session_token,
          created_at,
          expires_at
        ) VALUES (?, ?, ?, ?, ?)
      `,
    )
    .run(
      session.id,
      session.userId,
      session.sessionToken,
      session.createdAt,
      session.expiresAt,
    );

  return session;
}

export function deleteSessionsForUser(userId: string) {
  getDatabase()
    .prepare(
      `
        DELETE FROM auth_sessions
        WHERE user_id = ?
      `,
    )
    .run(userId);
}

export function deleteSession(sessionToken: string) {
  getDatabase()
    .prepare(
      `
        DELETE FROM auth_sessions
        WHERE session_token = ?
      `,
    )
    .run(sessionToken);
}

export function createMagicLink(input: {
  email: string;
  expiresInMinutes: number;
}) {
  const database = getDatabase();
  const token = randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + input.expiresInMinutes * 60 * 1000);
  const record: MagicLinkRecord = {
    id: randomUUID(),
    email: normalizeEmail(input.email),
    expiresAt: expiresAt.toISOString(),
    deliveryStatus: "preview",
    deliveryMetaJson: null,
  };

  database
    .prepare(
      `
        INSERT INTO auth_magic_links (
          id,
          email,
          token_hash,
          created_at,
          expires_at,
          consumed_at,
          delivery_status,
          delivery_meta_json
        ) VALUES (?, ?, ?, ?, ?, NULL, ?, ?)
      `,
    )
    .run(
      record.id,
      record.email,
      hashToken(token),
      now.toISOString(),
      record.expiresAt,
      record.deliveryStatus,
      record.deliveryMetaJson,
    );

  return {
    ...record,
    token,
  };
}

export function updateMagicLinkDelivery(
  id: string,
  input: {
    deliveryStatus: "sent" | "preview";
    deliveryMeta?: Record<string, unknown>;
  },
) {
  getDatabase()
    .prepare(
      `
        UPDATE auth_magic_links
        SET delivery_status = ?,
            delivery_meta_json = ?
        WHERE id = ?
      `,
    )
    .run(
      input.deliveryStatus,
      input.deliveryMeta ? JSON.stringify(input.deliveryMeta) : null,
      id,
    );
}

export function consumeMagicLink(token: string) {
  const database = getDatabase();
  const now = new Date().toISOString();
  const row = database
    .prepare(
      `
        SELECT id, email
        FROM auth_magic_links
        WHERE token_hash = ?
          AND consumed_at IS NULL
          AND expires_at > ?
        LIMIT 1
      `,
    )
    .get(hashToken(token), now) as { id: string; email: string } | undefined;

  if (!row) {
    return null;
  }

  database
    .prepare(
      `
        UPDATE auth_magic_links
        SET consumed_at = ?
        WHERE id = ?
      `,
    )
    .run(now, row.id);

  return row.email;
}

export function peekMagicLink(token: string) {
  const database = getDatabase();
  const now = new Date().toISOString();
  const row = database
    .prepare(
      `
        SELECT email, expires_at
        FROM auth_magic_links
        WHERE token_hash = ?
          AND consumed_at IS NULL
          AND expires_at > ?
        LIMIT 1
      `,
    )
    .get(hashToken(token), now) as { email: string; expires_at: string } | undefined;

  if (!row) {
    return null;
  }

  return {
    email: row.email,
    expiresAt: row.expires_at,
  };
}

export function deleteMagicLinksForEmail(email: string) {
  getDatabase()
    .prepare(
      `
        DELETE FROM auth_magic_links
        WHERE email = ?
      `,
    )
    .run(normalizeEmail(email));
}

export function getFeedbackDraftForUser(userId: string) {
  const row = getDatabase()
    .prepare(
      `
        SELECT feedback_text
        FROM user_feedback_drafts
        WHERE user_id = ?
      `,
    )
    .get(userId) as { feedback_text: string } | undefined;

  return row?.feedback_text ?? "";
}

export function upsertFeedbackDraftForUser(userId: string, feedbackText: string) {
  const now = new Date().toISOString();

  getDatabase()
    .prepare(
      `
        INSERT INTO user_feedback_drafts (
          user_id,
          feedback_text,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          feedback_text = excluded.feedback_text,
          updated_at = excluded.updated_at
      `,
    )
    .run(userId, feedbackText, now, now);
}

export function deleteFeedbackDraftForUser(userId: string) {
  getDatabase()
    .prepare(
      `
        DELETE FROM user_feedback_drafts
        WHERE user_id = ?
      `,
    )
    .run(userId);
}

export function listExpiredNonAdminUserIds(now: string) {
  return getDatabase()
    .prepare(
      `
        SELECT DISTINCT s.user_id as userId
        FROM auth_sessions s
        INNER JOIN app_users u ON u.id = s.user_id
        WHERE s.expires_at <= ?
          AND u.is_admin = 0
      `,
    )
    .all(now) as Array<{ userId: string }>;
}

export function deleteExpiredSessions(now: string) {
  getDatabase()
    .prepare(
      `
        DELETE FROM auth_sessions
        WHERE expires_at <= ?
      `,
    )
    .run(now);
}

export function deleteExpiredMagicLinks(now: string) {
  getDatabase()
    .prepare(
      `
        DELETE FROM auth_magic_links
        WHERE expires_at <= ?
      `,
    )
    .run(now);
}

export function countSessionsForUser(userId: string) {
  const row = getDatabase()
    .prepare(
      `
        SELECT COUNT(*) as total
        FROM auth_sessions
        WHERE user_id = ?
      `,
    )
    .get(userId) as { total: number };

  return row.total;
}

export function deleteUserData(userId: string) {
  const database = getDatabase();

  const user = database
    .prepare(
      `
        SELECT *
        FROM app_users
        WHERE id = ?
      `,
    )
    .get(userId) as UserRow | undefined;

  if (!user) {
    return;
  }

  database
    .prepare(
      `
        DELETE FROM verification_checks
        WHERE user_id = ?
      `,
    )
    .run(userId);

  deleteSessionsForUser(userId);
  deleteMagicLinksForEmail(user.email);
  deleteFeedbackDraftForUser(userId);

  database
    .prepare(
      `
        DELETE FROM app_users
        WHERE id = ?
      `,
    )
    .run(userId);

  logEvent("info", "auth.non_admin.cleaned", {
    userId,
    email: user.email,
  });
}

export function findUserBySessionToken(sessionToken: string) {
  const database = getDatabase();
  const row = database
    .prepare(
      `
        SELECT u.*
        FROM auth_sessions s
        INNER JOIN app_users u ON u.id = s.user_id
        WHERE s.session_token = ?
        LIMIT 1
      `,
    )
    .get(sessionToken) as UserRow | undefined;

  return row ? mapUser(row) : null;
}
