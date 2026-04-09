import { appEnv, hasTurnstileConfigured } from "@/lib/env";

interface TurnstileResponse {
  success: boolean;
  "error-codes"?: string[];
}

export async function verifyTurnstileToken(input: {
  token?: string;
  remoteIp?: string;
}) {
  if (!hasTurnstileConfigured()) {
    return {
      success: true,
      skipped: true,
      errorCodes: [] as string[],
    };
  }

  if (!input.token) {
    return {
      success: false,
      skipped: false,
      errorCodes: ["missing-input-response"],
    };
  }

  const body = new URLSearchParams();
  body.set("secret", appEnv.turnstile.secretKey ?? "");
  body.set("response", input.token);
  if (input.remoteIp) {
    body.set("remoteip", input.remoteIp);
  }

  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      body,
      cache: "no-store",
    },
  );

  const payload = (await response.json()) as TurnstileResponse;

  return {
    success: Boolean(payload.success),
    skipped: false,
    errorCodes: payload["error-codes"] ?? [],
  };
}
