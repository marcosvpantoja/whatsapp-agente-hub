import { v4 as uuidv4 } from "uuid";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool, type DbExecutor, withTransaction } from "./db.js";

type IntegrationOperation =
  | "calendarios"
  | "disponibilidade"
  | "criarevento"
  | "atualizarevento"
  | "consultarevento"
  | "deletarevento";

type IntegrationCalendarRow = RowDataPacket & {
  idCalendario: number;
  nomeCalendario: string;
  andar: number | null;
  capacidadeRecomendada: number | null;
  descricao: string | null;
  ativo: number;
};

type IntegrationRoomContextRow = RowDataPacket & {
  id: number;
  name: string;
  floor: number;
  capacity: number;
  description: string | null;
  status: "active" | "inactive";
  color: string;
  clientUserId: string;
  timezone: string;
  bookingStartTime: string;
  bookingEndTime: string;
  maxParticipants: number;
  minAdvanceMinutes: number;
};

type ReservationIntervalRow = RowDataPacket & {
  startTime: string;
  endTime: string;
};

type IntegrationReservationRow = RowDataPacket & {
  id: string;
  roomId: number;
  roomName: string;
  roomColor: string;
  roomStatus: "active" | "inactive";
  floor: number | null;
  clientId: string;
  personName: string;
  date: string;
  startTime: string;
  endTime: string;
  meetingLink: string | null;
  participants: number;
  status: "confirmed" | "cancelled" | "completed";
  source: "whatsapp" | "panel" | "manual" | "api";
  eventName: string | null;
  eventDescription: string | null;
  requesterWhatsapp: string | null;
  requesterEmail: string | null;
  guestEmailsJson: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export class IntegrationError extends Error {
  status: number;
  code: string;
  roomId?: number;
  reservationId?: string;

  constructor(status: number, code: string, message: string, context?: { roomId?: number; reservationId?: string }) {
    super(message);
    this.status = status;
    this.code = code;
    this.roomId = context?.roomId;
    this.reservationId = context?.reservationId;
  }
}

export interface IntegrationAvailabilityInput {
  roomId: number;
  date: string;
  startTime: string;
  endTime: string;
}

export interface CreateIntegrationEventInput extends IntegrationAvailabilityInput {
  linkReuniao?: string | null;
  whatsapp?: string | null;
  emailSolicitante?: string | null;
  emailsConvidados?: string[];
  nomeUsuario: string;
  nomeEvento: string;
  descricaoEvento: string;
}

export interface UpdateIntegrationEventInput {
  reservationId: string;
  roomId?: number;
  date: string;
  startTime: string;
  endTime: string;
  linkReuniao?: string | null;
  whatsapp: string;
  emailSolicitante?: string | null;
  emailsConvidados?: string[];
  nomeUsuario?: string | null;
  nomeEvento: string;
  descricaoEvento: string;
}

export interface ConsultIntegrationEventsInput {
  reservationId?: string;
  nomeEvento?: string;
  nomeUsuario?: string;
}

export interface DeleteIntegrationEventInput {
  reservationId?: string;
  nomeEvento?: string;
  whatsapp: string;
}

export interface IntegrationAuditEntry {
  operation: IntegrationOperation;
  success: boolean;
  roomId?: number | null;
  reservationId?: string | null;
  requestPayload?: unknown;
  responsePayload?: unknown;
  errorCode?: string | null;
  errorMessage?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
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

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(value: number) {
  const normalized = Math.max(value, 0);
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
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

function normalizeGuestEmails(emails?: string[] | null) {
  if (!emails || emails.length === 0) {
    return [];
  }

  return [...new Set(emails.map((email) => email.trim().toLowerCase()).filter(Boolean))];
}

function buildParticipantsCount(emailsConvidados?: string[] | null) {
  return Math.max(1, normalizeGuestEmails(emailsConvidados).length + 1);
}

function parseGuestEmails(value: string | null) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function normalizeWhatsappForMatch(value: string | null | undefined) {
  const normalized = (value || "").trim();
  if (!normalized) {
    return "";
  }

  const digitsOnly = normalized.replace(/\D/g, "");
  return digitsOnly || normalized;
}

function mapIntegrationEvent(row: IntegrationReservationRow) {
  return {
    id_evento: row.id,
    id_calendario: row.roomId,
    nome_calendario: row.roomName,
    data: row.date,
    hora_inicio: row.startTime,
    hora_fim: row.endTime,
    link_reuniao: row.meetingLink || "",
    nome_usuario: row.personName,
    nome_evento: row.eventName || "",
    descricao_evento: row.eventDescription || "",
    whatsapp: row.requesterWhatsapp || "",
    email_solicitante: row.requesterEmail || "",
    emails_convidados: parseGuestEmails(row.guestEmailsJson),
    status: row.status,
    ativo: row.roomStatus === "active",
    origem: row.source,
    cor_calendario: row.roomColor,
    andar: row.floor,
    participantes: row.participants,
    cancelado_em: row.cancelledAt,
    motivo_cancelamento: row.cancelReason,
    criado_em: row.createdAt,
    atualizado_em: row.updatedAt,
  };
}

function buildIntegrationCalendarMetadata(room: {
  id: number;
  name: string;
  floor: number | null;
  capacity: number | null;
  description?: string | null;
}) {
  const descricao = room.description?.trim();

  return {
    id_calendario: room.id,
    nome_calendario: room.name,
    ...(room.capacity !== null ? { capacidade_recomendada: room.capacity } : {}),
    ...(room.floor !== null ? { andar: room.floor } : {}),
    ...(descricao ? { descricao } : {}),
  };
}

async function getRoomContextById(executor: DbExecutor, roomId: number) {
  return executeOne<IntegrationRoomContextRow>(
    executor,
    `
      SELECT
        r.id,
        r.name,
        r.floor,
        r.capacity,
        r.description,
        r.status,
        r.color,
        r.client_user_id AS clientUserId,
        COALESCE(us.timezone, 'America/Sao_Paulo') AS timezone,
        COALESCE(TIME_FORMAT(us.booking_start_time, '%H:%i'), '08:00') AS bookingStartTime,
        COALESCE(TIME_FORMAT(us.booking_end_time, '%H:%i'), '20:00') AS bookingEndTime,
        COALESCE(us.max_participants, 30) AS maxParticipants,
        COALESCE(us.min_advance_minutes, 30) AS minAdvanceMinutes
      FROM rooms r
      LEFT JOIN user_settings us ON us.user_id = r.client_user_id
      WHERE r.id = ?
      LIMIT 1
    `,
    [roomId],
  );
}

async function getReservationById(executor: DbExecutor, reservationId: string) {
  return executeOne<IntegrationReservationRow>(
    executor,
    `
      SELECT
        r.id,
        r.room_id AS roomId,
        r.room_name_snapshot AS roomName,
        r.room_color_snapshot AS roomColor,
        rm.status AS roomStatus,
        r.floor_snapshot AS floor,
        r.client_user_id AS clientId,
        r.person_name AS personName,
        DATE_FORMAT(r.reservation_date, '%Y-%m-%d') AS date,
        TIME_FORMAT(r.start_time, '%H:%i') AS startTime,
        TIME_FORMAT(r.end_time, '%H:%i') AS endTime,
        r.meeting_link AS meetingLink,
        r.participants,
        r.status,
        r.source,
        r.event_name AS eventName,
        r.event_description AS eventDescription,
        r.requester_whatsapp AS requesterWhatsapp,
        r.requester_email AS requesterEmail,
        CAST(r.guest_emails_json AS CHAR) AS guestEmailsJson,
        CASE
          WHEN r.cancelled_at IS NULL THEN NULL
          ELSE DATE_FORMAT(r.cancelled_at, '%Y-%m-%d %H:%i:%s')
        END AS cancelledAt,
        r.cancel_reason AS cancelReason,
        DATE_FORMAT(r.created_at, '%Y-%m-%d %H:%i:%s') AS createdAt,
        DATE_FORMAT(r.updated_at, '%Y-%m-%d %H:%i:%s') AS updatedAt
      FROM reservations r
      INNER JOIN rooms rm ON rm.id = r.room_id
      WHERE r.id = ?
      LIMIT 1
    `,
    [reservationId],
  );
}

async function findReservationsByName(executor: DbExecutor, field: "event_name" | "person_name", value: string) {
  return executeRows<IntegrationReservationRow[]>(
    executor,
    `
      SELECT
        r.id,
        r.room_id AS roomId,
        r.room_name_snapshot AS roomName,
        r.room_color_snapshot AS roomColor,
        rm.status AS roomStatus,
        r.floor_snapshot AS floor,
        r.client_user_id AS clientId,
        r.person_name AS personName,
        DATE_FORMAT(r.reservation_date, '%Y-%m-%d') AS date,
        TIME_FORMAT(r.start_time, '%H:%i') AS startTime,
        TIME_FORMAT(r.end_time, '%H:%i') AS endTime,
        r.meeting_link AS meetingLink,
        r.participants,
        r.status,
        r.source,
        r.event_name AS eventName,
        r.event_description AS eventDescription,
        r.requester_whatsapp AS requesterWhatsapp,
        r.requester_email AS requesterEmail,
        CAST(r.guest_emails_json AS CHAR) AS guestEmailsJson,
        CASE
          WHEN r.cancelled_at IS NULL THEN NULL
          ELSE DATE_FORMAT(r.cancelled_at, '%Y-%m-%d %H:%i:%s')
        END AS cancelledAt,
        r.cancel_reason AS cancelReason,
        DATE_FORMAT(r.created_at, '%Y-%m-%d %H:%i:%s') AS createdAt,
        DATE_FORMAT(r.updated_at, '%Y-%m-%d %H:%i:%s') AS updatedAt
      FROM reservations r
      INNER JOIN rooms rm ON rm.id = r.room_id
      WHERE ${field} LIKE ?
      ORDER BY r.reservation_date DESC, r.start_time DESC
    `,
    [`%${value.trim()}%`],
  );
}

async function findDeletionTargetByEventName(executor: DbExecutor, nomeEvento: string) {
  const matches = await executeRows<IntegrationReservationRow[]>(
    executor,
    `
      SELECT
        r.id,
        r.room_id AS roomId,
        r.room_name_snapshot AS roomName,
        r.room_color_snapshot AS roomColor,
        rm.status AS roomStatus,
        r.floor_snapshot AS floor,
        r.client_user_id AS clientId,
        r.person_name AS personName,
        DATE_FORMAT(r.reservation_date, '%Y-%m-%d') AS date,
        TIME_FORMAT(r.start_time, '%H:%i') AS startTime,
        TIME_FORMAT(r.end_time, '%H:%i') AS endTime,
        r.meeting_link AS meetingLink,
        r.participants,
        r.status,
        r.source,
        r.event_name AS eventName,
        r.event_description AS eventDescription,
        r.requester_whatsapp AS requesterWhatsapp,
        r.requester_email AS requesterEmail,
        CAST(r.guest_emails_json AS CHAR) AS guestEmailsJson,
        CASE
          WHEN r.cancelled_at IS NULL THEN NULL
          ELSE DATE_FORMAT(r.cancelled_at, '%Y-%m-%d %H:%i:%s')
        END AS cancelledAt,
        r.cancel_reason AS cancelReason,
        DATE_FORMAT(r.created_at, '%Y-%m-%d %H:%i:%s') AS createdAt,
        DATE_FORMAT(r.updated_at, '%Y-%m-%d %H:%i:%s') AS updatedAt
      FROM reservations r
      INNER JOIN rooms rm ON rm.id = r.room_id
      WHERE LOWER(TRIM(COALESCE(r.event_name, ''))) = LOWER(TRIM(?))
        AND r.status = 'confirmed'
      ORDER BY r.reservation_date DESC, r.start_time DESC
      LIMIT 2
    `,
    [nomeEvento],
  );

  if (matches.length === 0) {
    throw new IntegrationError(404, "EVENTO_NAO_ENCONTRADO", "Nenhum evento encontrado com esse nome.");
  }

  if (matches.length > 1) {
    throw new IntegrationError(409, "EVENTO_AMBIGUO", "Existe mais de um evento com esse nome. Use id_evento.");
  }

  return matches[0];
}

function ensureRoomIsAvailableForScheduling(room: IntegrationRoomContextRow | null, roomId: number) {
  if (!room) {
    throw new IntegrationError(404, "SALA_NAO_ENCONTRADA", "Sala nao encontrada.", { roomId });
  }

  if (room.status !== "active") {
    throw new IntegrationError(400, "SALA_INATIVA", "A sala informada esta inativa.", { roomId });
  }

  return room;
}

function validateScheduleWindow(
  room: IntegrationRoomContextRow,
  input: { date: string; startTime: string; endTime: string },
) {
  const startMinutes = timeToMinutes(input.startTime);
  const endMinutes = timeToMinutes(input.endTime);
  const bookingStartMinutes = timeToMinutes(room.bookingStartTime);
  const bookingEndMinutes = timeToMinutes(room.bookingEndTime);
  const currentDateTime = getCurrentZonedDateTime(room.timezone);

  if (endMinutes <= startMinutes) {
    throw new IntegrationError(
      400,
      "HORARIO_FINAL_ANTES_DO_INICIAL",
      "hora_fim deve ser maior que hora_inicio.",
      { roomId: room.id },
    );
  }

  if (input.date < currentDateTime.date) {
    throw new IntegrationError(400, "AGENDAMENTO_NO_PASSADO", "Nao e permitido agendar em data passada.", {
      roomId: room.id,
    });
  }

  if (startMinutes < bookingStartMinutes || endMinutes > bookingEndMinutes) {
    throw new IntegrationError(
      400,
      "HORARIO_FORA_DA_JANELA_DE_RESERVA",
      `A sala aceita reservas somente entre ${room.bookingStartTime} e ${room.bookingEndTime}.`,
      { roomId: room.id },
    );
  }

  if (input.date === currentDateTime.date) {
    const minimumStartMinutes = timeToMinutes(currentDateTime.time) + room.minAdvanceMinutes;
    if (startMinutes < minimumStartMinutes) {
      throw new IntegrationError(
        400,
        "AGENDAMENTO_NO_PASSADO",
        `A reserva precisa respeitar a antecedencia minima de ${room.minAdvanceMinutes} minutos.`,
        { roomId: room.id },
      );
    }
  }
}

function validateParticipants(room: IntegrationRoomContextRow, participants: number) {
  if (participants > room.capacity) {
    throw new IntegrationError(
      400,
      "CAPACIDADE_DA_SALA_EXCEDIDA",
      `A sala suporta no maximo ${room.capacity} participantes.`,
      { roomId: room.id },
    );
  }

  if (participants > room.maxParticipants) {
    throw new IntegrationError(
      400,
      "LIMITE_DE_PARTICIPANTES_EXCEDIDO",
      `O limite configurado para reservas neste calendario e de ${room.maxParticipants} participantes.`,
      { roomId: room.id },
    );
  }
}

async function getConflictingCount(
  executor: DbExecutor,
  roomId: number,
  date: string,
  startTime: string,
  endTime: string,
  excludeReservationId?: string,
) {
  const conditions = [
    "room_id = ?",
    "reservation_date = ?",
    "status = 'confirmed'",
    "? < end_time",
    "? > start_time",
  ];
  const values: unknown[] = [roomId, date, `${startTime}:00`, `${endTime}:00`];

  if (excludeReservationId) {
    conditions.push("id <> ?");
    values.push(excludeReservationId);
  }

  const row = await executeOne<RowDataPacket & { total: number }>(
    executor,
    `
      SELECT COUNT(*) AS total
      FROM reservations
      WHERE ${conditions.join(" AND ")}
    `,
    values,
  );

  return Number(row?.total || 0);
}

async function getBusyIntervals(
  executor: DbExecutor,
  roomId: number,
  date: string,
  excludeReservationId?: string,
) {
  const conditions = [
    "room_id = ?",
    "reservation_date = ?",
    "status = 'confirmed'",
  ];
  const values: unknown[] = [roomId, date];

  if (excludeReservationId) {
    conditions.push("id <> ?");
    values.push(excludeReservationId);
  }

  return executeRows<ReservationIntervalRow[]>(
    executor,
    `
      SELECT
        TIME_FORMAT(start_time, '%H:%i') AS startTime,
        TIME_FORMAT(end_time, '%H:%i') AS endTime
      FROM reservations
      WHERE ${conditions.join(" AND ")}
      ORDER BY start_time ASC
    `,
    values,
  );
}

function findNearestAvailableSlot(
  room: IntegrationRoomContextRow,
  date: string,
  requestedStartTime: string,
  requestedEndTime: string,
  busyIntervals: ReservationIntervalRow[],
) {
  const duration = timeToMinutes(requestedEndTime) - timeToMinutes(requestedStartTime);
  const bookingStartMinutes = timeToMinutes(room.bookingStartTime);
  const bookingEndMinutes = timeToMinutes(room.bookingEndTime);
  const currentDateTime = getCurrentZonedDateTime(room.timezone);
  const earliestAllowedStart = date === currentDateTime.date
    ? Math.max(bookingStartMinutes, timeToMinutes(currentDateTime.time) + room.minAdvanceMinutes)
    : bookingStartMinutes;

  let cursor = earliestAllowedStart;
  const freeSlots: Array<{ start: number; end: number }> = [];

  for (const interval of busyIntervals) {
    const busyStart = timeToMinutes(interval.startTime);
    const busyEnd = timeToMinutes(interval.endTime);

    if (busyStart > cursor) {
      freeSlots.push({ start: cursor, end: busyStart });
    }

    cursor = Math.max(cursor, busyEnd);
  }

  if (cursor < bookingEndMinutes) {
    freeSlots.push({ start: cursor, end: bookingEndMinutes });
  }

  const requestedStartMinutes = timeToMinutes(requestedStartTime);
  const candidates = freeSlots
    .filter((slot) => slot.end - slot.start >= duration)
    .map((slot) => {
      const latestViableStart = slot.end - duration;
      const candidateStart = Math.min(Math.max(requestedStartMinutes, slot.start), latestViableStart);
      return {
        start: candidateStart,
        end: candidateStart + duration,
        distance: Math.abs(candidateStart - requestedStartMinutes),
      };
    })
    .sort((left, right) => left.distance - right.distance || left.start - right.start);

  const best = candidates[0];
  if (!best) {
    return null;
  }

  return {
    data: date,
    hora_inicio: minutesToTime(best.start),
    hora_fim: minutesToTime(best.end),
  };
}

export async function listIntegrationCalendars() {
  const rows = await executeRows<IntegrationCalendarRow[]>(
    pool,
    `
      SELECT
        r.id AS idCalendario,
        r.name AS nomeCalendario,
        r.floor AS andar,
        r.capacity AS capacidadeRecomendada,
        r.description AS descricao,
        CASE WHEN r.status = 'active' THEN 1 ELSE 0 END AS ativo
      FROM rooms r
      WHERE r.status = 'active'
      ORDER BY r.name ASC, r.id ASC
    `,
  );

  return rows.map((row) => {
    return {
      ...buildIntegrationCalendarMetadata({
        id: row.idCalendario,
        name: row.nomeCalendario,
        floor: row.andar,
        capacity: row.capacidadeRecomendada,
        description: row.descricao,
      }),
      ativo: Boolean(row.ativo),
    };
  });
}

export async function checkIntegrationAvailability(input: IntegrationAvailabilityInput) {
  const room = ensureRoomIsAvailableForScheduling(await getRoomContextById(pool, input.roomId), input.roomId);
  validateScheduleWindow(room, input);

  const conflictingCount = await getConflictingCount(pool, room.id, input.date, input.startTime, input.endTime);

  if (conflictingCount === 0) {
    return {
      disponivel: true,
      ...buildIntegrationCalendarMetadata(room),
      proximo_horario_disponivel: null,
    };
  }

  const busyIntervals = await getBusyIntervals(pool, room.id, input.date);
  return {
    disponivel: false,
    ...buildIntegrationCalendarMetadata(room),
    proximo_horario_disponivel: findNearestAvailableSlot(
      room,
      input.date,
      input.startTime,
      input.endTime,
      busyIntervals,
    ),
  };
}

export async function createIntegrationEvent(input: CreateIntegrationEventInput) {
  return withTransaction(async (connection) => {
    const room = ensureRoomIsAvailableForScheduling(await getRoomContextById(connection, input.roomId), input.roomId);
    validateScheduleWindow(room, input);

    const participants = buildParticipantsCount(input.emailsConvidados);
    validateParticipants(room, participants);

    const conflictingCount = await getConflictingCount(
      connection,
      room.id,
      input.date,
      input.startTime,
      input.endTime,
    );

    if (conflictingCount > 0) {
      throw new IntegrationError(
        409,
        "CONFLITO_DE_HORARIO",
        "Ja existe um evento confirmado em conflito para esse calendario e horario.",
        { roomId: room.id },
      );
    }

    const reservationId = uuidv4();
    const guestEmails = normalizeGuestEmails(input.emailsConvidados);

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
          event_name,
          event_description,
          meeting_link,
          requester_whatsapp,
          requester_email,
          guest_emails_json
        )
        VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, 'confirmed', 'api', ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        reservationId,
        room.clientUserId,
        room.id,
        input.nomeUsuario.trim(),
        input.date,
        `${input.startTime}:00`,
        `${input.endTime}:00`,
        participants,
        room.name,
        room.color,
        room.floor,
        input.nomeEvento.trim(),
        input.descricaoEvento.trim(),
        input.linkReuniao?.trim() || null,
        input.whatsapp?.trim() || null,
        input.emailSolicitante?.trim().toLowerCase() || null,
        guestEmails.length > 0 ? JSON.stringify(guestEmails) : null,
      ],
    );

    const reservation = await getReservationById(connection, reservationId);

    if (!reservation) {
      throw new IntegrationError(500, "ERRO_NO_PROVEDOR_DE_CALENDARIO", "Nao foi possivel recuperar o evento criado.", {
        roomId: room.id,
        reservationId,
      });
    }

    return {
      id_evento: reservation.id,
      evento: mapIntegrationEvent(reservation),
    };
  });
}

export async function updateIntegrationEvent(input: UpdateIntegrationEventInput) {
  return withTransaction(async (connection) => {
    const existing = await getReservationById(connection, input.reservationId);

    if (!existing) {
      throw new IntegrationError(404, "EVENTO_NAO_ENCONTRADO", "Evento nao encontrado.", {
        reservationId: input.reservationId,
      });
    }

    if (existing.status !== "confirmed") {
      throw new IntegrationError(409, "EVENTO_NAO_EDITAVEL", "Somente eventos confirmados podem ser atualizados.", {
        reservationId: existing.id,
        roomId: existing.roomId,
      });
    }

    const providedWhatsapp = normalizeWhatsappForMatch(input.whatsapp);
    const eventWhatsapp = normalizeWhatsappForMatch(existing.requesterWhatsapp);

    if (!eventWhatsapp || providedWhatsapp !== eventWhatsapp) {
      throw new IntegrationError(
        403,
        "WHATSAPP_NAO_CONFERE",
        "O whatsapp informado nao corresponde ao whatsapp que criou este evento.",
        {
          reservationId: existing.id,
          roomId: existing.roomId,
        },
      );
    }

    const targetRoomId = input.roomId ?? existing.roomId;
    const room = ensureRoomIsAvailableForScheduling(
      await getRoomContextById(connection, targetRoomId),
      targetRoomId,
    );

    validateScheduleWindow(room, input);

    const guestEmails = input.emailsConvidados
      ? normalizeGuestEmails(input.emailsConvidados)
      : parseGuestEmails(existing.guestEmailsJson);
    const participants = buildParticipantsCount(guestEmails);
    validateParticipants(room, participants);

    const conflictingCount = await getConflictingCount(
      connection,
      room.id,
      input.date,
      input.startTime,
      input.endTime,
      existing.id,
    );

    if (conflictingCount > 0) {
      throw new IntegrationError(
        409,
        "CONFLITO_DE_HORARIO",
        "Ja existe um evento confirmado em conflito para esse calendario e horario.",
        { roomId: room.id, reservationId: existing.id },
      );
    }

    const [result] = await connection.execute<ResultSetHeader>(
      `
        UPDATE reservations
        SET
          client_user_id = ?,
          room_id = ?,
          person_name = ?,
          reservation_date = ?,
          start_time = ?,
          end_time = ?,
          participants = ?,
          source = 'api',
          room_name_snapshot = ?,
          room_color_snapshot = ?,
          floor_snapshot = ?,
          event_name = ?,
          event_description = ?,
          meeting_link = ?,
          requester_whatsapp = ?,
          requester_email = ?,
          guest_emails_json = ?,
          updated_at = NOW()
        WHERE id = ?
          AND status = 'confirmed'
      `,
      [
        room.clientUserId,
        room.id,
        input.nomeUsuario?.trim() || existing.personName,
        input.date,
        `${input.startTime}:00`,
        `${input.endTime}:00`,
        participants,
        room.name,
        room.color,
        room.floor,
        input.nomeEvento.trim(),
        input.descricaoEvento.trim(),
        input.linkReuniao === undefined ? existing.meetingLink : input.linkReuniao?.trim() || null,
        existing.requesterWhatsapp,
        input.emailSolicitante?.trim().toLowerCase() || existing.requesterEmail,
        guestEmails.length > 0 ? JSON.stringify(guestEmails) : null,
        existing.id,
      ],
    );

    if (result.affectedRows === 0) {
      throw new IntegrationError(404, "EVENTO_NAO_ENCONTRADO", "Evento nao encontrado.", {
        reservationId: existing.id,
      });
    }

    const updated = await getReservationById(connection, existing.id);

    if (!updated) {
      throw new IntegrationError(500, "ERRO_NO_PROVEDOR_DE_CALENDARIO", "Nao foi possivel recuperar o evento atualizado.", {
        roomId: room.id,
        reservationId: existing.id,
      });
    }

    return {
      id_evento: updated.id,
      evento: mapIntegrationEvent(updated),
    };
  });
}

export async function consultIntegrationEvents(input: ConsultIntegrationEventsInput) {
  if (input.reservationId) {
    const reservation = await getReservationById(pool, input.reservationId);

    if (!reservation) {
      throw new IntegrationError(404, "EVENTO_NAO_ENCONTRADO", "Evento nao encontrado.", {
        reservationId: input.reservationId,
      });
    }

    return {
      eventos: [mapIntegrationEvent(reservation)],
    };
  }

  if (input.nomeEvento) {
    const reservations = await findReservationsByName(pool, "event_name", input.nomeEvento);
    return {
      eventos: reservations.map(mapIntegrationEvent),
    };
  }

  if (input.nomeUsuario) {
    const reservations = await findReservationsByName(pool, "person_name", input.nomeUsuario);
    return {
      eventos: reservations.map(mapIntegrationEvent),
    };
  }

  throw new IntegrationError(
    400,
    "CAMPO_OBRIGATORIO_AUSENTE",
    "Informe id_evento, nome_evento ou nome_usuario para consultar.",
  );
}

export async function deleteIntegrationEvent(input: DeleteIntegrationEventInput) {
  return withTransaction(async (connection) => {
    const target = input.reservationId
      ? await getReservationById(connection, input.reservationId)
      : await findDeletionTargetByEventName(connection, input.nomeEvento || "");

    if (!target) {
      throw new IntegrationError(404, "EVENTO_NAO_ENCONTRADO", "Evento nao encontrado.", {
        reservationId: input.reservationId,
      });
    }

    if (target.status !== "confirmed") {
      throw new IntegrationError(409, "EVENTO_NAO_EDITAVEL", "Somente eventos confirmados podem ser cancelados.", {
        reservationId: target.id,
        roomId: target.roomId,
      });
    }

    const providedWhatsapp = normalizeWhatsappForMatch(input.whatsapp);
    const eventWhatsapp = normalizeWhatsappForMatch(target.requesterWhatsapp);

    if (!eventWhatsapp || providedWhatsapp !== eventWhatsapp) {
      throw new IntegrationError(
        403,
        "WHATSAPP_NAO_CONFERE",
        "O whatsapp informado nao corresponde ao whatsapp que criou este evento.",
        {
          reservationId: target.id,
          roomId: target.roomId,
        },
      );
    }

    const [result] = await connection.execute<ResultSetHeader>(
      `
        UPDATE reservations
        SET
          status = 'cancelled',
          cancelled_at = NOW(),
          cancel_reason = 'Cancelado via API de integracao',
          updated_at = NOW()
        WHERE id = ?
          AND status = 'confirmed'
      `,
      [target.id],
    );

    if (result.affectedRows === 0) {
      throw new IntegrationError(404, "EVENTO_NAO_ENCONTRADO", "Evento nao encontrado.", {
        reservationId: target.id,
      });
    }

    return {
      id_evento: target.id,
      id_calendario: target.roomId,
      status: "cancelled" as const,
    };
  });
}

export async function recordIntegrationAudit(entry: IntegrationAuditEntry) {
  await pool.execute(
    `
      INSERT INTO integration_audit_logs (
        operation,
        success,
        room_id,
        reservation_id,
        request_payload,
        response_payload,
        error_code,
        error_message,
        ip_address,
        user_agent
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      entry.operation,
      entry.success ? 1 : 0,
      entry.roomId || null,
      entry.reservationId || null,
      entry.requestPayload === undefined ? null : JSON.stringify(entry.requestPayload),
      entry.responsePayload === undefined ? null : JSON.stringify(entry.responsePayload),
      entry.errorCode || null,
      entry.errorMessage || null,
      entry.ipAddress || null,
      entry.userAgent || null,
    ],
  );
}
