import nodemailer from "nodemailer";

import {
  getAppMetadataValue,
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

const FEEDBACK_DIGEST_LAST_SENT_KEY = "admin_feedback_digest_last_sent_at";
const FEEDBACK_DIGEST_INTERVAL_MS = 60 * 60 * 1000;
const DIGEST_SCHEDULER_INTERVAL_MS = 5 * 60 * 1000;

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

function toParisDateKey(value: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function isConnectionEvent(event: AdminDigestEventRecord) {
  return (
    event.eventType === "application-login" ||
    event.eventType === "non-admin-connection"
  );
}

function isFeedbackEvent(event: AdminDigestEventRecord) {
  return event.eventType === "non-admin-feedback";
}

function getConnectionRole(event: AdminDigestEventRecord) {
  const role =
    typeof event.payload?.userRole === "string" ? event.payload.userRole : null;

  if (role === "admin" || role === "non-admin") {
    return role;
  }

  return event.eventType === "non-admin-connection" ? "non-admin" : "unknown";
}

function buildFeedbackDigestHtml(events: AdminDigestEventRecord[], sentAt: string) {
  const rows = events
    .map((event) => {
      const reason =
        typeof event.payload?.reason === "string" ? event.payload.reason : "";
      const feedback =
        typeof event.payload?.feedbackText === "string"
          ? event.payload.feedbackText
          : "";

      return `
        <tr>
          <td style="padding:12px 14px;border-bottom:1px solid #dce4f2;color:#151722;font-weight:600;">${escapeHtml(
            event.userFullName,
          )}<br><span style="color:#67738d;font-size:13px;">${escapeHtml(
            event.userEmail,
          )}</span></td>
          <td style="padding:12px 14px;border-bottom:1px solid #dce4f2;color:#26314a;">${escapeHtml(
            formatDateTime(event.createdAt),
          )}</td>
          <td style="padding:12px 14px;border-bottom:1px solid #dce4f2;color:#26314a;">${escapeHtml(
            reason || "manual-logout",
          )}</td>
          <td style="padding:12px 14px;border-bottom:1px solid #dce4f2;color:#26314a;line-height:1.6;">${escapeHtml(
            feedback,
          ).replace(/\n/g, "<br>")}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <!DOCTYPE html>
    <html lang="fr-FR">
      <head>
        <meta charset="utf-8" />
        <title>Resume horaire Credit Ops</title>
      </head>
      <body style="margin:0;padding:24px;background:#f3f6fb;font-family:Arial,Helvetica,sans-serif;color:#151722;">
        <div style="max-width:900px;margin:0 auto;background:#ffffff;border:1px solid #dce4f2;border-radius:24px;overflow:hidden;">
          <div style="padding:28px 32px;background:linear-gradient(180deg,#f2f6ff 0%,#ffffff 100%);border-bottom:1px solid #dce4f2;">
            <div style="display:inline-block;padding:6px 10px;border-radius:999px;background:#edf2ff;color:#20409a;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Resume horaire</div>
            <h1 style="margin:14px 0 8px;font-size:34px;line-height:1.05;color:#151722;">Feedbacks de fin de session</h1>
            <p style="margin:0;color:#67738d;font-size:16px;line-height:1.65;">
              Synthese generee le ${escapeHtml(formatDateTime(sentAt))} pour les feedbacks utilisateurs non-admin.
            </p>
          </div>

          <div style="padding:24px 32px;">
            <table style="width:100%;border-collapse:collapse;border:1px solid #dce4f2;border-radius:18px;overflow:hidden;background:#ffffff;">
              <thead>
                <tr style="background:#f6f8fc;">
                  <th style="padding:12px 14px;text-align:left;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#67738d;">Utilisateur</th>
                  <th style="padding:12px 14px;text-align:left;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#67738d;">Horodatage</th>
                  <th style="padding:12px 14px;text-align:left;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#67738d;">Motif</th>
                  <th style="padding:12px 14px;text-align:left;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#67738d;">Feedback</th>
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

function buildFeedbackDigestText(events: AdminDigestEventRecord[], sentAt: string) {
  return [
    "Resume horaire Credit Ops - feedbacks de fin de session",
    "",
    `Genere le : ${formatDateTime(sentAt)}`,
    "",
    ...events.map((event) => {
      const reason =
        typeof event.payload?.reason === "string" ? event.payload.reason : "";
      const feedback =
        typeof event.payload?.feedbackText === "string"
          ? event.payload.feedbackText
          : "";

      return [
        `Utilisateur : ${event.userFullName} <${event.userEmail}>`,
        `Horodatage : ${formatDateTime(event.createdAt)}`,
        `Motif : ${reason || "manual-logout"}`,
        `Feedback : ${feedback}`,
        "",
      ].join("\n");
    }),
  ].join("\n");
}

function buildDailyConnectionsHtml(events: AdminDigestEventRecord[], reportDate: string) {
  const adminConnections = events.filter(
    (event) => getConnectionRole(event) === "admin",
  );
  const nonAdminConnections = events.filter(
    (event) => getConnectionRole(event) === "non-admin",
  );

  const rows = events
    .map((event) => {
      const sessionExpiresAt =
        typeof event.payload?.sessionExpiresAt === "string"
          ? event.payload.sessionExpiresAt
          : "";

      return `
        <tr>
          <td style="padding:12px 14px;border-bottom:1px solid #dce4f2;color:#151722;font-weight:600;">${escapeHtml(
            event.userFullName,
          )}<br><span style="color:#67738d;font-size:13px;">${escapeHtml(
            event.userEmail,
          )}</span></td>
          <td style="padding:12px 14px;border-bottom:1px solid #dce4f2;color:#26314a;">${escapeHtml(
            getConnectionRole(event) === "admin" ? "Admin" : "Non-admin",
          )}</td>
          <td style="padding:12px 14px;border-bottom:1px solid #dce4f2;color:#26314a;">${escapeHtml(
            formatDateTime(event.createdAt),
          )}</td>
          <td style="padding:12px 14px;border-bottom:1px solid #dce4f2;color:#26314a;">${
            sessionExpiresAt ? escapeHtml(formatDateTime(sessionExpiresAt)) : "-"
          }</td>
        </tr>
      `;
    })
    .join("");

  return `
    <!DOCTYPE html>
    <html lang="fr-FR">
      <head>
        <meta charset="utf-8" />
        <title>Rapport quotidien des connexions</title>
      </head>
      <body style="margin:0;padding:24px;background:#f3f6fb;font-family:Arial,Helvetica,sans-serif;color:#151722;">
        <div style="max-width:960px;margin:0 auto;background:#ffffff;border:1px solid #dce4f2;border-radius:24px;overflow:hidden;">
          <div style="padding:28px 32px;background:linear-gradient(180deg,#f2f6ff 0%,#ffffff 100%);border-bottom:1px solid #dce4f2;">
            <div style="display:inline-block;padding:6px 10px;border-radius:999px;background:#edf2ff;color:#20409a;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Rapport quotidien</div>
            <h1 style="margin:14px 0 8px;font-size:34px;line-height:1.05;color:#151722;">Connexions a l'application</h1>
            <p style="margin:0;color:#67738d;font-size:16px;line-height:1.65;">
              Synthese quotidienne des connexions Credit Ops pour la journee du ${escapeHtml(reportDate)}.
            </p>
          </div>

          <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;padding:24px 32px;">
            <div style="padding:16px;border:1px solid #dce4f2;border-radius:18px;background:#fafbfd;">
              <div style="color:#67738d;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Connexions totales</div>
              <div style="margin-top:8px;font-size:30px;font-weight:700;color:#151722;">${events.length}</div>
            </div>
            <div style="padding:16px;border:1px solid #dce4f2;border-radius:18px;background:#fafbfd;">
              <div style="color:#67738d;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Admins</div>
              <div style="margin-top:8px;font-size:30px;font-weight:700;color:#151722;">${adminConnections.length}</div>
            </div>
            <div style="padding:16px;border:1px solid #dce4f2;border-radius:18px;background:#fafbfd;">
              <div style="color:#67738d;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Non-admins</div>
              <div style="margin-top:8px;font-size:30px;font-weight:700;color:#151722;">${nonAdminConnections.length}</div>
            </div>
          </div>

          <div style="padding:0 32px 32px;">
            <table style="width:100%;border-collapse:collapse;border:1px solid #dce4f2;border-radius:18px;overflow:hidden;background:#ffffff;">
              <thead>
                <tr style="background:#f6f8fc;">
                  <th style="padding:12px 14px;text-align:left;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#67738d;">Utilisateur</th>
                  <th style="padding:12px 14px;text-align:left;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#67738d;">Type</th>
                  <th style="padding:12px 14px;text-align:left;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#67738d;">Connexion</th>
                  <th style="padding:12px 14px;text-align:left;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#67738d;">Expiration session</th>
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

function buildDailyConnectionsText(events: AdminDigestEventRecord[], reportDate: string) {
  return [
    "Rapport quotidien des connexions Credit Ops",
    "",
    `Journee concernee : ${reportDate}`,
    `Connexions totales : ${events.length}`,
    "",
    ...events.map((event) => {
      const sessionExpiresAt =
        typeof event.payload?.sessionExpiresAt === "string"
          ? event.payload.sessionExpiresAt
          : "";

      return [
        `Utilisateur : ${event.userFullName} <${event.userEmail}>`,
        `Type : ${getConnectionRole(event) === "admin" ? "Admin" : "Non-admin"}`,
        `Connexion : ${formatDateTime(event.createdAt)}`,
        `Expiration de session : ${
          sessionExpiresAt ? formatDateTime(sessionExpiresAt) : "-"
        }`,
        "",
      ].join("\n");
    }),
  ].join("\n");
}

async function sendAdminEmail(input: {
  subject: string;
  text: string;
  html: string;
  previewEvent: string;
  previewMetadata?: Record<string, unknown>;
}) {
  const admins = listAdminUsers();

  if (!admins.length) {
    logEvent("info", "auth.admin_notification.skipped", {
      reason: "no-admin-configured",
      subject: input.subject,
    });
    return { status: "skipped" as const };
  }

  const recipients = admins.map((admin) => admin.email);

  if (!isSmtpConfigured()) {
    logEvent("info", input.previewEvent, {
      recipients,
      subject: input.subject,
      ...input.previewMetadata,
    });
    return { status: "preview" as const };
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

  return { status: "sent" as const };
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
        note: "SMTP non configure. Lien affiche en mode preview.",
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
  const feedbackEvents = listPendingAdminDigestEvents().filter(isFeedbackEvent);

  if (!feedbackEvents.length) {
    return { status: "empty" as const };
  }

  const lastSentAt = getAppMetadataValue(FEEDBACK_DIGEST_LAST_SENT_KEY);
  const referenceDate = lastSentAt
    ? new Date(lastSentAt)
    : new Date(feedbackEvents[0].createdAt);

  if (Date.now() - referenceDate.getTime() < FEEDBACK_DIGEST_INTERVAL_MS) {
    return { status: "not-due" as const };
  }

  const sentAt = new Date().toISOString();
  const subject = `Credit Ops - Resume horaire feedback (${feedbackEvents.length})`;
  const html = buildFeedbackDigestHtml(feedbackEvents, sentAt);
  const text = buildFeedbackDigestText(feedbackEvents, sentAt);

  await sendAdminEmail({
    subject,
    text,
    html,
    previewEvent: "auth.admin_feedback_digest.preview",
    previewMetadata: {
      eventsCount: feedbackEvents.length,
    },
  });

  markAdminDigestEventsSent(
    feedbackEvents.map((event) => event.id),
    sentAt,
  );
  setAppMetadataValue(FEEDBACK_DIGEST_LAST_SENT_KEY, sentAt);

  logEvent("info", "auth.admin_feedback_digest.sent", {
    eventsCount: feedbackEvents.length,
  });

  return {
    status: "sent" as const,
    eventsCount: feedbackEvents.length,
  };
}

export async function sendQueuedDailyConnectionsReportIfDue() {
  const connectionEvents = listPendingAdminDigestEvents().filter(isConnectionEvent);

  if (!connectionEvents.length) {
    return { status: "empty" as const };
  }

  const todayParis = toParisDateKey(new Date().toISOString());
  const groupedByDay = new Map<string, AdminDigestEventRecord[]>();

  for (const event of connectionEvents) {
    const dayKey = toParisDateKey(event.createdAt);
    const bucket = groupedByDay.get(dayKey) ?? [];
    bucket.push(event);
    groupedByDay.set(dayKey, bucket);
  }

  const dueDay = [...groupedByDay.keys()].sort()[0];
  if (!dueDay || dueDay >= todayParis) {
    return { status: "not-due" as const };
  }

  const eventsForDay = groupedByDay.get(dueDay) ?? [];
  if (!eventsForDay.length) {
    return { status: "empty" as const };
  }

  const sentAt = new Date().toISOString();
  const subject = `Credit Ops - Rapport quotidien connexions (${dueDay})`;
  const html = buildDailyConnectionsHtml(eventsForDay, dueDay);
  const text = buildDailyConnectionsText(eventsForDay, dueDay);

  await sendAdminEmail({
    subject,
    text,
    html,
    previewEvent: "auth.daily_connections_report.preview",
    previewMetadata: {
      reportDate: dueDay,
      eventsCount: eventsForDay.length,
    },
  });

  markAdminDigestEventsSent(
    eventsForDay.map((event) => event.id),
    sentAt,
  );

  logEvent("info", "auth.daily_connections_report.sent", {
    reportDate: dueDay,
    eventsCount: eventsForDay.length,
  });

  return {
    status: "sent" as const,
    reportDate: dueDay,
    eventsCount: eventsForDay.length,
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
  void sendQueuedDailyConnectionsReportIfDue();

  const timer = setInterval(() => {
    void sendQueuedAdminDigestIfDue();
    void sendQueuedDailyConnectionsReportIfDue();
  }, DIGEST_SCHEDULER_INTERVAL_MS);

  timer.unref?.();
}
