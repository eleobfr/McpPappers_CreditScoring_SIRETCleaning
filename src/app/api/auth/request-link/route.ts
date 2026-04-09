import { NextResponse } from "next/server";
import { z } from "zod";

import {
  createOrUpdateUser,
  createSession,
  deriveFullNameFromEmail,
  isAdminEmail,
  normalizeEmail,
  queueAdminDigestEvent,
} from "@/lib/auth/auth-repository";
import { requestMagicLink, AUTH_SESSION_COOKIE } from "@/lib/auth/session";
import { sendQueuedDailyConnectionsReportIfDue } from "@/lib/auth/magic-link-email";
import { verifyTurnstileToken } from "@/lib/security/turnstile";

const requestSchema = z.object({
  email: z.string().trim().email().max(160),
  turnstileToken: z.string().trim().optional(),
});

const ADMIN_SESSION_DURATION_MINUTES = 60 * 24 * 30;

function getClientIp(request: Request) {
  const forwardedFor =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for");

  if (!forwardedFor) {
    return undefined;
  }

  return forwardedFor.split(",")[0]?.trim() || undefined;
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        status: "error",
        message: "Email invalide.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const email = normalizeEmail(parsed.data.email);

  if (isAdminEmail(email)) {
    const user = createOrUpdateUser({
      email,
      fullName: deriveFullNameFromEmail(email),
      isAdmin: true,
    });
    const session = createSession(user.id, ADMIN_SESSION_DURATION_MINUTES);

    const response = NextResponse.json({
      status: "success",
      redirectTo: "/verify",
    });

    response.cookies.set(AUTH_SESSION_COOKIE, session.sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      expires: new Date(session.expiresAt),
    });

    queueAdminDigestEvent({
      eventType: "application-login",
      userEmail: user.email,
      userFullName: user.fullName,
      payload: {
        userRole: "admin",
        sessionExpiresAt: session.expiresAt,
      },
    });
    await sendQueuedDailyConnectionsReportIfDue();

    return response;
  }

  const turnstileResult = await verifyTurnstileToken({
    token: parsed.data.turnstileToken,
    remoteIp: getClientIp(request),
  });

  if (!turnstileResult.success) {
    return NextResponse.json(
      {
        status: "error",
        message: "Le controle anti-abus n'a pas pu etre valide.",
        turnstileRequired: true,
        fieldErrors: {
          turnstileToken: ["Validez le controle de securite puis recommencez."],
        },
        errorCodes: turnstileResult.errorCodes,
      },
      { status: 400 },
    );
  }

  const delivery = await requestMagicLink(email);

  return NextResponse.json({
    status: "success",
    message:
      delivery.deliveryStatus === "sent"
        ? "Un lien de connexion a ete envoye a cette adresse."
        : "Aucun transport email configure. Un lien de test local a ete genere.",
    previewLink:
      delivery.deliveryStatus === "preview"
        ? (delivery.deliveryMeta?.previewLink as string | undefined)
        : undefined,
  });
}
