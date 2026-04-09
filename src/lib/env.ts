import { z } from "zod";

const optionalTrimmedString = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
  },
  z.string().optional(),
);

const envSchema = z.object({
  PAPPERS_MCP_URL: optionalTrimmedString.pipe(z.string().url().optional()),
  PAPPERS_API_TOKEN: optionalTrimmedString,
  APP_BASE_URL: optionalTrimmedString.pipe(
    z.string().url().default("http://localhost:3000"),
  ),
  TURNSTILE_SITE_KEY: optionalTrimmedString,
  TURNSTILE_SECRET_KEY: optionalTrimmedString,
  SMTP_HOST: optionalTrimmedString,
  SMTP_PORT: optionalTrimmedString,
  SMTP_USER: optionalTrimmedString,
  SMTP_PASS: optionalTrimmedString,
  SMTP_FROM: optionalTrimmedString,
  SMTP_SECURE: optionalTrimmedString,
  SMTP_REQUIRE_TLS: optionalTrimmedString,
  DATABASE_PATH: z.string().trim().default("./data/credit-ops.sqlite"),
});

const parsedEnv = envSchema.parse({
  PAPPERS_MCP_URL: process.env.PAPPERS_MCP_URL,
  PAPPERS_API_TOKEN: process.env.PAPPERS_API_TOKEN,
  APP_BASE_URL: process.env.APP_BASE_URL,
  TURNSTILE_SITE_KEY: process.env.TURNSTILE_SITE_KEY,
  TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  SMTP_FROM: process.env.SMTP_FROM,
  SMTP_SECURE: process.env.SMTP_SECURE,
  SMTP_REQUIRE_TLS: process.env.SMTP_REQUIRE_TLS,
  DATABASE_PATH: process.env.DATABASE_PATH,
});

const resolvedPappersMcpUrl =
  parsedEnv.PAPPERS_MCP_URL ||
  (parsedEnv.PAPPERS_API_TOKEN
    ? `https://mcp.pappers.fr/${parsedEnv.PAPPERS_API_TOKEN}`
    : undefined);

export const appEnv = {
  pappersMcpUrl: resolvedPappersMcpUrl,
  appBaseUrl: parsedEnv.APP_BASE_URL,
  turnstile: {
    siteKey: parsedEnv.TURNSTILE_SITE_KEY,
    secretKey: parsedEnv.TURNSTILE_SECRET_KEY,
  },
  smtp: {
    host: parsedEnv.SMTP_HOST,
    port: parsedEnv.SMTP_PORT ? Number(parsedEnv.SMTP_PORT) : undefined,
    user: parsedEnv.SMTP_USER,
    pass: parsedEnv.SMTP_PASS,
    from: parsedEnv.SMTP_FROM,
    secure:
      parsedEnv.SMTP_SECURE === undefined
        ? undefined
        : parsedEnv.SMTP_SECURE === "true",
    requireTls:
      parsedEnv.SMTP_REQUIRE_TLS === undefined
        ? true
        : parsedEnv.SMTP_REQUIRE_TLS === "true",
  },
  databasePath: parsedEnv.DATABASE_PATH,
};

export function hasPappersMcpConfigured() {
  return Boolean(appEnv.pappersMcpUrl);
}

export function hasTurnstileConfigured() {
  return Boolean(appEnv.turnstile.siteKey && appEnv.turnstile.secretKey);
}
