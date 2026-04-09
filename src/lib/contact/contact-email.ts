import nodemailer from "nodemailer";

import { appEnv } from "@/lib/env";
import { logEvent } from "@/lib/logger";

const CONTACT_RECIPIENT = "contact@eleob.fr";

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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendContactRequestEmail(input: {
  fullName: string;
  email: string;
  company?: string;
  message: string;
}) {
  if (!isSmtpConfigured()) {
    logEvent("info", "contact.request.preview", input);
    return {
      deliveryStatus: "preview" as const,
    };
  }

  const transport = createTransport();
  if (!transport || !appEnv.smtp.from) {
    throw new Error("SMTP configuration incomplete.");
  }

  const subject = `Nouveau message site Credit Ops · ${input.fullName}`;
  const text = [
    "Nouveau message depuis le site Credit Ops",
    "",
    `Nom : ${input.fullName}`,
    `Email : ${input.email}`,
    `Société : ${input.company || "Non renseignée"}`,
    "",
    "Message :",
    input.message,
  ].join("\n");

  const html = `
    <!DOCTYPE html>
    <html lang="fr-FR">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(subject)}</title>
      </head>
      <body style="margin:0;padding:24px;background:#f3f6fb;font-family:Arial,Helvetica,sans-serif;color:#151722;">
        <div style="max-width:760px;margin:0 auto;background:#ffffff;border:1px solid #dce4f2;border-radius:24px;overflow:hidden;">
          <div style="padding:24px 28px;background:linear-gradient(180deg,#f2f6ff 0%,#ffffff 100%);border-bottom:1px solid #dce4f2;">
            <div style="display:inline-block;padding:6px 10px;border-radius:999px;background:#edf2ff;color:#20409a;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Contact site</div>
            <h1 style="margin:14px 0 0;font-size:30px;line-height:1.05;color:#151722;">Nouveau message reçu</h1>
          </div>
          <div style="padding:24px 28px;">
            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="padding:10px 0;color:#67738d;font-weight:700;width:140px;">Nom</td>
                <td style="padding:10px 0;color:#151722;">${escapeHtml(input.fullName)}</td>
              </tr>
              <tr>
                <td style="padding:10px 0;color:#67738d;font-weight:700;">Email</td>
                <td style="padding:10px 0;color:#151722;">${escapeHtml(input.email)}</td>
              </tr>
              <tr>
                <td style="padding:10px 0;color:#67738d;font-weight:700;">Société</td>
                <td style="padding:10px 0;color:#151722;">${escapeHtml(input.company || "Non renseignée")}</td>
              </tr>
            </table>
            <div style="margin-top:18px;padding:18px;border:1px solid #dce4f2;border-radius:18px;background:#fafbfd;">
              <div style="margin-bottom:10px;color:#67738d;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Message</div>
              <div style="color:#26314a;line-height:1.7;white-space:pre-wrap;">${escapeHtml(input.message)}</div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  await transport.sendMail({
    from: appEnv.smtp.from,
    to: CONTACT_RECIPIENT,
    replyTo: input.email,
    subject,
    text,
    html,
  });

  return {
    deliveryStatus: "sent" as const,
  };
}
