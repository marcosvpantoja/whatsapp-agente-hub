import nodemailer from "nodemailer";
import type { RowDataPacket } from "mysql2/promise";
import { pool } from "./db.js";
import { decryptSecret } from "./secrets.js";

type SmtpSettingsRow = RowDataPacket & {
  enabled: number;
  smtpHost: string | null;
  smtpPort: number;
  smtpSecurity: "none" | "starttls" | "ssl_tls";
  smtpUsername: string | null;
  smtpPasswordEncrypted: string | null;
  smtpFromName: string | null;
  smtpFromEmail: string | null;
  smtpReplyToEmail: string | null;
};

type TicketNotificationRow = RowDataPacket & {
  ticketId: string;
  ticketTitle: string;
  ticketStatus: "open" | "in_progress" | "resolved";
  clientUserId: string;
  clientName: string;
  clientEmail: string;
  company: string;
  assignedToId: string | null;
  assignedToName: string | null;
  assignedToEmail: string | null;
};

type MasterRecipientRow = RowDataPacket & {
  id: string;
  email: string;
};

type MailTransportOptions = {
  host: string;
  port: number;
  secure: boolean;
  requireTLS: boolean;
  auth: {
    user: string;
    pass: string;
  };
};

async function getClientSmtpSettings(clientUserId: string) {
  const [rows] = await pool.execute<SmtpSettingsRow[]>(
    `
      SELECT
        enabled,
        smtp_host AS smtpHost,
        smtp_port AS smtpPort,
        smtp_security AS smtpSecurity,
        smtp_username AS smtpUsername,
        smtp_password_encrypted AS smtpPasswordEncrypted,
        smtp_from_name AS smtpFromName,
        smtp_from_email AS smtpFromEmail,
        smtp_reply_to_email AS smtpReplyToEmail
      FROM email_settings
      WHERE user_id = ?
      LIMIT 1
    `,
    [clientUserId],
  );

  const row = rows[0] ?? null;
  if (!row || !row.enabled || !row.smtpHost || !row.smtpFromEmail || !row.smtpPasswordEncrypted) {
    return null;
  }

  return {
    host: row.smtpHost,
    port: row.smtpPort,
    security: row.smtpSecurity,
    username: row.smtpUsername || row.smtpFromEmail,
    password: decryptSecret(row.smtpPasswordEncrypted),
    fromName: row.smtpFromName || undefined,
    fromEmail: row.smtpFromEmail,
    replyToEmail: row.smtpReplyToEmail || undefined,
  };
}

async function getTicketNotificationContext(ticketId: string) {
  const [rows] = await pool.execute<TicketNotificationRow[]>(
    `
      SELECT
        t.id AS ticketId,
        t.title AS ticketTitle,
        t.status AS ticketStatus,
        t.client_user_id AS clientUserId,
        t.client_name_snapshot AS clientName,
        t.email_snapshot AS clientEmail,
        t.company_snapshot AS company,
        t.assigned_to_user_id AS assignedToId,
        assignee.name AS assignedToName,
        assignee.email AS assignedToEmail
      FROM tickets t
      LEFT JOIN users assignee ON assignee.id = t.assigned_to_user_id
      WHERE t.id = ?
      LIMIT 1
    `,
    [ticketId],
  );

  return rows[0] ?? null;
}

async function getMasterRecipients() {
  const [rows] = await pool.execute<MasterRecipientRow[]>(
    `
      SELECT id, email
      FROM users
      WHERE role = 'master'
        AND status = 'active'
        AND email IS NOT NULL
        AND email <> ''
      ORDER BY name ASC
    `,
  );

  return rows;
}

function buildTransportOptions(settings: NonNullable<Awaited<ReturnType<typeof getClientSmtpSettings>>>) {
  const secure = settings.security === "ssl_tls";
  const requireTLS = settings.security === "starttls";

  const transportOptions: MailTransportOptions = {
    host: settings.host,
    port: settings.port,
    secure,
    requireTLS,
    auth: {
      user: settings.username,
      pass: settings.password,
    },
  };

  return transportOptions;
}

async function sendViaClientSmtp(clientUserId: string, recipients: string[], subject: string, text: string, html: string) {
  const uniqueRecipients = [...new Set(recipients.map((item) => item.trim().toLowerCase()).filter(Boolean))];

  if (uniqueRecipients.length === 0) {
    return false;
  }

  const smtpSettings = await getClientSmtpSettings(clientUserId);
  if (!smtpSettings) {
    return false;
  }

  const transporter = nodemailer.createTransport(buildTransportOptions(smtpSettings));
  const from = smtpSettings.fromName ? `${smtpSettings.fromName} <${smtpSettings.fromEmail}>` : smtpSettings.fromEmail;

  await transporter.sendMail({
    from,
    to: uniqueRecipients.join(", "),
    replyTo: smtpSettings.replyToEmail,
    subject,
    text,
    html,
  });

  return true;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function notifyTicketCreated(ticketId: string) {
  const context = await getTicketNotificationContext(ticketId);
  if (!context) {
    return false;
  }

  const recipients = (await getMasterRecipients()).map((item) => item.email);
  const subject = `[Chamado] Novo ticket aberto: ${context.ticketTitle}`;
  const text =
    `Novo chamado aberto por ${context.clientName} (${context.company}).\n` +
    `Titulo: ${context.ticketTitle}\n` +
    `Status: ${context.ticketStatus}\n` +
    `Ticket: ${context.ticketId}`;
  const html =
    `<p>Novo chamado aberto por <strong>${escapeHtml(context.clientName)}</strong> (${escapeHtml(context.company)}).</p>` +
    `<p><strong>Titulo:</strong> ${escapeHtml(context.ticketTitle)}<br />` +
    `<strong>Status:</strong> ${escapeHtml(context.ticketStatus)}<br />` +
    `<strong>Ticket:</strong> ${escapeHtml(context.ticketId)}</p>`;

  return sendViaClientSmtp(context.clientUserId, recipients, subject, text, html);
}

export async function notifyTicketClientReply(ticketId: string, noteText: string) {
  const context = await getTicketNotificationContext(ticketId);
  if (!context) {
    return false;
  }

  const recipients = context.assignedToEmail
    ? [context.assignedToEmail]
    : (await getMasterRecipients()).map((item) => item.email);
  const subject = `[Chamado] Cliente respondeu: ${context.ticketTitle}`;
  const text =
    `${context.clientName} respondeu ao chamado ${context.ticketId}.\n` +
    `Titulo: ${context.ticketTitle}\n` +
    `Mensagem: ${noteText}`;
  const html =
    `<p><strong>${escapeHtml(context.clientName)}</strong> respondeu ao chamado ${escapeHtml(context.ticketId)}.</p>` +
    `<p><strong>Titulo:</strong> ${escapeHtml(context.ticketTitle)}</p>` +
    `<p>${escapeHtml(noteText)}</p>`;

  return sendViaClientSmtp(context.clientUserId, recipients, subject, text, html);
}

export async function notifyTicketMasterReply(ticketId: string, noteText: string) {
  const context = await getTicketNotificationContext(ticketId);
  if (!context) {
    return false;
  }

  const subject = `[Chamado] Atualizacao no seu ticket: ${context.ticketTitle}`;
  const text =
    `Seu chamado ${context.ticketId} recebeu uma resposta da equipe.\n` +
    `Titulo: ${context.ticketTitle}\n` +
    `Mensagem: ${noteText}`;
  const html =
    `<p>Seu chamado <strong>${escapeHtml(context.ticketId)}</strong> recebeu uma resposta da equipe.</p>` +
    `<p><strong>Titulo:</strong> ${escapeHtml(context.ticketTitle)}</p>` +
    `<p>${escapeHtml(noteText)}</p>`;

  return sendViaClientSmtp(context.clientUserId, [context.clientEmail], subject, text, html);
}

export async function notifyTicketStatusChanged(ticketId: string, nextStatus: string) {
  const context = await getTicketNotificationContext(ticketId);
  if (!context) {
    return false;
  }

  const subject = `[Chamado] Status atualizado: ${context.ticketTitle}`;
  const text =
    `O status do seu chamado ${context.ticketId} foi atualizado para ${nextStatus}.\n` +
    `Titulo: ${context.ticketTitle}`;
  const html =
    `<p>O status do seu chamado <strong>${escapeHtml(context.ticketId)}</strong> foi atualizado para <strong>${escapeHtml(nextStatus)}</strong>.</p>` +
    `<p><strong>Titulo:</strong> ${escapeHtml(context.ticketTitle)}</p>`;

  return sendViaClientSmtp(context.clientUserId, [context.clientEmail], subject, text, html);
}

export async function notifyTicketAssigned(ticketId: string) {
  const context = await getTicketNotificationContext(ticketId);
  if (!context || !context.assignedToEmail) {
    return false;
  }

  const subject = `[Chamado] Ticket atribuido: ${context.ticketTitle}`;
  const text =
    `O chamado ${context.ticketId} foi atribuido a voce.\n` +
    `Cliente: ${context.clientName}\n` +
    `Empresa: ${context.company}\n` +
    `Titulo: ${context.ticketTitle}`;
  const html =
    `<p>O chamado <strong>${escapeHtml(context.ticketId)}</strong> foi atribuido a voce.</p>` +
    `<p><strong>Cliente:</strong> ${escapeHtml(context.clientName)}<br />` +
    `<strong>Empresa:</strong> ${escapeHtml(context.company)}<br />` +
    `<strong>Titulo:</strong> ${escapeHtml(context.ticketTitle)}</p>`;

  return sendViaClientSmtp(context.clientUserId, [context.assignedToEmail], subject, text, html);
}
