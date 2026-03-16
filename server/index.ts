import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import { ZodError, z } from "zod";
import {
  attachCurrentUser,
  clearSessionCookie,
  createSessionToken,
  hashSessionToken,
  requireAuth,
  requireAnyRole,
  requireRole,
  setSessionCookie,
  type AuthenticatedRequest,
} from "./auth.js";
import { env } from "./env.js";
import {
  addTicketNote,
  addClientTicketNote,
  assignTicket,
  cancelReservation,
  changeUserPassword,
  createClient,
  createClientTicket,
  createReservation,
  createRoom,
  createSession,
  deleteRoom,
  getClientDashboard,
  getClientProfile,
  getClientSettings,
  getTicketAttachmentForUser,
  getMasterDashboard,
  getPublicUserById,
  getUserForLogin,
  listClientReservations,
  listClientRooms,
  listClientTickets,
  listClients,
  listMasterTickets,
  listSupportUsers,
  recordSuccessfulLogin,
  resetClientPassword,
  revokeSession,
  setWhatsappConnectionStatus,
  updateClient,
  updateClientSettings,
  updateClientStatus,
  updateReservation,
  updateRoom,
  updateTicketStatus,
} from "./data.js";
import { pool } from "./db.js";
import {
  disconnectEvolutionInstance,
  generateEvolutionQrCode,
  getEvolutionConnectionState,
  getEvolutionInstanceProfile,
} from "./evolution-api.js";
import {
  IntegrationError,
  checkIntegrationAvailability,
  consultIntegrationEvents,
  createIntegrationEvent,
  deleteIntegrationEvent,
  listIntegrationCalendars,
  recordIntegrationAudit,
  updateIntegrationEvent,
} from "./integration-api.js";
import {
  notifyTicketAssigned,
  notifyTicketClientReply,
  notifyTicketCreated,
  notifyTicketMasterReply,
  notifyTicketStatusChanged,
} from "./mailer.js";
import { ensureAppSchema } from "./schema.js";
import { seedDatabaseIfNeeded } from "./seed.js";
import { HttpError, asyncHandler } from "./utils.js";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, "..", "dist");
const shouldServeFrontend = env.NODE_ENV === "production";
const listenPort = shouldServeFrontend ? env.APP_PORT : env.API_PORT;
const listenHost = env.APP_HOST;

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Muitas tentativas de login. Tente novamente em alguns minutos." },
});

const roomSchema = z.object({
  name: z.string().trim().min(1, "O nome da sala e obrigatorio."),
  floor: z.coerce.number().int().positive("Andar invalido."),
  capacity: z.coerce.number().int().positive("Capacidade invalida."),
  description: z.string().optional().default(""),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Cor invalida."),
  active: z.boolean(),
});

const settingsSchema = z
  .object({
    systemName: z.string().trim().min(1, "Nome do sistema e obrigatorio."),
    timezone: z.string().trim().min(1, "Fuso horario e obrigatorio."),
    themePreference: z.enum(["dark", "light"]),
    bookingStartTime: z.string().regex(/^\d{2}:\d{2}$/, "Horario inicial invalido."),
    bookingEndTime: z.string().regex(/^\d{2}:\d{2}$/, "Horario final invalido."),
    maxParticipants: z.coerce.number().int().positive("Limite de participantes invalido."),
    minAdvanceMinutes: z.coerce.number().int().nonnegative("Antecedencia minima invalida."),
    emailEnabled: z.boolean(),
    smtpHost: z.string().trim().default(""),
    smtpPort: z.coerce.number().int().min(1, "Porta SMTP invalida.").max(65535, "Porta SMTP invalida."),
    smtpSecurity: z.enum(["none", "starttls", "ssl_tls"]),
    smtpUsername: z.string().trim().default(""),
    smtpPassword: z.string().default(""),
    smtpFromName: z.string().trim().default(""),
    smtpFromEmail: z.string().trim().default(""),
    smtpReplyToEmail: z.string().trim().default(""),
  })
  .superRefine((value, context) => {
    const emailSchema = z.string().email("E-mail invalido.");

    if (value.smtpFromEmail && !emailSchema.safeParse(value.smtpFromEmail).success) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["smtpFromEmail"],
        message: "E-mail remetente invalido.",
      });
    }

    if (value.smtpReplyToEmail && !emailSchema.safeParse(value.smtpReplyToEmail).success) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["smtpReplyToEmail"],
        message: "E-mail de resposta invalido.",
      });
    }
  });

const loginSchema = z.object({
  email: z.string().email("E-mail invalido."),
  password: z.string().min(1, "Senha obrigatoria."),
});

const changePasswordSchema = z
  .object({
    currentPassword: z.string().optional(),
    newPassword: z.string().min(8, "A nova senha deve ter pelo menos 8 caracteres."),
    confirmPassword: z.string().min(1, "Confirme a nova senha."),
  })
  .superRefine((value, context) => {
    if (value.newPassword !== value.confirmPassword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "A confirmacao da nova senha nao confere.",
      });
    }
  });

const attachmentSchema = z.object({
  fileName: z.string().trim().min(1, "Nome do anexo obrigatorio.").max(255, "Nome do anexo invalido."),
  mimeType: z.string().trim().min(1, "Tipo do anexo obrigatorio.").max(150, "Tipo do anexo invalido."),
  contentBase64: z.string().trim().min(1, "Conteudo do anexo obrigatorio."),
});

const ticketSchema = z.object({
  title: z.string().trim().min(1, "Titulo obrigatorio."),
  description: z.string().trim().min(1, "Descricao obrigatoria."),
  attachments: z.array(attachmentSchema).optional().default([]),
});

const reservationSchema = z.object({
  roomId: z.coerce.number().int().positive("Sala obrigatoria."),
  personName: z.string().trim().min(1, "Responsavel obrigatorio.").max(150, "Responsavel invalido."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data invalida."),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Horario inicial invalido."),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Horario final invalido."),
  meetingLink: z.string().trim().max(1000, "Link da reuniao invalido.").optional().default(""),
  participants: z.coerce.number().int().positive("Quantidade de participantes invalida."),
});

const createClientSchema = z.object({
  name: z.string().trim().min(1, "Nome obrigatorio."),
  email: z.string().email("E-mail invalido."),
  company: z.string().trim().min(1, "Empresa obrigatoria."),
  agentName: z.string().trim().optional().default(""),
});

const updateClientSchema = z.object({
  name: z.string().trim().min(1, "Nome obrigatorio."),
  email: z.string().email("E-mail invalido."),
  company: z.string().trim().min(1, "Empresa obrigatoria."),
  agentName: z.string().trim().optional().default(""),
  whatsappNumber: z.string().trim().optional().nullable().default(""),
});

const clientStatusSchema = z.object({
  status: z.enum(["active", "inactive", "blocked"]),
});

const ticketStatusSchema = z.object({
  status: z.enum(["open", "in_progress", "resolved"]),
});

const ticketNoteSchema = z.object({
  text: z.string().trim().min(1, "Texto da observacao e obrigatorio."),
  internal: z.boolean().optional().default(false),
  attachments: z.array(attachmentSchema).optional().default([]),
});

const ticketAssignSchema = z.object({
  assignedToUserId: z.string().trim().nullable(),
});

function sendIntegrationSuccess(response: express.Response, payload: Record<string, unknown>) {
  return response.json({
    successo: true,
    ...payload,
  });
}

function sendIntegrationError(response: express.Response, error: IntegrationError) {
  return response.status(error.status).json({
    successo: false,
    error: {
      code: error.code,
      message: error.message,
    },
  });
}

function getIntegrationRequestBody(body: unknown) {
  if (body === undefined || body === null) {
    return {};
  }

  if (typeof body !== "object" || Array.isArray(body)) {
    throw new IntegrationError(400, "CAMPO_OBRIGATORIO_AUSENTE", "O corpo da requisicao deve ser um JSON valido.");
  }

  return body as Record<string, unknown>;
}

function getRequiredStringField(body: Record<string, unknown>, field: string, message: string) {
  const rawValue = body[field];

  if (typeof rawValue !== "string" || rawValue.trim() === "") {
    throw new IntegrationError(400, "CAMPO_OBRIGATORIO_AUSENTE", message);
  }

  return rawValue.trim();
}

function getOptionalStringField(body: Record<string, unknown>, field: string) {
  const rawValue = body[field];

  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return undefined;
  }

  if (typeof rawValue !== "string") {
    throw new IntegrationError(400, "CAMPO_INVALIDO", `O campo ${field} precisa ser texto.`);
  }

  const value = rawValue.trim();
  return value === "" ? undefined : value;
}

function getOptionalNullableStringField(body: Record<string, unknown>, field: string) {
  if (!Object.prototype.hasOwnProperty.call(body, field)) {
    return undefined;
  }

  const rawValue = body[field];

  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return null;
  }

  if (typeof rawValue !== "string") {
    throw new IntegrationError(400, "CAMPO_INVALIDO", `O campo ${field} precisa ser texto.`);
  }

  const value = rawValue.trim();
  return value === "" ? null : value;
}

function getRequiredCalendarId(body: Record<string, unknown>, field = "id_calendario") {
  const rawValue = body[field];

  if (rawValue === undefined || rawValue === null || rawValue === "") {
    throw new IntegrationError(400, "ID_DA_SALA_OBRIGATORIO", "id_calendario e obrigatorio.");
  }

  const parsedValue = Number(rawValue);
  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new IntegrationError(400, "ID_DA_SALA_OBRIGATORIO", "id_calendario deve ser um numero inteiro positivo.");
  }

  return parsedValue;
}

function getOptionalCalendarId(body: Record<string, unknown>, field = "id_calendario") {
  const rawValue = body[field];

  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return undefined;
  }

  const parsedValue = Number(rawValue);
  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new IntegrationError(400, "CAMPO_INVALIDO", "id_calendario deve ser um numero inteiro positivo.");
  }

  return parsedValue;
}

function getRequiredDateField(body: Record<string, unknown>, field = "data") {
  const value = getRequiredStringField(body, field, `${field} e obrigatorio.`);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new IntegrationError(400, "FORMATO_DE_DATA_INVALIDO", "data deve estar no formato AAAA-MM-DD.");
  }

  return value;
}

function getRequiredTimeField(body: Record<string, unknown>, field: "hora_inicio" | "hora_fim") {
  const value = getRequiredStringField(body, field, `${field} e obrigatorio.`);

  if (!/^\d{2}:\d{2}$/.test(value)) {
    throw new IntegrationError(400, "FORMATO_DE_HORA_INVALIDO", `${field} deve estar no formato HH:MM.`);
  }

  return value;
}

function validateTimeRange(startTime: string, endTime: string) {
  if (startTime >= endTime) {
    throw new IntegrationError(400, "HORARIO_FINAL_ANTES_DO_INICIAL", "hora_fim deve ser maior que hora_inicio.");
  }
}

function getOptionalEmailField(body: Record<string, unknown>, field: string) {
  const value = getOptionalStringField(body, field);
  if (!value) {
    return undefined;
  }

  return value.toLowerCase();
}

function getOptionalEmailListField(body: Record<string, unknown>, field: string) {
  const rawValue = body[field];

  if (rawValue === undefined || rawValue === null) {
    return undefined;
  }

  let items: string[];

  if (typeof rawValue === "string") {
    items = rawValue
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  } else if (Array.isArray(rawValue)) {
    items = rawValue.map((item, index) => {
      if (typeof item !== "string" || item.trim() === "") {
        throw new IntegrationError(400, "CAMPO_INVALIDO", `${field}[${index}] precisa ser um e-mail valido.`);
      }

      return item.trim();
    });
  } else {
    throw new IntegrationError(
      400,
      "CAMPO_INVALIDO",
      `${field} precisa ser uma lista de e-mails ou uma string separada por virgulas.`,
    );
  }

  if (items.length === 0) {
    return undefined;
  }

  const normalizedEmails = items.map((item, index) => {
    const email = item.toLowerCase().trim();
    if (!email) {
      throw new IntegrationError(400, "CAMPO_INVALIDO", `${field}[${index}] precisa ser texto.`);
    }

    return email;
  });

  return [...new Set(normalizedEmails)];
}

function getRequiredReservationId(body: Record<string, unknown>) {
  return getRequiredStringField(body, "id_evento", "id_evento e obrigatorio.");
}

function requireIntegrationApiKey(request: express.Request, response: express.Response, next: express.NextFunction) {
  if (!env.INTEGRATION_API_KEY) {
    return sendIntegrationError(
      response,
      new IntegrationError(503, "INTEGRACAO_NAO_CONFIGURADA", "A chave da API de integracao nao foi configurada."),
    );
  }

  const bearerToken = request.headers.authorization?.startsWith("Bearer ")
    ? request.headers.authorization.slice(7).trim()
    : "";
  const apiKeyHeader = typeof request.headers["x-api-key"] === "string" ? request.headers["x-api-key"].trim() : "";
  const providedKey = apiKeyHeader || bearerToken;

  if (!providedKey || providedKey !== env.INTEGRATION_API_KEY) {
    return sendIntegrationError(
      response,
      new IntegrationError(401, "CHAVE_DE_INTEGRACAO_INVALIDA", "A chave da API de integracao e obrigatoria."),
    );
  }

  return next();
}

function normalizeIntegrationError(error: unknown) {
  if (error instanceof IntegrationError) {
    return error;
  }

  if (error instanceof ZodError) {
    return new IntegrationError(400, "CAMPO_INVALIDO", error.issues[0]?.message || "Dados invalidos.");
  }

  if (error instanceof HttpError) {
    return new IntegrationError(error.status, "ERRO_NO_PROVEDOR_DE_CALENDARIO", error.message);
  }

  if (typeof error === "object" && error && "code" in error) {
    const mysqlError = error as { code?: string; sqlMessage?: string };

    if (mysqlError.code === "ER_SIGNAL_EXCEPTION") {
      return new IntegrationError(
        400,
        "ERRO_NO_PROVEDOR_DE_CALENDARIO",
        mysqlError.sqlMessage || "A operacao foi recusada pelo banco de dados.",
      );
    }

    if (mysqlError.code === "ER_DUP_ENTRY") {
      return new IntegrationError(409, "CAMPO_INVALIDO", "Ja existe um registro com esses dados.");
    }
  }

  return new IntegrationError(500, "ERRO_NO_PROVEDOR_DE_CALENDARIO", "Erro interno do servidor.");
}

async function getSyncedWhatsappData(clientUserId: string) {
  const [connectionState, instanceProfile] = await Promise.all([
    getEvolutionConnectionState(),
    getEvolutionInstanceProfile().catch(() => null),
  ]);
  const connected = connectionState.state === "open";
  const data = await setWhatsappConnectionStatus(clientUserId, connected);

  return {
    ...data,
    phoneNumber: instanceProfile?.phoneNumber || null,
    displayName: instanceProfile?.displayName || data.displayName,
    connectionState: connectionState.state,
    instanceName: instanceProfile?.instanceName || connectionState.instanceName,
    qrCodeBase64: null,
  };
}

app.use(
  helmet({
    crossOriginResourcePolicy: false,
  }),
);
app.use(express.json({ limit: "12mb" }));
app.use(cookieParser());
app.use(attachCurrentUser);

if (!shouldServeFrontend) {
  app.get("/", (request, response) => {
    const hostname = request.hostname || "127.0.0.1";
    response.redirect(`http://${hostname}:${env.APP_PORT}`);
  });
}

app.get(
  "/api/health",
  asyncHandler(async (_request, response) => {
    await pool.execute("SELECT 1");
    response.json({ ok: true });
  }),
);

app.post(
  "/calendarios",
  requireIntegrationApiKey,
  asyncHandler(async (request, response) => {
    const requestPayload = getIntegrationRequestBody(request.body);

    try {
      const calendarios = await listIntegrationCalendars();
      const payload = { calendarios };

      await recordIntegrationAudit({
        operation: "calendarios",
        success: true,
        requestPayload,
        responsePayload: payload,
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"] || null,
      });

      return sendIntegrationSuccess(response, payload);
    } catch (error) {
      const integrationError = normalizeIntegrationError(error);

      await recordIntegrationAudit({
        operation: "calendarios",
        success: false,
        requestPayload,
        errorCode: integrationError.code,
        errorMessage: integrationError.message,
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"] || null,
      });

      return sendIntegrationError(response, integrationError);
    }
  }),
);

app.post(
  "/disponibilidade",
  requireIntegrationApiKey,
  asyncHandler(async (request, response) => {
    const requestPayload = getIntegrationRequestBody(request.body);

    try {
      const idCalendario = getRequiredCalendarId(requestPayload);
      const data = getRequiredDateField(requestPayload);
      const horaInicio = getRequiredTimeField(requestPayload, "hora_inicio");
      const horaFim = getRequiredTimeField(requestPayload, "hora_fim");

      validateTimeRange(horaInicio, horaFim);

      const disponibilidade = await checkIntegrationAvailability({
        roomId: idCalendario,
        date: data,
        startTime: horaInicio,
        endTime: horaFim,
      });

      await recordIntegrationAudit({
        operation: "disponibilidade",
        success: true,
        roomId: idCalendario,
        requestPayload,
        responsePayload: disponibilidade,
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"] || null,
      });

      return sendIntegrationSuccess(response, disponibilidade);
    } catch (error) {
      const integrationError = normalizeIntegrationError(error);

      await recordIntegrationAudit({
        operation: "disponibilidade",
        success: false,
        roomId: "id_calendario" in requestPayload ? Number(requestPayload.id_calendario) || null : null,
        requestPayload,
        errorCode: integrationError.code,
        errorMessage: integrationError.message,
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"] || null,
      });

      return sendIntegrationError(response, integrationError);
    }
  }),
);

app.post(
  "/criarevento",
  requireIntegrationApiKey,
  asyncHandler(async (request, response) => {
    const requestPayload = getIntegrationRequestBody(request.body);

    try {
      const idCalendario = getRequiredCalendarId(requestPayload);
      const data = getRequiredDateField(requestPayload);
      const horaInicio = getRequiredTimeField(requestPayload, "hora_inicio");
      const horaFim = getRequiredTimeField(requestPayload, "hora_fim");
      const nomeUsuario = getRequiredStringField(requestPayload, "nome_usuario", "nome_usuario e obrigatorio.");
      const nomeEvento = getRequiredStringField(requestPayload, "nome_evento", "nome_evento e obrigatorio.");
      const descricaoEvento = getRequiredStringField(
        requestPayload,
        "descricao_evento",
        "descricao_evento e obrigatorio.",
      );

      validateTimeRange(horaInicio, horaFim);

      const payload = await createIntegrationEvent({
        roomId: idCalendario,
        date: data,
        startTime: horaInicio,
        endTime: horaFim,
        linkReuniao: getOptionalNullableStringField(requestPayload, "link_reuniao"),
        whatsapp: getOptionalStringField(requestPayload, "whatsapp"),
        emailSolicitante: getOptionalEmailField(requestPayload, "email_solicitante"),
        emailsConvidados: getOptionalEmailListField(requestPayload, "emails_convidados"),
        nomeUsuario,
        nomeEvento,
        descricaoEvento,
      });

      await recordIntegrationAudit({
        operation: "criarevento",
        success: true,
        roomId: idCalendario,
        reservationId: payload.id_evento,
        requestPayload,
        responsePayload: payload,
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"] || null,
      });

      return sendIntegrationSuccess(response, payload);
    } catch (error) {
      const integrationError = normalizeIntegrationError(error);

      await recordIntegrationAudit({
        operation: "criarevento",
        success: false,
        roomId: "id_calendario" in requestPayload ? Number(requestPayload.id_calendario) || null : null,
        requestPayload,
        errorCode: integrationError.code,
        errorMessage: integrationError.message,
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"] || null,
      });

      return sendIntegrationError(response, integrationError);
    }
  }),
);

app.post(
  "/atualizarevento",
  requireIntegrationApiKey,
  asyncHandler(async (request, response) => {
    const requestPayload = getIntegrationRequestBody(request.body);

    try {
      const idEvento = getRequiredReservationId(requestPayload);
      const data = getRequiredDateField(requestPayload);
      const horaInicio = getRequiredTimeField(requestPayload, "hora_inicio");
      const horaFim = getRequiredTimeField(requestPayload, "hora_fim");
      const whatsapp = getRequiredStringField(requestPayload, "whatsapp", "whatsapp e obrigatorio.");
      const nomeEvento = getRequiredStringField(requestPayload, "nome_evento", "nome_evento e obrigatorio.");
      const descricaoEvento = getRequiredStringField(
        requestPayload,
        "descricao_evento",
        "descricao_evento e obrigatorio.",
      );

      validateTimeRange(horaInicio, horaFim);

      const payload = await updateIntegrationEvent({
        reservationId: idEvento,
        roomId: getOptionalCalendarId(requestPayload) ?? undefined,
        date: data,
        startTime: horaInicio,
        endTime: horaFim,
        whatsapp,
        linkReuniao: getOptionalNullableStringField(requestPayload, "link_reuniao"),
        emailSolicitante: getOptionalEmailField(requestPayload, "email_solicitante"),
        emailsConvidados: getOptionalEmailListField(requestPayload, "emails_convidados"),
        nomeUsuario: getOptionalStringField(requestPayload, "nome_usuario"),
        nomeEvento,
        descricaoEvento,
      });

      await recordIntegrationAudit({
        operation: "atualizarevento",
        success: true,
        roomId: payload.evento.id_calendario,
        reservationId: payload.id_evento,
        requestPayload,
        responsePayload: payload,
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"] || null,
      });

      return sendIntegrationSuccess(response, payload);
    } catch (error) {
      const integrationError = normalizeIntegrationError(error);

      await recordIntegrationAudit({
        operation: "atualizarevento",
        success: false,
        roomId: "id_calendario" in requestPayload ? Number(requestPayload.id_calendario) || null : null,
        reservationId: typeof requestPayload.id_evento === "string" ? requestPayload.id_evento : null,
        requestPayload,
        errorCode: integrationError.code,
        errorMessage: integrationError.message,
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"] || null,
      });

      return sendIntegrationError(response, integrationError);
    }
  }),
);

app.post(
  "/consultarevento",
  requireIntegrationApiKey,
  asyncHandler(async (request, response) => {
    const requestPayload = getIntegrationRequestBody(request.body);

    try {
      const idEvento = getOptionalStringField(requestPayload, "id_evento");
      const nomeEvento = getOptionalStringField(requestPayload, "nome_evento");
      const nomeUsuario = getOptionalStringField(requestPayload, "nome_usuario");

      if (!idEvento && !nomeEvento && !nomeUsuario) {
        throw new IntegrationError(
          400,
          "CAMPO_OBRIGATORIO_AUSENTE",
          "Informe id_evento, nome_evento ou nome_usuario para consultar.",
        );
      }

      const payload = await consultIntegrationEvents({
        reservationId: idEvento,
        nomeEvento,
        nomeUsuario,
      });

      await recordIntegrationAudit({
        operation: "consultarevento",
        success: true,
        reservationId: idEvento || null,
        requestPayload,
        responsePayload: payload,
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"] || null,
      });

      return sendIntegrationSuccess(response, payload);
    } catch (error) {
      const integrationError = normalizeIntegrationError(error);

      await recordIntegrationAudit({
        operation: "consultarevento",
        success: false,
        reservationId: typeof requestPayload.id_evento === "string" ? requestPayload.id_evento : null,
        requestPayload,
        errorCode: integrationError.code,
        errorMessage: integrationError.message,
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"] || null,
      });

      return sendIntegrationError(response, integrationError);
    }
  }),
);

app.post(
  "/deletarevento",
  requireIntegrationApiKey,
  asyncHandler(async (request, response) => {
    const requestPayload = getIntegrationRequestBody(request.body);

    try {
      const idEvento = getOptionalStringField(requestPayload, "id_evento");
      const nomeEvento = getOptionalStringField(requestPayload, "nome_evento");
      const whatsapp = getRequiredStringField(requestPayload, "whatsapp", "whatsapp e obrigatorio.");

      if (!idEvento && !nomeEvento) {
        throw new IntegrationError(400, "CAMPO_OBRIGATORIO_AUSENTE", "Informe id_evento ou nome_evento.");
      }

      const payload = await deleteIntegrationEvent({
        reservationId: idEvento,
        nomeEvento,
        whatsapp,
      });

      await recordIntegrationAudit({
        operation: "deletarevento",
        success: true,
        roomId: payload.id_calendario,
        reservationId: payload.id_evento,
        requestPayload,
        responsePayload: payload,
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"] || null,
      });

      return sendIntegrationSuccess(response, payload);
    } catch (error) {
      const integrationError = normalizeIntegrationError(error);

      await recordIntegrationAudit({
        operation: "deletarevento",
        success: false,
        reservationId: typeof requestPayload.id_evento === "string" ? requestPayload.id_evento : null,
        requestPayload,
        errorCode: integrationError.code,
        errorMessage: integrationError.message,
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"] || null,
      });

      return sendIntegrationError(response, integrationError);
    }
  }),
);

app.post(
  "/api/auth/login",
  loginLimiter,
  asyncHandler(async (request, response) => {
    const { email, password } = loginSchema.parse(request.body);
    const user = await getUserForLogin(email);

    if (!user) {
      throw new HttpError(401, "Credenciais invalidas.");
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new HttpError(401, "Credenciais invalidas.");
    }

    if (user.status !== "active") {
      throw new HttpError(403, "Seu acesso esta inativo ou bloqueado.");
    }

    await recordSuccessfulLogin(user.id);
    const token = createSessionToken();
    await createSession(user.id, hashSessionToken(token), request.headers["user-agent"], request.ip);
    setSessionCookie(response, token);

    response.json({
      user: await getPublicUserById(user.id),
    });
  }),
);

app.post(
  "/api/auth/logout",
  requireAuth,
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    await revokeSession(request.sessionId);
    clearSessionCookie(response);
    response.status(204).send();
  }),
);

app.get(
  "/api/auth/me",
  requireAuth,
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    response.json({ user: request.user });
  }),
);

app.post(
  "/api/auth/change-password",
  requireAuth,
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const payload = changePasswordSchema.parse(request.body);
    const user = await changeUserPassword(request.user!.id, request.sessionId, {
      currentPassword: payload.currentPassword,
      newPassword: payload.newPassword,
    });

    response.json({ user });
  }),
);

app.get(
  "/api/client/dashboard",
  requireAnyRole(["client", "master"]),
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    response.json(await getClientDashboard(request.user!.id));
  }),
);

app.get(
  "/api/client/rooms",
  requireAnyRole(["client", "master"]),
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    response.json(await listClientRooms(request.user!.id));
  }),
);

app.post(
  "/api/client/rooms",
  requireAnyRole(["client", "master"]),
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const room = await createRoom(request.user!.id, roomSchema.parse(request.body));
    response.status(201).json(room);
  }),
);

app.put(
  "/api/client/rooms/:roomId",
  requireAnyRole(["client", "master"]),
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const roomId = z.coerce.number().int().positive().parse(request.params.roomId);
    const room = await updateRoom(request.user!.id, roomId, roomSchema.parse(request.body));
    response.json(room);
  }),
);

app.delete(
  "/api/client/rooms/:roomId",
  requireAnyRole(["client", "master"]),
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const roomId = z.coerce.number().int().positive().parse(request.params.roomId);
    await deleteRoom(request.user!.id, roomId);
    response.status(204).send();
  }),
);

app.get(
  "/api/client/reservations",
  requireAnyRole(["client", "master"]),
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    response.json(await listClientReservations(request.user!.id));
  }),
);

app.post(
  "/api/client/reservations",
  requireAnyRole(["client", "master"]),
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const reservation = await createReservation(request.user!.id, reservationSchema.parse(request.body));
    response.status(201).json(reservation);
  }),
);

app.put(
  "/api/client/reservations/:reservationId",
  requireAnyRole(["client", "master"]),
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const reservation = await updateReservation(
      request.user!.id,
      String(request.params.reservationId),
      reservationSchema.parse(request.body),
    );
    response.json(reservation);
  }),
);

app.patch(
  "/api/client/reservations/:reservationId/cancel",
  requireAnyRole(["client", "master"]),
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    await cancelReservation(request.user!.id, String(request.params.reservationId));
    response.status(204).send();
  }),
);

app.get(
  "/api/client/settings",
  requireAnyRole(["client", "master"]),
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    response.json(await getClientSettings(request.user!.id));
  }),
);

app.put(
  "/api/client/settings",
  requireAnyRole(["client", "master"]),
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    response.json(await updateClientSettings(request.user!.id, settingsSchema.parse(request.body)));
  }),
);

app.get(
  "/api/client/whatsapp",
  requireAnyRole(["client", "master"]),
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    response.json(await getSyncedWhatsappData(request.user!.id));
  }),
);

app.post(
  "/api/client/whatsapp/connect",
  requireAnyRole(["client", "master"]),
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const qrCode = await generateEvolutionQrCode();
    const data = await setWhatsappConnectionStatus(request.user!.id, false);

    response.json({
      ...data,
      connectionState: "connecting",
      instanceName: env.EVOLUTION_INSTANCE || null,
      qrCodeBase64: qrCode.qrCodeBase64,
    });
  }),
);

app.post(
  "/api/client/whatsapp/disconnect",
  requireAnyRole(["client", "master"]),
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    await disconnectEvolutionInstance();
    const data = await setWhatsappConnectionStatus(request.user!.id, false);

    response.json({
      ...data,
      connectionState: "close",
      instanceName: env.EVOLUTION_INSTANCE || null,
      qrCodeBase64: null,
    });
  }),
);

app.get(
  "/api/client/tickets",
  requireAnyRole(["client", "master"]),
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    response.json(await listClientTickets(request.user!.id));
  }),
);

app.post(
  "/api/client/tickets",
  requireAnyRole(["client", "master"]),
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const ticket = await createClientTicket(request.user!.id, request.user!, ticketSchema.parse(request.body));
    void notifyTicketCreated(ticket.id).catch((error) => {
      console.error("Falha ao enviar notificacao de novo chamado:", error);
    });
    response.status(201).json(ticket);
  }),
);

app.post(
  "/api/client/tickets/:ticketId/notes",
  requireAnyRole(["client", "master"]),
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const payload = ticketNoteSchema.parse(request.body);
    const ticket = await addClientTicketNote(
      request.user!.id,
      String(request.params.ticketId),
      request.user!.name,
      payload.text,
      payload.attachments,
    );

    void notifyTicketClientReply(ticket.id, payload.text).catch((error) => {
      console.error("Falha ao enviar notificacao de resposta do cliente:", error);
    });

    response.status(201).json(ticket);
  }),
);

app.get(
  "/api/master/dashboard",
  requireRole("master"),
  asyncHandler(async (_request, response) => {
    response.json(await getMasterDashboard());
  }),
);

app.get(
  "/api/master/clients",
  requireRole("master"),
  asyncHandler(async (request, response) => {
    const search = typeof request.query.search === "string" ? request.query.search : "";
    response.json(await listClients(search));
  }),
);

app.post(
  "/api/master/clients",
  requireRole("master"),
  asyncHandler(async (request, response) => {
    const payload = createClientSchema.parse(request.body);
    const created = await createClient(payload);
    response.status(201).json(created);
  }),
);

app.get(
  "/api/master/clients/:clientId",
  requireRole("master"),
  asyncHandler(async (request, response) => {
    response.json(await getClientProfile(String(request.params.clientId)));
  }),
);

app.put(
  "/api/master/clients/:clientId",
  requireRole("master"),
  asyncHandler(async (request, response) => {
    response.json(await updateClient(String(request.params.clientId), updateClientSchema.parse(request.body)));
  }),
);

app.patch(
  "/api/master/clients/:clientId/status",
  requireRole("master"),
  asyncHandler(async (request, response) => {
    response.json(await updateClientStatus(String(request.params.clientId), clientStatusSchema.parse(request.body).status));
  }),
);

app.post(
  "/api/master/clients/:clientId/reset-password",
  requireRole("master"),
  asyncHandler(async (request, response) => {
    response.json({
      temporaryPassword: await resetClientPassword(String(request.params.clientId)),
    });
  }),
);

app.get(
  "/api/master/tickets",
  requireRole("master"),
  asyncHandler(async (request, response) => {
    const search = typeof request.query.search === "string" ? request.query.search : "";
    const status = typeof request.query.status === "string" ? request.query.status : "all";
    response.json(await listMasterTickets(search, status));
  }),
);

app.get(
  "/api/master/support-users",
  requireRole("master"),
  asyncHandler(async (_request, response) => {
    response.json(await listSupportUsers());
  }),
);

app.patch(
  "/api/master/tickets/:ticketId/status",
  requireRole("master"),
  asyncHandler(async (request, response) => {
    const nextStatus = ticketStatusSchema.parse(request.body).status;
    await updateTicketStatus(String(request.params.ticketId), nextStatus);
    void notifyTicketStatusChanged(String(request.params.ticketId), nextStatus).catch((error) => {
      console.error("Falha ao enviar notificacao de status do chamado:", error);
    });
    response.status(204).send();
  }),
);

app.patch(
  "/api/master/tickets/:ticketId/assign",
  requireRole("master"),
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const payload = ticketAssignSchema.parse(request.body);
    const normalizedAssignedToUserId = payload.assignedToUserId?.trim() ? payload.assignedToUserId.trim() : null;
    const ticket = await assignTicket(
      String(request.params.ticketId),
      normalizedAssignedToUserId,
      request.user!.id,
      request.user!.name,
    );

    if (normalizedAssignedToUserId) {
      void notifyTicketAssigned(ticket.id).catch((error) => {
        console.error("Falha ao enviar notificacao de atribuicao do chamado:", error);
      });
    }

    response.json(ticket);
  }),
);

app.post(
  "/api/master/tickets/:ticketId/notes",
  requireRole("master"),
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const payload = ticketNoteSchema.parse(request.body);
    const ticketId = String(request.params.ticketId);
    await addTicketNote(
      ticketId,
      request.user!.id,
      request.user!.name,
      payload.text,
      payload.internal,
      payload.attachments,
    );

    if (!payload.internal) {
      void notifyTicketMasterReply(ticketId, payload.text).catch((error) => {
        console.error("Falha ao enviar notificacao de resposta da equipe:", error);
      });
    }

    const ticket = (await listMasterTickets("", "all")).find((item) => item.id === ticketId);
    if (!ticket) {
      throw new HttpError(500, "Nao foi possivel recuperar o chamado atualizado.");
    }

    response.status(201).json(ticket);
  }),
);

app.get(
  "/api/ticket-attachments/:attachmentId",
  requireAuth,
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const attachment = await getTicketAttachmentForUser(
      String(request.params.attachmentId),
      request.user!.id,
      request.user!.role,
    );

    response.setHeader("Content-Type", attachment.mimeType);
    response.setHeader("Content-Length", String(attachment.fileSize));
    response.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(attachment.fileName)}"`);
    response.send(attachment.fileData);
  }),
);

if (shouldServeFrontend) {
  app.use(express.static(distDir));

  app.use((request, response, next) => {
    if (request.path.startsWith("/api/")) {
      return next();
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return next();
    }

    if (path.extname(request.path)) {
      return next();
    }

    if (!request.accepts("html")) {
      return next();
    }

    return response.sendFile(path.join(distDir, "index.html"));
  });
}

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  if (error instanceof ZodError) {
    return response.status(400).json({
      message: error.issues[0]?.message || "Dados invalidos.",
    });
  }

  if (error instanceof HttpError) {
    return response.status(error.status).json({ message: error.message });
  }

  if (typeof error === "object" && error && "code" in error) {
    const mysqlError = error as { code?: string; sqlMessage?: string };

    if (mysqlError.code === "ER_SIGNAL_EXCEPTION") {
      return response.status(400).json({
        message: mysqlError.sqlMessage || "Operacao recusada pelo banco de dados.",
      });
    }

    if (mysqlError.code === "ER_DUP_ENTRY") {
      return response.status(409).json({ message: "Registro duplicado. Verifique os campos unicos." });
    }

    if (mysqlError.code === "ER_ROW_IS_REFERENCED_2" || mysqlError.code === "ER_ROW_IS_REFERENCED") {
      return response.status(409).json({ message: "Nao foi possivel excluir porque existem registros vinculados." });
    }
  }

  console.error(error);
  return response.status(500).json({ message: "Erro interno do servidor." });
});

async function bootstrap() {
  await pool.execute("SELECT 1");
  await ensureAppSchema();
  await seedDatabaseIfNeeded();

  app.listen(listenPort, listenHost, () => {
    if (shouldServeFrontend) {
      console.log(`Aplicacao executando em ${listenHost}:${listenPort}`);
      return;
    }

    console.log(`API executando em ${listenHost}:${listenPort}`);
  });
}

bootstrap().catch((error) => {
  console.error("Falha ao iniciar a API:", error);
  process.exit(1);
});
