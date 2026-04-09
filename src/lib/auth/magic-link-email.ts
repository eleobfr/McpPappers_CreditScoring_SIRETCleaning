import nodemailer from "nodemailer";

import { listAdminUsers } from "@/lib/auth/auth-repository";
import { appEnv } from "@/lib/env";
import { logEvent } from "@/lib/logger";

interface SendMagicLinkEmailInput {
  email: string;
  loginLink: string;
}

function isSmtpConfigured() {
  return Boolean(appEnv.smtp.host && appEnv.smtp.from);
}

function createTransport() {
  if (!appEnv.smtp.host || !appEnv.smtp.from) {
    return null;
  }

  return nodemailer.createTransport({
    host: appEnv.smtp.host,
    port: appEnv.smtp.port ?? 587,
    secure: appEnv.smtp.secure ?? false,
    requireTLS: appEnv.smtp.requireTls ?? true,
    tls: {
      servername: appEnv.smtp.host,
      minVersion: "TLSv1.2",
      rejectUnauthorized: true,
    },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    auth:
      appEnv.smtp.user && appEnv.smtp.pass
        ? {
            user: appEnv.smtp.user,
            pass: appEnv.smtp.pass,
          }
        : undefined,
  });
}

export async function sendMagicLinkEmail({
  email,
  loginLink,
}: SendMagicLinkEmailInput) {
  if (!isSmtpConfigured()) {
    logEvent("info", "auth.magic_link.preview", {
      email,
      loginLink,
    });

    return {
      deliveryStatus: "preview" as const,
      deliveryMeta: {
        previewLink: loginLink,
        note: "SMTP non configuré. Lien affiché en mode preview.",
      },
    };
  }

  const transport = createTransport();
  if (!transport || !appEnv.smtp.from) {
    throw new Error("SMTP configuration incomplete.");
  }

  const info = await transport.sendMail({
    from: appEnv.smtp.from,
    to: email,
    subject: "Votre lien de connexion Credit Ops",
    text: [
      "Bonjour,",
      "",
      "Voici votre lien de connexion Credit Ops :",
      loginLink,
      "",
      "Ce lien expire dans 5 minutes.",
    ].join("\n"),
    html: `
      <p>Bonjour,</p>
      <p>Voici votre lien de connexion Credit Ops :</p>
      <p><a href="${loginLink}">${loginLink}</a></p>
      <p>Ce lien expire dans 5 minutes.</p>
    `,
  });

  return {
    deliveryStatus: "sent" as const,
    deliveryMeta: {
      messageId: info.messageId,
    },
  };
}

export async function sendAdminNotificationEmail(input: {
  subject: string;
  text: string;
  html?: string;
  event: string;
  metadata?: Record<string, unknown>;
}) {
  const admins = listAdminUsers();

  if (!admins.length) {
    logEvent("info", "auth.admin_notification.skipped", {
      event: input.event,
      reason: "no-admin-configured",
      ...input.metadata,
    });
    return {
      deliveryStatus: "skipped" as const,
    };
  }

  const recipients = admins.map((admin) => admin.email);

  if (!isSmtpConfigured()) {
    logEvent("info", "auth.admin_notification.preview", {
      event: input.event,
      recipients,
      subject: input.subject,
      text: input.text,
      ...input.metadata,
    });

    return {
      deliveryStatus: "preview" as const,
    };
  }

  const transport = createTransport();
  if (!transport || !appEnv.smtp.from) {
    throw new Error("SMTP configuration incomplete.");
  }

  await transport.sendMail({
    from: appEnv.smtp.from,
    to: recipients.join(", "),
    subject: input.subject,
    text: input.text,
    html: input.html,
  });

  return {
    deliveryStatus: "sent" as const,
  };
}
