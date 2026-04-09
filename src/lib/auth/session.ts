import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  createMagicLink,
  createOrUpdateUser,
  createSession,
  countSessionsForUser,
  deleteExpiredMagicLinks,
  deleteExpiredSessions,
  deleteMagicLinksForEmail,
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
  queueAdminDigestEvent,
  updateMagicLinkDelivery,
  consumeMagicLink,
  upsertFeedbackDraftForUser,
  type AppUser,
} from "@/lib/auth/auth-repository";
import { appEnv } from "@/lib/env";
import {
  ensureAdminDigestScheduler,
  sendMagicLinkEmail,
  sendQueuedAdminDigestIfDue,
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
    queueAdminDigestEvent({
      eventType: "non-admin-feedback",
      userEmail: user.email,
      userFullName: user.fullName,
      payload: {
        reason,
        feedbackText: feedback,
      },
    });
    await sendQueuedAdminDigestIfDue();
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
  ensureAdminDigestScheduler();

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
  ensureAdminDigestScheduler();

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
  ensureAdminDigestScheduler();

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

  queueAdminDigestEvent({
    eventType: "non-admin-connection",
    userEmail: email,
    userFullName: user.fullName,
    payload: {
      sessionExpiresAt: session.expiresAt,
      sessionDurationMinutes: NON_ADMIN_SESSION_DURATION_MINUTES,
    },
  });
  await sendQueuedAdminDigestIfDue();

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

export { deleteMagicLinksForEmail };
