import { NextResponse, type NextRequest } from "next/server";

import { findUserBySessionToken } from "@/lib/auth/auth-repository";
import { AUTH_SESSION_COOKIE } from "@/lib/auth/session";
import { createVerificationCheck } from "@/lib/credit-ops/check-service";
import { verificationInputSchema } from "@/lib/credit-ops/schemas";

export async function POST(request: NextRequest) {
  const sessionToken = request.cookies.get(AUTH_SESSION_COOKIE)?.value;

  if (!sessionToken) {
    return NextResponse.json(
      {
        status: "error",
        message: "Session invalide.",
      },
      { status: 401 },
    );
  }

  const user = findUserBySessionToken(sessionToken);
  if (!user) {
    return NextResponse.json(
      {
        status: "error",
        message: "Session invalide ou expiree.",
      },
      { status: 401 },
    );
  }

  const payload = await request.json().catch(() => null);
  const parsed = verificationInputSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        status: "error",
        message: "Le formulaire contient des champs a corriger.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  try {
    const check = await createVerificationCheck(user.id, parsed.data);

    return NextResponse.json({
      status: "success",
      redirectTo: `/verify?check=${check.id}`,
      checkId: check.id,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "L'analyse n'a pas pu etre finalisee.",
      },
      { status: 400 },
    );
  }
}
