import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  createMagicLink,
  createOrUpdateUser,
  createSession,
  countSessionsForUser,
  deleteExpiredMagicLinks,
  deleteExpiredSessions,
  deleteSessionsForUser,
  deleteUserData,
  deleteSession,
  findUserBySessionToken,
  findUserById,
  getFeedbackDraftForUser,
  isAdminEmail,
  listExpiredNonAdminUserIds,
  normalizeEmail,
  deriveFullNameFromEmail,
  peekMagicLink,
  updateMagicLinkDelivery,
  consumeMagicLink,
  upsertFeedbackDraftForUser,
  type AppUser,
} from "@/lib/auth/auth-repository";
import { appEnv } from "@/lib/env";
import {
  sendAdminNotificationEmail,
  sendMagicLinkEmail,
} from "@/lib/auth/magic-link-email";

export const AUTH_SESSION_COOKIE = "credit_ops_session";
const ADMIN_SESSION_DURATION_MINUTES = 60 * 24 * 30;
const NON_ADMIN_SESSION_DURATION_MINUTES = 25;
const MAGIC_LINK_DURATION_MINUTES = 5;

async function finalizeNonAdminUserSession(
  userId: string,
  reason: "expired" | "manual-logout",
) {
  const user = findUserById(userId);
  if (!user || user.isAdmin) {
    return;
  }

  const feedback = getFeedbackDraftForUser(userId).trim();

  if (feedback) {
    await sendAdminNotificationEmail({
      event: "non-admin-feedback",
      subject: `Feedback Credit Ops · ${user.email}`,
      text: [
        `Utilisateur : ${user.email}`,
        `Nom : ${user.fullName}`,
        `Raison de fin de session : ${reason}`,
        "",
        "Feedback :",
        feedback,
      ].join("\n"),
      metadata: {
        userId,
        email: user.email,
        reason,
      },
    });
  }

  deleteUserData(userId);
}

function cleanupExpiredNonAdminSessions() {
  const now = new Date().toISOString();
  const expiredUsers = listExpiredNonAdminUserIds(now);

  deleteExpiredSessions(now);
  deleteExpiredMagicLinks(now);

  return expiredUsers;
}

export async function getCurrentUser() {
  const expiredUsers = cleanupExpiredNonAdminSessions();
  for (const expiredUser of expiredUsers) {
    if (countSessionsForUser(expiredUser.userId) === 0) {
      await finalizeNonAdminUserSession(expiredUser.userId, "expired");
    }
  }

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(AUTH_SESSION_COOKIE)?.value;

  if (!sessionToken) {
    return null;
  }

  return findUserBySessionToken(sessionToken);
}

export async function requireAuthenticatedUser(): Promise<AppUser> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/");
  }

  return user;
}

export async function signInUser(input: { email: string; fullName: string }) {
  const user = createOrUpdateUser({
    email: input.email,
    fullName: input.fullName,
    isAdmin: isAdminEmail(input.email),
  });
  const session = createSession(user.id, ADMIN_SESSION_DURATION_MINUTES);
  const cookieStore = await cookies();

  cookieStore.set(AUTH_SESSION_COOKIE, session.sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    expires: new Date(session.expiresAt),
  });

  return user;
}

export async function autoSignInAdmin(email: string) {
  const normalizedEmail = normalizeEmail(email);
  const user = createOrUpdateUser({
    email: normalizedEmail,
    fullName: deriveFullNameFromEmail(normalizedEmail),
    isAdmin: true,
  });

  const session = createSession(user.id, ADMIN_SESSION_DURATION_MINUTES);
  const cookieStore = await cookies();

  cookieStore.set(AUTH_SESSION_COOKIE, session.sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    expires: new Date(session.expiresAt),
  });

  return user;
}

export async function requestMagicLink(email: string) {
  const normalizedEmail = normalizeEmail(email);
  const magicLink = createMagicLink({
    email: normalizedEmail,
    expiresInMinutes: MAGIC_LINK_DURATION_MINUTES,
  });

  const loginLink = `${appEnv.appBaseUrl}/login/verify?token=${magicLink.token}`;
  const delivery = await sendMagicLinkEmail({
    email: normalizedEmail,
    loginLink,
  });

  updateMagicLinkDelivery(magicLink.id, {
    deliveryStatus: delivery.deliveryStatus,
    deliveryMeta: delivery.deliveryMeta,
  });

  await sendAdminNotificationEmail({
    event: "magic-link-requested",
    subject: `Magic link demandé · ${normalizedEmail}`,
    text: [
      `Demande de magic link pour : ${normalizedEmail}`,
      `Statut d'envoi : ${delivery.deliveryStatus}`,
      `Lien valable : ${MAGIC_LINK_DURATION_MINUTES} minutes`,
    ].join("\n"),
    metadata: {
      email: normalizedEmail,
      deliveryStatus: delivery.deliveryStatus,
    },
  });

  return {
    email: normalizedEmail,
    loginLink,
    deliveryStatus: delivery.deliveryStatus,
    deliveryMeta: delivery.deliveryMeta,
  };
}

export function getMagicLinkPreview(token: string) {
  return peekMagicLink(token);
}

export async function consumeMagicLinkAndCreateSession(token: string) {
  const email = consumeMagicLink(token);

  if (!email) {
    return null;
  }

  const user = createOrUpdateUser({
    email,
    fullName: deriveFullNameFromEmail(email),
    isAdmin: false,
  });

  deleteSessionsForUser(user.id);
  const session = createSession(user.id, NON_ADMIN_SESSION_DURATION_MINUTES);

  await sendAdminNotificationEmail({
    event: "magic-link-validated",
    subject: `Magic link validé · ${email}`,
    text: [
      `Magic link validé pour : ${email}`,
      `Session temporaire : ${NON_ADMIN_SESSION_DURATION_MINUTES} minutes`,
      `Expiration : ${session.expiresAt}`,
    ].join("\n"),
    metadata: {
      email,
      sessionExpiresAt: session.expiresAt,
    },
  });

  return {
    user,
    session,
  };
}

export async function saveFeedbackDraft(userId: string, feedbackText: string) {
  upsertFeedbackDraftForUser(userId, feedbackText);
}

export async function signOutUser() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(AUTH_SESSION_COOKIE)?.value;
  const user = await getCurrentUser();

  if (sessionToken) {
    deleteSession(sessionToken);
  }

  if (user && !user.isAdmin) {
    await finalizeNonAdminUserSession(user.id, "manual-logout");
  }

  cookieStore.delete(AUTH_SESSION_COOKIE);
}
