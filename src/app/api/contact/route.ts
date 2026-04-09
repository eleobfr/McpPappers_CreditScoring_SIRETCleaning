import { NextResponse } from "next/server";
import { z } from "zod";

import { sendContactRequestEmail } from "@/lib/contact/contact-email";
import { verifyTurnstileToken } from "@/lib/security/turnstile";

const contactSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(160),
  company: z.string().trim().max(160).optional(),
  message: z.string().trim().min(20).max(4000),
  turnstileToken: z.string().trim().optional(),
  website: z.string().trim().max(20).optional(),
});

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
  const parsed = contactSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        status: "error",
        message: "Le formulaire de contact contient des champs à corriger.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  if (parsed.data.website) {
    return NextResponse.json({
      status: "success",
      message: "Votre message a bien été transmis.",
    });
  }

  const turnstileResult = await verifyTurnstileToken({
    token: parsed.data.turnstileToken,
    remoteIp: getClientIp(request),
  });

  if (!turnstileResult.success) {
    return NextResponse.json(
      {
        status: "error",
        message: "Le contrôle anti-abus n'a pas pu être validé.",
        turnstileRequired: true,
        fieldErrors: {
          turnstileToken: ["Validez le contrôle de sécurité puis recommencez."],
        },
      },
      { status: 400 },
    );
  }

  await sendContactRequestEmail({
    fullName: parsed.data.fullName,
    email: parsed.data.email,
    company: parsed.data.company,
    message: parsed.data.message,
  });

  return NextResponse.json({
    status: "success",
    message: "Votre message a bien été transmis à ELEOB Data Consulting.",
  });
}
