import nodemailer from "nodemailer";

import {
  getAppMetadataValue,
  getOldestPendingAdminDigestEvent,
  listAdminUsers,
  listPendingAdminDigestEvents,
  markAdminDigestEventsSent,
  type AdminDigestEventRecord,
  setAppMetadataValue,
} from "@/lib/auth/auth-repository";
import { appEnv } from "@/lib/env";
import { logEvent } from "@/lib/logger";
import { formatDateTime } from "@/lib/utils";

interface SendMagicLinkEmailInput {
  email: string;
  loginLink: string;
}

const ADMIN_DIGEST_LAST_SENT_KEY = "admin_digest_last_sent_at";
const ADMIN_DIGEST_INTERVAL_MS = 60 * 60 * 1000;
const ADMIN_DIGEST_CHECK_INTERVAL_MS = 5 * 60 * 1000;

declare global {
  var __creditOpsAdminDigestSchedulerStarted: boolean | undefined;
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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDigestEventLabel(eventType: AdminDigestEventRecord["eventType"]) {
  return eventType === "non-admin-connection"
    ? "Connexion non-admin"
    : "Feedback de fin de session";
}

function buildDigestHtml(events: AdminDigestEventRecord[], sentAt: string) {
  const connectionEvents = events.filter(
    (event) => event.eventType === "non-admin-connection",
  );
  const feedbackEvents = events.filter(
    (event) => event.eventType === "non-admin-feedback",
  );

  const rows = events
    .map((event) => {
      const reason =
        typeof event.payload?.reason === "string" ? event.payload.reason : "";
      const feedback =
        typeof event.payload?.feedbackText === "string"
          ? event.payload.feedbackText
          : "";
      const sessionExpiresAt =
        typeof event.payload?.sessionExpiresAt === "string"
          ? event.payload.sessionExpiresAt
          : "";

      return `
        <tr>
          <td style="padding:12px 14px;border-bottom:1px solid #dce4f2;font-weight:600;color:#151722;">${escapeHtml(
            formatDigestEventLabel(event.eventType),
          )}</td>
          <td style="padding:12px 14px;border-bottom:1px solid #dce4f2;color:#26314a;">${escapeHtml(
            event.userFullName,
          )}<br><span style="color:#67738d;font-size:13px;">${escapeHtml(
            event.userEmail,
          )}</span></td>
          <td style="padding:12px 14px;border-bottom:1px solid #dce4f2;color:#26314a;">${escapeHtml(
            formatDateTime(event.createdAt),
          )}</td>
          <td style="padding:12px 14px;border-bottom:1px solid #dce4f2;color:#26314a;line-height:1.55;">
            ${
              event.eventType === "non-admin-connection"
                ? `Session temporaire créée${
                    sessionExpiresAt
                      ? `<br><span style="color:#67738d;font-size:13px;">Expiration : ${escapeHtml(
                          formatDateTime(sessionExpiresAt),
                        )}</span>`
                      : ""
                  }`
                : `${reason ? `<strong>Fin de session :</strong> ${escapeHtml(reason)}<br>` : ""}${
                    feedback
                      ? `<strong>Feedback :</strong><br>${escapeHtml(feedback).replace(/\n/g, "<br>")}`
                      : "Aucun détail complémentaire."
                  }`
            }
          </td>
        </tr>
      `;
    })
    .join("");

  return `
    <!DOCTYPE html>
    <html lang="fr-FR">
      <head>
        <meta charset="utf-8" />
        <title>Résumé horaire Credit Ops</title>
      </head>
      <body style="margin:0;padding:24px;background:#f3f6fb;font-family:Arial,Helvetica,sans-serif;color:#151722;">
        <div style="max-width:900px;margin:0 auto;background:#ffffff;border:1px solid #dce4f2;border-radius:24px;overflow:hidden;">
          <div style="padding:28px 32px;background:linear-gradient(180deg,#f2f6ff 0%,#ffffff 100%);border-bottom:1px solid #dce4f2;">
            <div style="display:inline-block;padding:6px 10px;border-radius:999px;background:#edf2ff;color:#20409a;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Résumé horaire</div>
            <h1 style="margin:14px 0 8px;font-size:34px;line-height:1.05;color:#151722;">Activité non-admin Credit Ops</h1>
            <p style="margin:0;color:#67738d;font-size:16px;line-height:1.65;">
              Synthèse générée le ${escapeHtml(formatDateTime(sentAt))} pour les connexions et feedbacks utilisateurs non-admin.
            </p>
          </div>

          <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;padding:24px 32px;">
            <div style="padding:16px;border:1px solid #dce4f2;border-radius:18px;background:#fafbfd;">
              <div style="color:#67738d;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Événements</div>
              <div style="margin-top:8px;font-size:30px;font-weight:700;color:#151722;">${events.length}</div>
            </div>
            <div style="padding:16px;border:1px solid #dce4f2;border-radius:18px;background:#fafbfd;">
              <div style="color:#67738d;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Connexions</div>
              <div style="margin-top:8px;font-size:30px;font-weight:700;color:#151722;">${connectionEvents.length}</div>
            </div>
            <div style="padding:16px;border:1px solid #dce4f2;border-radius:18px;background:#fafbfd;">
              <div style="color:#67738d;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Feedbacks</div>
              <div style="margin-top:8px;font-size:30px;font-weight:700;color:#151722;">${feedbackEvents.length}</div>
            </div>
          </div>

          <div style="padding:0 32px 32px;">
            <table style="width:100%;border-collapse:collapse;border:1px solid #dce4f2;border-radius:18px;overflow:hidden;background:#ffffff;">
              <thead>
                <tr style="background:#f6f8fc;">
                  <th style="padding:12px 14px;text-align:left;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#67738d;">Type</th>
                  <th style="padding:12px 14px;text-align:left;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#67738d;">Utilisateur</th>
                  <th style="padding:12px 14px;text-align:left;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#67738d;">Horodatage</th>
                  <th style="padding:12px 14px;text-align:left;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#67738d;">Détails</th>
                </tr>
              </thead>
              <tbody>
                ${rows}
              </tbody>
            </table>
          </div>
        </div>
      </body>
    </html>
  `;
}

function buildDigestText(events: AdminDigestEventRecord[], sentAt: string) {
  return [
    "Résumé horaire Credit Ops",
    "",
    `Généré le : ${formatDateTime(sentAt)}`,
    `Total d'événements : ${events.length}`,
    "",
    ...events.map((event) => {
      const feedback =
        typeof event.payload?.feedbackText === "string"
          ? event.payload.feedbackText
          : "";
      const reason =
        typeof event.payload?.reason === "string" ? event.payload.reason : "";
      const sessionExpiresAt =
        typeof event.payload?.sessionExpiresAt === "string"
          ? event.payload.sessionExpiresAt
          : "";

      return [
        `Type : ${formatDigestEventLabel(event.eventType)}`,
        `Utilisateur : ${event.userFullName} <${event.userEmail}>`,
        `Horodatage : ${formatDateTime(event.createdAt)}`,
        reason ? `Motif : ${reason}` : null,
        sessionExpiresAt
          ? `Expiration de session : ${formatDateTime(sessionExpiresAt)}`
          : null,
        feedback ? `Feedback : ${feedback}` : null,
        "",
      ]
        .filter(Boolean)
        .join("\n");
    }),
  ].join("\n");
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

export async function sendQueuedAdminDigestIfDue() {
  const admins = listAdminUsers();

  if (!admins.length) {
    logEvent("info", "auth.admin_digest.skipped", {
      reason: "no-admin-configured",
    });
    return { status: "skipped" as const };
  }

  const oldestPendingEvent = getOldestPendingAdminDigestEvent();
  if (!oldestPendingEvent) {
    return { status: "empty" as const };
  }

  const now = new Date();
  const lastSentAt = getAppMetadataValue(ADMIN_DIGEST_LAST_SENT_KEY);
  const referenceDate = lastSentAt
    ? new Date(lastSentAt)
    : new Date(oldestPendingEvent.createdAt);

  if (now.getTime() - referenceDate.getTime() < ADMIN_DIGEST_INTERVAL_MS) {
    return { status: "not-due" as const };
  }

  const pendingEvents = listPendingAdminDigestEvents();
  if (!pendingEvents.length) {
    return { status: "empty" as const };
  }

  const sentAt = now.toISOString();
  const subject = `Credit Ops · Résumé horaire non-admin (${pendingEvents.length})`;
  const html = buildDigestHtml(pendingEvents, sentAt);
  const text = buildDigestText(pendingEvents, sentAt);
  const recipients = admins.map((admin) => admin.email);

  if (!isSmtpConfigured()) {
    logEvent("info", "auth.admin_digest.preview", {
      recipients,
      subject,
      eventsCount: pendingEvents.length,
    });
  } else {
    const transport = createTransport();
    if (!transport || !appEnv.smtp.from) {
      throw new Error("SMTP configuration incomplete.");
    }

    await transport.sendMail({
      from: appEnv.smtp.from,
      to: recipients.join(", "),
      subject,
      text,
      html,
    });
  }

  markAdminDigestEventsSent(
    pendingEvents.map((event) => event.id),
    sentAt,
  );
  setAppMetadataValue(ADMIN_DIGEST_LAST_SENT_KEY, sentAt);

  logEvent("info", "auth.admin_digest.sent", {
    recipients,
    subject,
    eventsCount: pendingEvents.length,
  });

  return {
    status: "sent" as const,
    eventsCount: pendingEvents.length,
  };
}

export function ensureAdminDigestScheduler() {
  if (typeof window !== "undefined") {
    return;
  }

  if (globalThis.__creditOpsAdminDigestSchedulerStarted) {
    return;
  }

  globalThis.__creditOpsAdminDigestSchedulerStarted = true;
  void sendQueuedAdminDigestIfDue();

  const timer = setInterval(() => {
    void sendQueuedAdminDigestIfDue();
  }, ADMIN_DIGEST_CHECK_INTERVAL_MS);

  timer.unref?.();
}
