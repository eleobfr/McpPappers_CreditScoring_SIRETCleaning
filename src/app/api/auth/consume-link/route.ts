import { NextResponse } from "next/server";

import { appEnv } from "@/lib/env";
import {
  AUTH_SESSION_COOKIE,
  consumeMagicLinkAndCreateSession,
} from "@/lib/auth/session";

function publicUrl(pathname: string) {
  return new URL(pathname, appEnv.appBaseUrl);
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const token = String(formData.get("token") ?? "").trim();

  if (!token) {
    return NextResponse.redirect(publicUrl("/?error=missing-token"), 303);
  }

  const result = await consumeMagicLinkAndCreateSession(token);

  if (!result) {
    return NextResponse.redirect(
      publicUrl("/?error=invalid-or-expired-link"),
      303,
    );
  }

  const response = NextResponse.redirect(publicUrl("/verify"), 303);
  response.cookies.set(AUTH_SESSION_COOKIE, result.session.sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    expires: new Date(result.session.expiresAt),
  });

  return response;
}
