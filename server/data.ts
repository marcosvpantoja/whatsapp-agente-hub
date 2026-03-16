import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool, type DbExecutor, withTransaction } from "./db.js";
import { env } from "./env.js";
import { encryptSecret } from "./secrets.js";
import { HttpError, generateTemporaryPassword, normalizeEmail } from "./utils.js";

type PublicUserRow = RowDataPacket & {
  id: string;
  name: string;
  email: string;
  company: string;
  role: "master" | "client";
  themePreference: "dark" | "light";
  agentName: string | null;
  status: "active" | "inactive" | "blocked";
  lastLogin: string;
  createdAt: string;
  mustChangePassword: number;
  whatsappConnected: number;
  whatsappNumber: string | null;
  lastSync: string | null;
};

type LoginUserRow = PublicUserRow & {
  passwordHash: string;
};

type RoomRow = RowDataPacket & {
  id: number;
  name: string;
  floor: number;
  capacity: number;
  status: "active" | "inactive";
  color: string;
  description: string;
  clientId: string;
};

type ReservationRow = RowDataPacket & {
  id: string;
  roomId: number;
  roomName: string;
  personName: string;
  date: string;
  startTime: string;
  endTime: string;
  meetingLink: string | null;
  participants: number;
  status: "confirmed" | "cancelled" | "completed";
  source: "whatsapp" | "panel" | "manual" | "api";
  roomColor: string;
  cancelledAt: string | null;
  cancelReason: string | null;
  clientId: string;
  floor: number | null;
};

type TicketRow = RowDataPacket & {
  id: string;
  clientId: string;
  clientName: string;
  company: string;
  email: string;
  title: string;
  description: string;
  status: "open" | "in_progress" | "resolved";
  createdAt: string;
  updatedAt: string;
  assignedToId: string | null;
  assignedTo: string | null;
  priority: "low" | "medium" | "high";
};

type TicketNoteRow = RowDataPacket & {
  id: string;
  ticketId: string;
  authorUserId: string | null;
  text: string;
  author: string;
  createdAt: string;
  internal: number;
};

type TicketAttachmentRow = RowDataPacket & {
  id: string;
  noteId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
};

type SettingsRow = RowDataPacket & {
  systemName: string;
  timezone: string;
  themePreference: "dark" | "light";
  bookingStartTime: string;
  bookingEndTime: string;
  maxParticipants: number;
  minAdvanceMinutes: number;
  emailEnabled: number;
  smtpHost: string | null;
  smtpPort: number;
  smtpSecurity: "none" | "starttls" | "ssl_tls";
  smtpUsername: string | null;
  smtpPasswordConfigured: number;
  smtpFromName: string | null;
  smtpFromEmail: string | null;
  smtpReplyToEmail: string | null;
};

type WhatsappRow = RowDataPacket & {
  id: string;
  status: "connected" | "disconnected" | "pending" | "error";
  phoneNumber: string | null;
  displayName: string | null;
  lastSync: string | null;
  reservationsToday: number;
};

type CountRow = RowDataPacket & {
  total: number;
};

type Ticket = TicketRow & {
  notes: Array<{
    id: string;
    authorUserId: string | null;
    text: string;
    author: string;
    createdAt: string;
    internal?: boolean;
    attachments: Array<{
      id: string;
      fileName: string;
      mimeType: string;
      fileSize: number;
      downloadUrl: string;
    }>;
  }>;
};

export interface RoomInput {
  name: string;
  floor: number;
  capacity: number;
  description: string;
  color: string;
  active: boolean;
}

export interface SettingsInput {
  systemName: string;
  timezone: string;
  themePreference: "dark" | "light";
  bookingStartTime: string;
  bookingEndTime: string;
  maxParticipants: number;
  minAdvanceMinutes: number;
  emailEnabled: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecurity: "none" | "starttls" | "ssl_tls";
  smtpUsername: string;
  smtpPassword: string;
  smtpFromName: string;
  smtpFromEmail: string;
  smtpReplyToEmail: string;
}

export interface ReservationInput {
  roomId: number;
  personName: string;
  date: string;
  startTime: string;
  endTime: string;
  meetingLink?: string;
  participants: number;
}

export interface TicketInput {
  title: string;
  description: string;
  attachments?: TicketAttachmentInput[];
}

export interface TicketAttachmentInput {
  fileName: string;
  mimeType: string;
  contentBase64: string;
}

export interface SupportUser {
  id: string;
  name: string;
  email: string;
}

export interface CreateClientInput {
  name: string;
  email: string;
  company: string;
  agentName?: string;
}

export interface UpdateClientInput {
  name: string;
  email: string;
  company: string;
  agentName?: string;
  whatsappNumber?: string | null;
}

export interface DashboardPayload {
  metrics: Array<{ label: string; value: number }>;
  confirmedReservations: ReservationRow[];
  cancelledReservations: ReservationRow[];
}

export interface MasterDashboardPayload {
  metrics: Array<{ label: string; value: number }>;
  recentClients: Awaited<ReturnType<typeof listClients>>;
  recentTickets: Ticket[];
  topClients: Array<{ id: string; company: string; reservations: number }>;
}

async function executeRows<T extends RowDataPacket[]>(
  executor: DbExecutor,
  sql: string,
  values: any[] = [],
) {
  const [rows] = await executor.execute<T>(sql, values);
  return rows;
}

async function executeOne<T extends RowDataPacket>(
  executor: DbExecutor,
  sql: string,
  values: any[] = [],
) {
  const rows = await executeRows<T[]>(executor, sql, values);
  return rows[0] ?? null;
}

const MAX_TICKET_ATTACHMENTS = 5;
const MAX_TICKET_ATTACHMENT_SIZE_BYTES = 3 * 1024 * 1024;

function sanitizeTicketAttachments(attachments: TicketAttachmentInput[] = []) {
  if (attachments.length > MAX_TICKET_ATTACHMENTS) {
    throw new HttpError(400, `Voce pode enviar no maximo ${MAX_TICKET_ATTACHMENTS} anexos por mensagem.`);
  }

  return attachments.map((attachment) => {
    const fileName = attachment.fileName.trim();
    const mimeType = attachment.mimeType.trim() || "application/octet-stream";
    const buffer = Buffer.from(attachment.contentBase64, "base64");

    if (!fileName) {
      throw new HttpError(400, "Todo anexo precisa ter nome de arquivo.");
    }

    if (buffer.length === 0) {
      throw new HttpError(400, `O anexo ${fileName} esta vazio.`);
    }

    if (buffer.length > MAX_TICKET_ATTACHMENT_SIZE_BYTES) {
      throw new HttpError(400, `O anexo ${fileName} excede o limite de 3 MB.`);
    }

    return {
      id: uuidv4(),
      fileName: fileName.slice(0, 255),
      mimeType: mimeType.slice(0, 150),
      fileSize: buffer.length,
      content: buffer,
    };
  });
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function getCurrentZonedDateTime(timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  });

  const map = formatter.formatToParts(new Date()).reduce<Record<string, string>>((accumulator, part) => {
    if (part.type !== "literal") {
      accumulator[part.type] = part.value;
    }
    return accumulator;
  }, {});

  return {
    date: `${map.year}-${map.month}-${map.day}`,
    time: `${map.hour}:${map.minute}`,
  };
}

function mapUser(row: PublicUserRow | null) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    company: row.company,
    role: row.role,
    themePreference: row.themePreference,
    agentName: row.agentName,
    status: row.status,
    lastLogin: row.lastLogin,
    createdAt: row.createdAt,
    mustChangePassword: Boolean(row.mustChangePassword),
    whatsappConnected: Boolean(row.whatsappConnected),
    whatsappNumber: row.whatsappNumber,
    lastSync: row.lastSync,
  };
}

async function getUserPublicById(executor: DbExecutor, userId: string) {
  return executeOne<PublicUserRow>(
    executor,
    `
      SELECT
        u.id,
        u.name,
        u.email,
        u.company,
        u.role,
        COALESCE(us.theme_preference, 'dark') AS themePreference,
        u.agent_name AS agentName,
        u.status,
        COALESCE(DATE_FORMAT(u.last_login_at, '%Y-%m-%d'), '') AS lastLogin,
        DATE_FORMAT(u.created_at, '%Y-%m-%d') AS createdAt,
        u.must_change_password AS mustChangePassword,
        CASE WHEN wc.status = 'connected' THEN 1 ELSE 0 END AS whatsappConnected,
        wc.phone_number AS whatsappNumber,
        CASE
          WHEN wc.last_sync_at IS NULL THEN NULL
          ELSE DATE_FORMAT(wc.last_sync_at, '%Y-%m-%d %H:%i')
        END AS lastSync
      FROM users u
      LEFT JOIN user_settings us ON us.user_id = u.id
      LEFT JOIN whatsapp_connections wc ON wc.user_id = u.id
      WHERE u.id = ?
      LIMIT 1
    `,
    [userId],
  );
}

export async function getPublicUserById(userId: string) {
  return mapUser(await getUserPublicById(pool, userId));
}

async function attachNotes(tickets: TicketRow[], includeInternal: boolean) {
  if (tickets.length === 0) {
    return [];
  }

  const placeholders = tickets.map(() => "?").join(", ");
  const filters = includeInternal ? "" : "AND tn.is_internal = 0";
  const noteRows = await executeRows<TicketNoteRow[]>(
    pool,
    `
      SELECT
        tn.id,
        tn.ticket_id AS ticketId,
        tn.author_user_id AS authorUserId,
        tn.note_text AS text,
        tn.author_name AS author,
        DATE_FORMAT(tn.created_at, '%Y-%m-%d') AS createdAt,
        tn.is_internal AS internal
      FROM ticket_notes tn
      WHERE tn.ticket_id IN (${placeholders})
        ${filters}
      ORDER BY tn.created_at ASC
    `,
    tickets.map((ticket) => ticket.id),
  );

  const noteIds = noteRows.map((note) => note.id);
  const attachmentsByNote: Record<string, Ticket["notes"][number]["attachments"]> = {};

  if (noteIds.length > 0) {
    const attachmentPlaceholders = noteIds.map(() => "?").join(", ");
    const attachmentRows = await executeRows<TicketAttachmentRow[]>(
      pool,
      `
        SELECT
          ta.id,
          ta.ticket_note_id AS noteId,
          ta.file_name AS fileName,
          ta.mime_type AS mimeType,
          ta.file_size AS fileSize
        FROM ticket_attachments ta
        WHERE ta.ticket_note_id IN (${attachmentPlaceholders})
        ORDER BY ta.created_at ASC
      `,
      noteIds,
    );

    for (const row of attachmentRows) {
      attachmentsByNote[row.noteId] = attachmentsByNote[row.noteId] || [];
      attachmentsByNote[row.noteId].push({
        id: row.id,
        fileName: row.fileName,
        mimeType: row.mimeType,
        fileSize: row.fileSize,
        downloadUrl: `/api/ticket-attachments/${row.id}`,
      });
    }
  }

  const notesByTicket = noteRows.reduce<Record<string, Ticket["notes"]>>((accumulator, row) => {
    const note = {
      id: row.id,
      authorUserId: row.authorUserId,
      text: row.text,
      author: row.author,
      createdAt: row.createdAt,
      attachments: attachmentsByNote[row.id] || [],
      ...(row.internal ? { internal: true } : {}),
    };

    accumulator[row.ticketId] = accumulator[row.ticketId] || [];
    accumulator[row.ticketId].push(note);
    return accumulator;
  }, {});

  return tickets.map((ticket) => ({
    ...ticket,
    notes: notesByTicket[ticket.id] || [],
  }));
}

export async function getUserForLogin(email: string) {
  const row = await executeOne<LoginUserRow>(
    pool,
    `
      SELECT
        u.id,
        u.name,
        u.email,
        u.company,
        u.role,
        COALESCE(us.theme_preference, 'dark') AS themePreference,
        u.agent_name AS agentName,
        u.status,
        COALESCE(DATE_FORMAT(u.last_login_at, '%Y-%m-%d'), '') AS lastLogin,
        DATE_FORMAT(u.created_at, '%Y-%m-%d') AS createdAt,
        u.must_change_password AS mustChangePassword,
        CASE WHEN wc.status = 'connected' THEN 1 ELSE 0 END AS whatsappConnected,
        wc.phone_number AS whatsappNumber,
        CASE
          WHEN wc.last_sync_at IS NULL THEN NULL
          ELSE DATE_FORMAT(wc.last_sync_at, '%Y-%m-%d %H:%i')
        END AS lastSync,
        u.password_hash AS passwordHash
      FROM users u
      LEFT JOIN user_settings us ON us.user_id = u.id
      LEFT JOIN whatsapp_connections wc ON wc.user_id = u.id
      WHERE u.email = ?
      LIMIT 1
    `,
    [normalizeEmail(email)],
  );

  return row;
}

export async function recordSuccessfulLogin(userId: string) {
  await pool.execute("UPDATE users SET last_login_at = NOW() WHERE id = ?", [userId]);
}

export async function createSession(userId: string, tokenHash: string, userAgent?: string | null, ipAddress?: string | null) {
  const id = uuidv4();

  await pool.execute(
    `
      INSERT INTO auth_sessions (
        id,
        user_id,
        refresh_token_hash,
        user_agent,
        ip_address,
        expires_at,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? DAY), NOW())
    `,
    [id, userId, tokenHash, userAgent || null, ipAddress || null, env.SESSION_TTL_DAYS],
  );

  return id;
}

export async function revokeSession(sessionId: string | null | undefined) {
  if (!sessionId) {
    return;
  }

  await pool.execute(
    "UPDATE auth_sessions SET revoked_at = NOW() WHERE id = ? AND revoked_at IS NULL",
    [sessionId],
  );
}

export async function listClientRooms(clientUserId: string) {
  return executeRows<RoomRow[]>(
    pool,
    `
      SELECT
        r.id,
        r.name,
        r.floor,
        r.capacity,
        r.status,
        r.color,
        COALESCE(r.description, '') AS description,
        r.client_user_id AS clientId
      FROM rooms r
      WHERE r.client_user_id = ?
      ORDER BY r.floor ASC, r.name ASC
    `,
    [clientUserId],
  );
}

export async function createRoom(clientUserId: string, input: RoomInput) {
  const [result] = await pool.execute<ResultSetHeader>(
    `
      INSERT INTO rooms (
        client_user_id,
        name,
        floor,
        capacity,
        status,
        color,
        description
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      clientUserId,
      input.name.trim(),
      input.floor,
      input.capacity,
      input.active ? "active" : "inactive",
      input.color,
      input.description.trim() || null,
    ],
  );

  const id = result.insertId;

  const room = await executeOne<RoomRow>(
    pool,
    `
      SELECT
        r.id,
        r.name,
        r.floor,
        r.capacity,
        r.status,
        r.color,
        COALESCE(r.description, '') AS description,
        r.client_user_id AS clientId
      FROM rooms r
      WHERE r.id = ? AND r.client_user_id = ?
      LIMIT 1
    `,
    [id, clientUserId],
  );

  if (!room) {
    throw new HttpError(500, "Nao foi possivel recuperar a sala criada.");
  }

  return room;
}

export async function updateRoom(clientUserId: string, roomId: number, input: RoomInput) {
  const [result] = await pool.execute<ResultSetHeader>(
    `
      UPDATE rooms
      SET
        name = ?,
        floor = ?,
        capacity = ?,
        status = ?,
        color = ?,
        description = ?
      WHERE id = ? AND client_user_id = ?
    `,
    [
      input.name.trim(),
      input.floor,
      input.capacity,
      input.active ? "active" : "inactive",
      input.color,
      input.description.trim() || null,
      roomId,
      clientUserId,
    ],
  );

  if (result.affectedRows === 0) {
    throw new HttpError(404, "Sala não encontrada.");
  }

  const room = await executeOne<RoomRow>(
    pool,
    `
      SELECT
        r.id,
        r.name,
        r.floor,
        r.capacity,
        r.status,
        r.color,
        COALESCE(r.description, '') AS description,
        r.client_user_id AS clientId
      FROM rooms r
      WHERE r.id = ? AND r.client_user_id = ?
      LIMIT 1
    `,
    [roomId, clientUserId],
  );

  if (!room) {
    throw new HttpError(500, "Nao foi possivel recuperar a sala atualizada.");
  }

  return room;
}

export async function deleteRoom(clientUserId: string, roomId: number) {
  const [result] = await pool.execute<ResultSetHeader>(
    "DELETE FROM rooms WHERE id = ? AND client_user_id = ?",
    [roomId, clientUserId],
  );

  if (result.affectedRows === 0) {
    throw new HttpError(404, "Sala não encontrada.");
  }
}

function validateReservationSchedule(input: ReservationInput, settings: Awaited<ReturnType<typeof getClientSettings>>) {
  const currentDateTime = getCurrentZonedDateTime(settings.timezone);
  const startMinutes = timeToMinutes(input.startTime);
  const endMinutes = timeToMinutes(input.endTime);
  const bookingStartMinutes = timeToMinutes(settings.bookingStartTime);
  const bookingEndMinutes = timeToMinutes(settings.bookingEndTime);

  if (input.date < currentDateTime.date) {
    throw new HttpError(400, "Nao e permitido salvar reservas em datas passadas.");
  }

  if (startMinutes >= endMinutes) {
    throw new HttpError(400, "O horario final deve ser maior que o horario inicial.");
  }

  if (startMinutes < bookingStartMinutes || endMinutes > bookingEndMinutes) {
    throw new HttpError(
      400,
      `A reserva deve estar dentro do horario permitido: ${settings.bookingStartTime} as ${settings.bookingEndTime}.`,
    );
  }

  if (input.date === currentDateTime.date) {
    const minimumStartMinutes = timeToMinutes(currentDateTime.time) + settings.minAdvanceMinutes;
    if (startMinutes < minimumStartMinutes) {
      throw new HttpError(
        400,
        `A reserva precisa respeitar a antecedencia minima de ${settings.minAdvanceMinutes} minutos.`,
      );
    }
  }
}

async function getReservationByIdForClient(executor: DbExecutor, clientUserId: string, reservationId: string) {
  return executeOne<RowDataPacket & { id: string; status: "confirmed" | "cancelled" | "completed" }>(
    executor,
    `
      SELECT
        id,
        status
      FROM reservations
      WHERE id = ?
        AND client_user_id = ?
      LIMIT 1
    `,
    [reservationId, clientUserId],
  );
}

async function getReservationDetailsForClient(executor: DbExecutor, clientUserId: string, reservationId: string) {
  return executeOne<ReservationRow>(
    executor,
    `
      SELECT
        r.id,
        r.room_id AS roomId,
        r.room_name_snapshot AS roomName,
        r.person_name AS personName,
        DATE_FORMAT(r.reservation_date, '%Y-%m-%d') AS date,
        TIME_FORMAT(r.start_time, '%H:%i') AS startTime,
        TIME_FORMAT(r.end_time, '%H:%i') AS endTime,
        r.meeting_link AS meetingLink,
        r.participants,
        r.status,
        r.source,
        r.room_color_snapshot AS roomColor,
        CASE
          WHEN r.cancelled_at IS NULL THEN NULL
          ELSE DATE_FORMAT(r.cancelled_at, '%Y-%m-%d')
        END AS cancelledAt,
        r.cancel_reason AS cancelReason,
        r.client_user_id AS clientId,
        r.floor_snapshot AS floor
      FROM reservations r
      WHERE r.id = ?
        AND r.client_user_id = ?
      LIMIT 1
    `,
    [reservationId, clientUserId],
  );
}

export async function listClientReservations(clientUserId: string) {
  return executeRows<ReservationRow[]>(
    pool,
    `
      SELECT
        r.id,
        r.room_id AS roomId,
        r.room_name_snapshot AS roomName,
        r.person_name AS personName,
        DATE_FORMAT(r.reservation_date, '%Y-%m-%d') AS date,
        TIME_FORMAT(r.start_time, '%H:%i') AS startTime,
        TIME_FORMAT(r.end_time, '%H:%i') AS endTime,
        r.meeting_link AS meetingLink,
        r.participants,
        r.status,
        r.source,
        r.room_color_snapshot AS roomColor,
        CASE
          WHEN r.cancelled_at IS NULL THEN NULL
          ELSE DATE_FORMAT(r.cancelled_at, '%Y-%m-%d')
        END AS cancelledAt,
        r.cancel_reason AS cancelReason,
        r.client_user_id AS clientId,
        r.floor_snapshot AS floor
      FROM reservations r
      WHERE r.client_user_id = ?
      ORDER BY r.reservation_date DESC, r.start_time ASC
    `,
    [clientUserId],
  );
}

export async function createReservation(clientUserId: string, input: ReservationInput) {
  const settings = await getClientSettings(clientUserId);
  validateReservationSchedule(input, settings);

  return withTransaction(async (connection) => {
    const room = await executeOne<RoomRow>(
      connection,
      `
        SELECT
          r.id,
          r.name,
          r.floor,
          r.capacity,
          r.status,
          r.color,
          COALESCE(r.description, '') AS description,
          r.client_user_id AS clientId
        FROM rooms r
        WHERE r.id = ?
          AND r.client_user_id = ?
        LIMIT 1
      `,
      [input.roomId, clientUserId],
    );

    if (!room) {
      throw new HttpError(404, "Sala nao encontrada.");
    }

    if (room.status !== "active") {
      throw new HttpError(400, "Nao e permitido reservar uma sala inativa.");
    }

    if (input.participants > room.capacity) {
      throw new HttpError(400, `A sala selecionada suporta no maximo ${room.capacity} participantes.`);
    }

    if (input.participants > settings.maxParticipants) {
      throw new HttpError(
        400,
        `O limite configurado para reservas e de ${settings.maxParticipants} participantes.`,
      );
    }

    const conflictingReservation = await executeOne<CountRow>(
      connection,
      `
        SELECT COUNT(*) AS total
        FROM reservations
        WHERE room_id = ?
          AND client_user_id = ?
          AND reservation_date = ?
          AND status = 'confirmed'
          AND ? < end_time
          AND ? > start_time
      `,
      [input.roomId, clientUserId, input.date, `${input.startTime}:00`, `${input.endTime}:00`],
    );

    if ((conflictingReservation?.total ?? 0) > 0) {
      throw new HttpError(409, "Ja existe uma reserva confirmada em conflito para esta sala e horario.");
    }

    const id = uuidv4();
    await connection.execute(
      `
        INSERT INTO reservations (
          id,
          client_user_id,
          room_id,
          created_by_user_id,
          person_name,
          reservation_date,
          start_time,
          end_time,
          participants,
          status,
          source,
          room_name_snapshot,
          room_color_snapshot,
          floor_snapshot,
          meeting_link
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', 'panel', ?, ?, ?, ?)
      `,
      [
        id,
        clientUserId,
        room.id,
        clientUserId,
        input.personName.trim(),
        input.date,
        `${input.startTime}:00`,
        `${input.endTime}:00`,
        input.participants,
        room.name,
        room.color,
        room.floor,
        input.meetingLink?.trim() || null,
      ],
    );

    const reservation = await getReservationDetailsForClient(connection, clientUserId, id);

    if (!reservation) {
      throw new HttpError(500, "Nao foi possivel recuperar a reserva criada.");
    }

    return reservation;
  });
}

export async function updateReservation(clientUserId: string, reservationId: string, input: ReservationInput) {
  const settings = await getClientSettings(clientUserId);
  validateReservationSchedule(input, settings);

  return withTransaction(async (connection) => {
    const existingReservation = await getReservationByIdForClient(connection, clientUserId, reservationId);

    if (!existingReservation || existingReservation.status !== "confirmed") {
      throw new HttpError(404, "Reserva confirmada nao encontrada.");
    }

    const room = await executeOne<RoomRow>(
      connection,
      `
        SELECT
          r.id,
          r.name,
          r.floor,
          r.capacity,
          r.status,
          r.color,
          COALESCE(r.description, '') AS description,
          r.client_user_id AS clientId
        FROM rooms r
        WHERE r.id = ?
          AND r.client_user_id = ?
        LIMIT 1
      `,
      [input.roomId, clientUserId],
    );

    if (!room) {
      throw new HttpError(404, "Sala nao encontrada.");
    }

    if (room.status !== "active") {
      throw new HttpError(400, "Nao e permitido reservar uma sala inativa.");
    }

    if (input.participants > room.capacity) {
      throw new HttpError(400, `A sala selecionada suporta no maximo ${room.capacity} participantes.`);
    }

    if (input.participants > settings.maxParticipants) {
      throw new HttpError(
        400,
        `O limite configurado para reservas e de ${settings.maxParticipants} participantes.`,
      );
    }

    const conflictingReservation = await executeOne<CountRow>(
      connection,
      `
        SELECT COUNT(*) AS total
        FROM reservations
        WHERE room_id = ?
          AND client_user_id = ?
          AND reservation_date = ?
          AND status = 'confirmed'
          AND ? < end_time
          AND ? > start_time
          AND id <> ?
      `,
      [input.roomId, clientUserId, input.date, `${input.startTime}:00`, `${input.endTime}:00`, reservationId],
    );

    if ((conflictingReservation?.total ?? 0) > 0) {
      throw new HttpError(409, "Ja existe uma reserva confirmada em conflito para esta sala e horario.");
    }

    const [result] = await connection.execute<ResultSetHeader>(
      `
        UPDATE reservations
        SET
          room_id = ?,
          person_name = ?,
          reservation_date = ?,
          start_time = ?,
          end_time = ?,
          meeting_link = ?,
          participants = ?,
          source = 'panel',
          room_name_snapshot = ?,
          room_color_snapshot = ?,
          floor_snapshot = ?,
          updated_at = NOW()
        WHERE id = ?
          AND client_user_id = ?
          AND status = 'confirmed'
      `,
      [
        room.id,
        input.personName.trim(),
        input.date,
        `${input.startTime}:00`,
        `${input.endTime}:00`,
        input.meetingLink?.trim() || null,
        input.participants,
        room.name,
        room.color,
        room.floor,
        reservationId,
        clientUserId,
      ],
    );

    if (result.affectedRows === 0) {
      throw new HttpError(404, "Reserva confirmada nao encontrada.");
    }

    const reservation = await getReservationDetailsForClient(connection, clientUserId, reservationId);

    if (!reservation) {
      throw new HttpError(500, "Nao foi possivel recuperar a reserva atualizada.");
    }

    return reservation;
  });
}

export async function cancelReservation(clientUserId: string, reservationId: string) {
  const [result] = await pool.execute<ResultSetHeader>(
    `
      UPDATE reservations
      SET
        status = 'cancelled',
        cancelled_at = NOW(),
        cancel_reason = 'Cancelada pelo cliente via painel',
        updated_at = NOW()
      WHERE id = ?
        AND client_user_id = ?
        AND status = 'confirmed'
    `,
    [reservationId, clientUserId],
  );

  if (result.affectedRows === 0) {
    throw new HttpError(404, "Reserva confirmada não encontrada.");
  }
}

export async function getClientSettings(clientUserId: string) {
  const row = await executeOne<SettingsRow>(
    pool,
    `
      SELECT
        us.system_name AS systemName,
        us.timezone,
        COALESCE(us.theme_preference, 'dark') AS themePreference,
        TIME_FORMAT(us.booking_start_time, '%H:%i') AS bookingStartTime,
        TIME_FORMAT(us.booking_end_time, '%H:%i') AS bookingEndTime,
        us.max_participants AS maxParticipants,
        us.min_advance_minutes AS minAdvanceMinutes,
        COALESCE(es.enabled, 0) AS emailEnabled,
        es.smtp_host AS smtpHost,
        COALESCE(es.smtp_port, 587) AS smtpPort,
        COALESCE(es.smtp_security, 'starttls') AS smtpSecurity,
        es.smtp_username AS smtpUsername,
        CASE
          WHEN es.smtp_password_encrypted IS NULL OR es.smtp_password_encrypted = '' THEN 0
          ELSE 1
        END AS smtpPasswordConfigured,
        es.smtp_from_name AS smtpFromName,
        es.smtp_from_email AS smtpFromEmail,
        es.smtp_reply_to_email AS smtpReplyToEmail
      FROM user_settings us
      LEFT JOIN email_settings es ON es.user_id = us.user_id
      WHERE us.user_id = ?
      LIMIT 1
    `,
    [clientUserId],
  );

  if (!row) {
    await pool.execute("INSERT INTO user_settings (user_id) VALUES (?)", [clientUserId]);
    return getClientSettings(clientUserId);
  }

  return {
    systemName: row.systemName,
    timezone: row.timezone,
    themePreference: row.themePreference || "dark",
    bookingStartTime: row.bookingStartTime,
    bookingEndTime: row.bookingEndTime,
    maxParticipants: row.maxParticipants,
    minAdvanceMinutes: row.minAdvanceMinutes,
    emailEnabled: Boolean(row.emailEnabled),
    smtpHost: row.smtpHost || "",
    smtpPort: row.smtpPort || 587,
    smtpSecurity: row.smtpSecurity || "starttls",
    smtpUsername: row.smtpUsername || "",
    smtpPassword: "",
    smtpPasswordConfigured: Boolean(row.smtpPasswordConfigured),
    smtpFromName: row.smtpFromName || "",
    smtpFromEmail: row.smtpFromEmail || "",
    smtpReplyToEmail: row.smtpReplyToEmail || "",
  };
}

export async function updateClientSettings(clientUserId: string, input: SettingsInput) {
  const currentEmailSettings = await executeOne<RowDataPacket & { smtpPasswordEncrypted: string | null }>(
    pool,
    `
      SELECT smtp_password_encrypted AS smtpPasswordEncrypted
      FROM email_settings
      WHERE user_id = ?
      LIMIT 1
    `,
    [clientUserId],
  );

  const smtpPassword = input.smtpPassword.trim();
  const hasStoredPassword = Boolean(currentEmailSettings?.smtpPasswordEncrypted);

  if (input.emailEnabled) {
    if (!input.smtpHost.trim()) {
      throw new HttpError(400, "Servidor SMTP obrigatorio.");
    }

    if (!input.smtpFromEmail.trim()) {
      throw new HttpError(400, "E-mail remetente obrigatorio.");
    }

    if (!smtpPassword && !hasStoredPassword) {
      throw new HttpError(400, "Informe a senha SMTP para concluir a configuracao do servidor de saida.");
    }
  }

  if (smtpPassword && !env.SETTINGS_ENCRYPTION_KEY) {
    throw new HttpError(400, "Defina SETTINGS_ENCRYPTION_KEY no .env antes de salvar a senha SMTP.");
  }

  const encryptedPassword = smtpPassword
    ? encryptSecret(smtpPassword)
    : currentEmailSettings?.smtpPasswordEncrypted || null;

  await withTransaction(async (connection) => {
    await connection.execute(
      `
        INSERT INTO user_settings (
          user_id,
          system_name,
          timezone,
          theme_preference,
          booking_start_time,
          booking_end_time,
          max_participants,
          min_advance_minutes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          system_name = VALUES(system_name),
          timezone = VALUES(timezone),
          theme_preference = VALUES(theme_preference),
          booking_start_time = VALUES(booking_start_time),
          booking_end_time = VALUES(booking_end_time),
          max_participants = VALUES(max_participants),
          min_advance_minutes = VALUES(min_advance_minutes),
          updated_at = NOW()
      `,
      [
        clientUserId,
        input.systemName.trim(),
        input.timezone,
        input.themePreference,
        `${input.bookingStartTime}:00`,
        `${input.bookingEndTime}:00`,
        input.maxParticipants,
        input.minAdvanceMinutes,
      ],
    );

    await connection.execute(
      `
        INSERT INTO email_settings (
          user_id,
          enabled,
          smtp_host,
          smtp_port,
          smtp_security,
          smtp_username,
          smtp_password_encrypted,
          smtp_from_name,
          smtp_from_email,
          smtp_reply_to_email
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          enabled = VALUES(enabled),
          smtp_host = VALUES(smtp_host),
          smtp_port = VALUES(smtp_port),
          smtp_security = VALUES(smtp_security),
          smtp_username = VALUES(smtp_username),
          smtp_password_encrypted = VALUES(smtp_password_encrypted),
          smtp_from_name = VALUES(smtp_from_name),
          smtp_from_email = VALUES(smtp_from_email),
          smtp_reply_to_email = VALUES(smtp_reply_to_email),
          updated_at = NOW()
      `,
      [
        clientUserId,
        input.emailEnabled ? 1 : 0,
        input.smtpHost.trim() || null,
        input.smtpPort,
        input.smtpSecurity,
        input.smtpUsername.trim() || null,
        encryptedPassword,
        input.smtpFromName.trim() || null,
        input.smtpFromEmail.trim() || null,
        input.smtpReplyToEmail.trim() || null,
      ],
    );
  });

  return getClientSettings(clientUserId);
}

export async function getClientWhatsappData(clientUserId: string) {
  const row = await executeOne<WhatsappRow>(
    pool,
    `
      SELECT
        wc.id,
        wc.status,
        wc.phone_number AS phoneNumber,
        wc.display_name AS displayName,
        CASE
          WHEN wc.last_sync_at IS NULL THEN NULL
          ELSE DATE_FORMAT(wc.last_sync_at, '%Y-%m-%d %H:%i')
        END AS lastSync,
        (
          SELECT COUNT(*)
          FROM reservations r
          WHERE r.client_user_id = wc.user_id
            AND r.reservation_date = CURDATE()
            AND r.status = 'confirmed'
        ) AS reservationsToday
      FROM whatsapp_connections wc
      WHERE wc.user_id = ?
      LIMIT 1
    `,
    [clientUserId],
  );

  if (!row) {
    const id = uuidv4();
    await pool.execute(
      "INSERT INTO whatsapp_connections (id, user_id, status) VALUES (?, ?, 'disconnected')",
      [id, clientUserId],
    );
    return getClientWhatsappData(clientUserId);
  }

  return {
    ...row,
    connected: row.status === "connected",
    messagesToday: 0,
  };
}

export async function setWhatsappConnectionStatus(clientUserId: string, connected: boolean) {
  const status = connected ? "connected" : "disconnected";
  const connectedAt = connected ? new Date() : null;
  const disconnectedAt = connected ? null : new Date();
  const lastSyncAt = new Date();

  await pool.execute(
    `
      INSERT INTO whatsapp_connections (
        id,
        user_id,
        status,
        connected_at,
        disconnected_at,
        last_sync_at
      )
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        status = VALUES(status),
        connected_at = CASE
          WHEN status <> VALUES(status) AND VALUES(status) = 'connected' THEN VALUES(connected_at)
          ELSE connected_at
        END,
        disconnected_at = CASE
          WHEN status <> VALUES(status) AND VALUES(status) = 'disconnected' THEN VALUES(disconnected_at)
          ELSE disconnected_at
        END,
        last_sync_at = VALUES(last_sync_at),
        updated_at = NOW()
    `,
    [
      uuidv4(),
      clientUserId,
      status,
      connectedAt,
      disconnectedAt,
      lastSyncAt,
    ],
  );

  return getClientWhatsappData(clientUserId);
}

async function listTicketsByWhere(whereClause: string, values: unknown[], includeInternal: boolean) {
  const tickets = await executeRows<TicketRow[]>(
    pool,
    `
      SELECT
        t.id,
        t.client_user_id AS clientId,
        t.client_name_snapshot AS clientName,
        t.company_snapshot AS company,
        t.email_snapshot AS email,
        t.title,
        t.description,
        t.status,
        DATE_FORMAT(t.created_at, '%Y-%m-%d') AS createdAt,
        DATE_FORMAT(t.updated_at, '%Y-%m-%d') AS updatedAt,
        t.assigned_to_user_id AS assignedToId,
        assignee.name AS assignedTo,
        t.priority
      FROM tickets t
      LEFT JOIN users assignee ON assignee.id = t.assigned_to_user_id
      ${whereClause}
      ORDER BY t.updated_at DESC, t.created_at DESC
    `,
    values,
  );

  return attachNotes(tickets, includeInternal);
}

export async function listClientTickets(clientUserId: string) {
  return listTicketsByWhere("WHERE t.client_user_id = ?", [clientUserId], false);
}

export async function listMasterTickets(search: string, statusFilter: string) {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (search) {
    conditions.push("(t.title LIKE ? OR t.client_name_snapshot LIKE ? OR t.company_snapshot LIKE ?)");
    const term = `%${search}%`;
    values.push(term, term, term);
  }

  if (statusFilter && statusFilter !== "all") {
    conditions.push("t.status = ?");
    values.push(statusFilter);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return listTicketsByWhere(whereClause, values, true);
}

async function getTicketMeta(
  executor: DbExecutor,
  ticketId: string,
) {
  return executeOne<RowDataPacket & {
    id: string;
    clientId: string;
    title: string;
    status: "open" | "in_progress" | "resolved";
    assignedToId: string | null;
  }>(
    executor,
    `
      SELECT
        id,
        client_user_id AS clientId,
        title,
        status,
        assigned_to_user_id AS assignedToId
      FROM tickets
      WHERE id = ?
      LIMIT 1
    `,
    [ticketId],
  );
}

async function insertTicketAttachments(
  executor: DbExecutor,
  noteId: string,
  authorUserId: string,
  attachments: TicketAttachmentInput[] = [],
) {
  const normalizedAttachments = sanitizeTicketAttachments(attachments);

  for (const attachment of normalizedAttachments) {
    await executor.execute(
      `
        INSERT INTO ticket_attachments (
          id,
          ticket_note_id,
          uploaded_by_user_id,
          file_name,
          mime_type,
          file_size,
          file_data
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        attachment.id,
        noteId,
        authorUserId,
        attachment.fileName,
        attachment.mimeType,
        attachment.fileSize,
        attachment.content,
      ],
    );
  }
}

export async function createClientTicket(clientUserId: string, user: { name: string; email: string; company: string }, input: TicketInput) {
  const id = uuidv4();
  const noteId = uuidv4();

  await withTransaction(async (connection) => {
    await connection.execute(
      `
        INSERT INTO tickets (
          id,
          client_user_id,
          created_by_user_id,
          client_name_snapshot,
          company_snapshot,
          email_snapshot,
          title,
          description,
          status,
          priority
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', 'medium')
      `,
      [
        id,
        clientUserId,
        clientUserId,
        user.name,
        user.company,
        user.email,
        input.title.trim(),
        input.description.trim(),
      ],
    );

    const initialNoteText = input.attachments && input.attachments.length > 0
      ? "Chamado aberto pelo cliente com anexos."
      : "Chamado aberto pelo cliente.";

    await connection.execute(
      `
        INSERT INTO ticket_notes (
          id,
          ticket_id,
          author_user_id,
          author_name,
          note_text,
          is_internal
        )
        VALUES (?, ?, ?, ?, ?, 0)
      `,
      [noteId, id, clientUserId, user.name, initialNoteText],
    );

    await insertTicketAttachments(connection, noteId, clientUserId, input.attachments || []);
  });

  const tickets = await listClientTickets(clientUserId);
  const createdTicket = tickets.find((ticket) => ticket.id === id);

  if (!createdTicket) {
    throw new HttpError(500, "Nao foi possivel recuperar o chamado criado.");
  }

  return createdTicket;
}

export async function addClientTicketNote(
  clientUserId: string,
  ticketId: string,
  authorName: string,
  noteText: string,
  attachments: TicketAttachmentInput[] = [],
) {
  await withTransaction(async (connection) => {
    const ticket = await getTicketMeta(connection, ticketId);

    if (!ticket || ticket.clientId !== clientUserId) {
      throw new HttpError(404, "Chamado nao encontrado.");
    }

    const noteId = uuidv4();
    await connection.execute(
      `
        INSERT INTO ticket_notes (
          id,
          ticket_id,
          author_user_id,
          author_name,
          note_text,
          is_internal
        )
        VALUES (?, ?, ?, ?, ?, 0)
      `,
      [noteId, ticketId, clientUserId, authorName, noteText.trim()],
    );

    await insertTicketAttachments(connection, noteId, clientUserId, attachments);

    await connection.execute(
      `
        UPDATE tickets
        SET
          status = CASE WHEN status = 'resolved' THEN 'in_progress' ELSE status END,
          updated_at = NOW()
        WHERE id = ?
      `,
      [ticketId],
    );
  });

  const tickets = await listClientTickets(clientUserId);
  const updatedTicket = tickets.find((ticket) => ticket.id === ticketId);

  if (!updatedTicket) {
    throw new HttpError(500, "Nao foi possivel recuperar o chamado atualizado.");
  }

  return updatedTicket;
}

export async function updateTicketStatus(ticketId: string, status: "open" | "in_progress" | "resolved") {
  const [result] = await pool.execute<ResultSetHeader>(
    `
      UPDATE tickets
      SET
        status = ?,
        resolved_at = CASE WHEN ? = 'resolved' THEN NOW() ELSE NULL END,
        updated_at = NOW()
      WHERE id = ?
    `,
    [status, status, ticketId],
  );

  if (result.affectedRows === 0) {
    throw new HttpError(404, "Chamado nao encontrado.");
  }
}

export async function addTicketNote(
  ticketId: string,
  authorUserId: string,
  authorName: string,
  noteText: string,
  isInternal: boolean,
  attachments: TicketAttachmentInput[] = [],
) {
  await withTransaction(async (connection) => {
    const ticket = await getTicketMeta(connection, ticketId);

    if (!ticket) {
      throw new HttpError(404, "Chamado nao encontrado.");
    }

    const noteId = uuidv4();
    await connection.execute(
      `
        INSERT INTO ticket_notes (
          id,
          ticket_id,
          author_user_id,
          author_name,
          note_text,
          is_internal
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [noteId, ticketId, authorUserId, authorName, noteText.trim(), isInternal ? 1 : 0],
    );

    await insertTicketAttachments(connection, noteId, authorUserId, attachments);

    const [result] = await connection.execute<ResultSetHeader>(
      `
        UPDATE tickets
        SET
          status = CASE WHEN ? = 0 AND status = 'open' THEN 'in_progress' ELSE status END,
          updated_at = NOW()
        WHERE id = ?
      `,
      [isInternal ? 1 : 0, ticketId],
    );

    if (result.affectedRows === 0) {
      throw new HttpError(404, "Chamado nao encontrado.");
    }
  });
}

export async function listSupportUsers() {
  const rows = await executeRows<RowDataPacket[]>(
    pool,
    `
      SELECT id, name, email
      FROM users
      WHERE role = 'master'
        AND status = 'active'
      ORDER BY name ASC
    `,
  );

  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
  })) as SupportUser[];
}

export async function assignTicket(
  ticketId: string,
  assignedToUserId: string | null,
  actorUserId: string,
  actorName: string,
) {
  await withTransaction(async (connection) => {
    const ticket = await getTicketMeta(connection, ticketId);

    if (!ticket) {
      throw new HttpError(404, "Chamado nao encontrado.");
    }

    let assigneeName = "Sem responsavel";

    if (assignedToUserId) {
      const assignee = await executeOne<RowDataPacket & { id: string; name: string }>(
        connection,
        `
          SELECT id, name
          FROM users
          WHERE id = ?
            AND role = 'master'
            AND status = 'active'
          LIMIT 1
        `,
        [assignedToUserId],
      );

      if (!assignee) {
        throw new HttpError(404, "Responsavel nao encontrado.");
      }

      assigneeName = assignee.name;
    }

    await connection.execute(
      `
        UPDATE tickets
        SET
          assigned_to_user_id = ?,
          updated_at = NOW()
        WHERE id = ?
      `,
      [assignedToUserId, ticketId],
    );

    await connection.execute(
      `
        INSERT INTO ticket_notes (
          id,
          ticket_id,
          author_user_id,
          author_name,
          note_text,
          is_internal
        )
        VALUES (?, ?, ?, ?, ?, 1)
      `,
      [
        uuidv4(),
        ticketId,
        actorUserId,
        actorName,
        assignedToUserId
          ? `Chamado atribuido para ${assigneeName}.`
          : "A atribuicao de responsavel foi removida.",
      ],
    );
  });

  const tickets = await listMasterTickets("", "all");
  const updatedTicket = tickets.find((ticket) => ticket.id === ticketId);

  if (!updatedTicket) {
    throw new HttpError(500, "Nao foi possivel recuperar o chamado apos a atribuicao.");
  }

  return updatedTicket;
}

export async function getTicketAttachmentForUser(attachmentId: string, userId: string, role: "master" | "client") {
  const attachment = await executeOne<RowDataPacket & {
    id: string;
    ticketId: string;
    clientId: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
    fileData: Buffer;
  }>(
    pool,
    `
      SELECT
        ta.id,
        tn.ticket_id AS ticketId,
        t.client_user_id AS clientId,
        ta.file_name AS fileName,
        ta.mime_type AS mimeType,
        ta.file_size AS fileSize,
        ta.file_data AS fileData
      FROM ticket_attachments ta
      INNER JOIN ticket_notes tn ON tn.id = ta.ticket_note_id
      INNER JOIN tickets t ON t.id = tn.ticket_id
      WHERE ta.id = ?
      LIMIT 1
    `,
    [attachmentId],
  );

  if (!attachment) {
    throw new HttpError(404, "Anexo nao encontrado.");
  }

  if (role !== "master" && attachment.clientId !== userId) {
    throw new HttpError(403, "Acesso negado ao anexo.");
  }

  return attachment;
}

export async function listClients(search = "") {
  const filters: string[] = ["u.role = 'client'"];
  const values: unknown[] = [];

  if (search) {
    filters.push("(u.name LIKE ? OR u.company LIKE ? OR u.email LIKE ?)");
    const term = `%${search}%`;
    values.push(term, term, term);
  }

  const rows = await executeRows<PublicUserRow[]>(
    pool,
    `
      SELECT
        u.id,
        u.name,
        u.email,
        u.company,
        u.role,
        COALESCE(us.theme_preference, 'dark') AS themePreference,
        u.agent_name AS agentName,
        u.status,
        COALESCE(DATE_FORMAT(u.last_login_at, '%Y-%m-%d'), '') AS lastLogin,
        DATE_FORMAT(u.created_at, '%Y-%m-%d') AS createdAt,
        u.must_change_password AS mustChangePassword,
        CASE WHEN wc.status = 'connected' THEN 1 ELSE 0 END AS whatsappConnected,
        wc.phone_number AS whatsappNumber,
        CASE
          WHEN wc.last_sync_at IS NULL THEN NULL
          ELSE DATE_FORMAT(wc.last_sync_at, '%Y-%m-%d %H:%i')
        END AS lastSync
      FROM users u
      LEFT JOIN user_settings us ON us.user_id = u.id
      LEFT JOIN whatsapp_connections wc ON wc.user_id = u.id
      WHERE ${filters.join(" AND ")}
      ORDER BY u.created_at DESC
    `,
    values,
  );

  return rows.map((row) => mapUser(row));
}

export async function createClient(input: CreateClientInput) {
  const id = uuidv4();
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, 12);

  await withTransaction(async (connection) => {
    await connection.execute(
      `
        INSERT INTO users (
          id,
          name,
          email,
          company,
          role,
          agent_name,
          status,
          password_hash,
          must_change_password,
          password_changed_at
        )
        VALUES (?, ?, ?, ?, 'client', ?, 'active', ?, 1, NULL)
      `,
      [
        id,
        input.name.trim(),
        normalizeEmail(input.email),
        input.company.trim(),
        input.agentName?.trim() || null,
        passwordHash,
      ],
    );

    await connection.execute(
      "INSERT INTO user_settings (user_id) VALUES (?)",
      [id],
    );

    await connection.execute(
      "INSERT INTO whatsapp_connections (id, user_id, status) VALUES (?, ?, 'disconnected')",
      [uuidv4(), id],
    );
  });

  const client = mapUser(await getUserPublicById(pool, id));
  if (!client) {
    throw new HttpError(500, "Nao foi possivel recuperar o cliente criado.");
  }
  return { client, temporaryPassword };
}

export async function updateClientStatus(clientId: string, status: "active" | "inactive" | "blocked") {
  await withTransaction(async (connection) => {
    const [result] = await connection.execute<ResultSetHeader>(
      "UPDATE users SET status = ? WHERE id = ? AND role = 'client'",
      [status, clientId],
    );

    if (result.affectedRows === 0) {
      throw new HttpError(404, "Cliente não encontrado.");
    }

    if (status !== "active") {
      await connection.execute(
        "UPDATE auth_sessions SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL",
        [clientId],
      );
    }
  });

  return mapUser(await getUserPublicById(pool, clientId));
}

export async function resetClientPassword(clientId: string) {
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, 12);

  await withTransaction(async (connection) => {
    const [result] = await connection.execute<ResultSetHeader>(
      `
        UPDATE users
        SET
          password_hash = ?,
          must_change_password = 1,
          password_changed_at = NULL,
          updated_at = NOW()
        WHERE id = ?
          AND role = 'client'
      `,
      [passwordHash, clientId],
    );

    if (result.affectedRows === 0) {
      throw new HttpError(404, "Cliente não encontrado.");
    }

    await connection.execute(
      "UPDATE auth_sessions SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL",
      [clientId],
    );
  });

  return temporaryPassword;
}

export async function changeUserPassword(
  userId: string,
  currentSessionId: string | null | undefined,
  input: { currentPassword?: string; newPassword: string },
) {
  const user = await executeOne<RowDataPacket & { passwordHash: string; mustChangePassword: number }>(
    pool,
    `
      SELECT
        password_hash AS passwordHash,
        must_change_password AS mustChangePassword
      FROM users
      WHERE id = ?
      LIMIT 1
    `,
    [userId],
  );

  if (!user) {
    throw new HttpError(404, "Usuario nao encontrado.");
  }

  if (!user.mustChangePassword) {
    if (!input.currentPassword?.trim()) {
      throw new HttpError(400, "Informe a senha atual.");
    }

    const currentPasswordMatches = await bcrypt.compare(input.currentPassword, user.passwordHash);
    if (!currentPasswordMatches) {
      throw new HttpError(400, "Senha atual incorreta.");
    }
  }

  const isSamePassword = await bcrypt.compare(input.newPassword, user.passwordHash);
  if (isSamePassword) {
    throw new HttpError(400, "A nova senha deve ser diferente da senha atual.");
  }

  const nextPasswordHash = await bcrypt.hash(input.newPassword, 12);

  await withTransaction(async (connection) => {
    await connection.execute(
      `
        UPDATE users
        SET
          password_hash = ?,
          must_change_password = 0,
          password_changed_at = NOW(),
          updated_at = NOW()
        WHERE id = ?
      `,
      [nextPasswordHash, userId],
    );

    await connection.execute(
      `
        UPDATE auth_sessions
        SET revoked_at = NOW()
        WHERE user_id = ?
          AND revoked_at IS NULL
          AND id <> ?
      `,
      [userId, currentSessionId || ""],
    );
  });

  return getPublicUserById(userId);
}

export async function updateClient(clientId: string, input: UpdateClientInput) {
  await withTransaction(async (connection) => {
    const [result] = await connection.execute<ResultSetHeader>(
      `
        UPDATE users
        SET
          name = ?,
          email = ?,
          company = ?,
          agent_name = ?,
          updated_at = NOW()
        WHERE id = ?
          AND role = 'client'
      `,
      [
        input.name.trim(),
        normalizeEmail(input.email),
        input.company.trim(),
        input.agentName?.trim() || null,
        clientId,
      ],
    );

    if (result.affectedRows === 0) {
      throw new HttpError(404, "Cliente nao encontrado.");
    }

    const whatsappDisplayName = input.agentName?.trim() || input.name.trim();
    const normalizedPhone = input.whatsappNumber?.trim() || null;

    await connection.execute(
      `
        INSERT INTO whatsapp_connections (
          id,
          user_id,
          display_name,
          phone_number,
          status
        )
        VALUES (?, ?, ?, ?, 'disconnected')
        ON DUPLICATE KEY UPDATE
          display_name = VALUES(display_name),
          phone_number = VALUES(phone_number),
          updated_at = NOW()
      `,
      [uuidv4(), clientId, whatsappDisplayName, normalizedPhone],
    );
  });

  return getClientProfile(clientId);
}

export async function getClientProfile(clientId: string) {
  const client = mapUser(await getUserPublicById(pool, clientId));

  if (!client || client.role !== "client") {
    throw new HttpError(404, "Cliente não encontrado.");
  }

  const [rooms, reservations, tickets, settings, whatsapp] = await Promise.all([
    listClientRooms(clientId),
    listClientReservations(clientId),
    listClientTickets(clientId),
    getClientSettings(clientId),
    getClientWhatsappData(clientId),
  ]);

  return {
    client,
    rooms,
    reservations,
    tickets,
    settings,
    whatsapp,
  };
}

export async function getClientDashboard(clientId: string): Promise<DashboardPayload> {
  const [rooms, reservations] = await Promise.all([
    listClientRooms(clientId),
    listClientReservations(clientId),
  ]);

  const today = new Date().toISOString().split("T")[0];
  const confirmedReservations = reservations.filter(
    (reservation) => reservation.status === "confirmed" && reservation.date === today,
  );
  const cancelledReservations = reservations.filter((reservation) => reservation.status === "cancelled");
  const occupiedRooms = new Set(confirmedReservations.map((reservation) => reservation.roomId));
  const activeRooms = rooms.filter((room) => room.status === "active");

  return {
    metrics: [
      { label: "Total de Salas", value: rooms.length },
      { label: "Salas Ocupadas Hoje", value: occupiedRooms.size },
      { label: "Salas Livres Hoje", value: Math.max(activeRooms.length - occupiedRooms.size, 0) },
    ],
    confirmedReservations,
    cancelledReservations,
  };
}

export async function getMasterDashboard(): Promise<MasterDashboardPayload> {
  const [totalClientsRow, openTicketsRow, activeAgentsRow, disconnectedRow, recentClients, recentTickets, topRows] =
    await Promise.all([
      executeOne<CountRow>(
        pool,
        "SELECT COUNT(*) AS total FROM users WHERE role = 'client'",
      ),
      executeOne<CountRow>(
        pool,
        "SELECT COUNT(*) AS total FROM tickets WHERE status <> 'resolved'",
      ),
      executeOne<CountRow>(
        pool,
        `
          SELECT COUNT(*) AS total
          FROM users u
          LEFT JOIN whatsapp_connections wc ON wc.user_id = u.id
          WHERE u.role = 'client'
            AND u.status = 'active'
            AND wc.status = 'connected'
        `,
      ),
      executeOne<CountRow>(
        pool,
        `
          SELECT COUNT(*) AS total
          FROM users u
          LEFT JOIN whatsapp_connections wc ON wc.user_id = u.id
          WHERE u.role = 'client'
            AND u.status = 'active'
            AND COALESCE(wc.status, 'disconnected') <> 'connected'
        `,
      ),
      listClients(""),
      listTicketsByWhere("", [], true),
      executeRows<RowDataPacket[]>(
        pool,
        `
          SELECT
            u.id,
            u.company,
            COUNT(r.id) AS reservations
          FROM users u
          LEFT JOIN reservations r ON r.client_user_id = u.id
          WHERE u.role = 'client'
          GROUP BY u.id, u.company
          ORDER BY reservations DESC, u.company ASC
          LIMIT 5
        `,
      ),
    ]);

  return {
    metrics: [
      { label: "Total de Clientes", value: totalClientsRow?.total ?? 0 },
      { label: "Chamados Abertos", value: openTicketsRow?.total ?? 0 },
      { label: "Agentes Ativos", value: activeAgentsRow?.total ?? 0 },
      { label: "WhatsApp Desconectado", value: disconnectedRow?.total ?? 0 },
    ],
    recentClients: recentClients.slice(0, 5),
    recentTickets: recentTickets.slice(0, 5),
    topClients: topRows.map((row) => ({
      id: row.id as string,
      company: row.company as string,
      reservations: Number(row.reservations || 0),
    })),
  };
}
