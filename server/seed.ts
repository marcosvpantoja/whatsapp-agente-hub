import bcrypt from "bcryptjs";
import type { RowDataPacket } from "mysql2/promise";
import { pool, withTransaction } from "./db.js";
import { env } from "./env.js";
import { toDateTimeString } from "./utils.js";
import { clients, masterUser, reservations, rooms, tickets } from "../src/lib/mockData.js";

type CountRow = RowDataPacket & {
  total: number;
};

export async function seedDatabaseIfNeeded() {
  if (!env.SEED_ON_STARTUP) {
    return;
  }

  const [rows] = await pool.execute<CountRow[]>("SELECT COUNT(*) AS total FROM users");
  const totalUsers = rows[0]?.total ?? 0;

  if (totalUsers > 0) {
    return;
  }

  if (!env.SEED_MASTER_PASSWORD || !env.SEED_DEFAULT_CLIENT_PASSWORD) {
    throw new Error(
      "SEED_MASTER_PASSWORD e SEED_DEFAULT_CLIENT_PASSWORD são obrigatórios quando SEED_ON_STARTUP=true.",
    );
  }

  const masterPasswordHash = await bcrypt.hash(env.SEED_MASTER_PASSWORD, 12);
  const clientPasswordHash = await bcrypt.hash(env.SEED_DEFAULT_CLIENT_PASSWORD, 12);

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
          password_changed_at,
          last_login_at,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        masterUser.id,
        masterUser.name,
        masterUser.email,
        masterUser.company,
        masterUser.role,
        null,
        masterUser.status,
        masterPasswordHash,
        1,
        null,
        toDateTimeString(masterUser.lastLogin),
        toDateTimeString(masterUser.createdAt),
      ],
    );

    for (const client of clients) {
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
          password_changed_at,
          last_login_at,
          created_at
        )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          client.id,
          client.name,
          client.email,
          client.company,
          client.role,
          client.agentName || null,
          client.status,
          clientPasswordHash,
          1,
          null,
          toDateTimeString(client.lastLogin),
          toDateTimeString(client.createdAt),
        ],
      );

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
          VALUES (?, 'Syntra', 'America/Sao_Paulo', 'dark', '08:00:00', '20:00:00', 30, 30)
        `,
        [client.id],
      );
    }

    const usersWithWhatsapp = [masterUser, ...clients];
    for (const user of usersWithWhatsapp) {
      await connection.execute(
        `
          INSERT INTO whatsapp_connections (
            id,
            user_id,
            display_name,
            phone_number,
            status,
            last_sync_at,
            connected_at,
            disconnected_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          `wa-${user.id}`,
          user.id,
          user.agentName || user.name,
          user.whatsappNumber || null,
          user.whatsappConnected ? "connected" : "disconnected",
          toDateTimeString(user.lastSync || null),
          user.whatsappConnected ? toDateTimeString(user.lastSync || user.lastLogin) : null,
          user.whatsappConnected ? null : toDateTimeString(user.lastLogin),
        ],
      );
    }

    for (const room of rooms) {
      await connection.execute(
        `
          INSERT INTO rooms (
            id,
            client_user_id,
            name,
            floor,
            capacity,
            status,
            color,
            description
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          room.id,
          room.clientId,
          room.name,
          room.floor,
          room.capacity,
          room.status,
          room.color,
          room.description,
        ],
      );
    }

    for (const reservation of reservations) {
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
            cancelled_at,
            cancel_reason,
            completed_at,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'whatsapp', ?, ?, ?, ?, ?, ?, NOW(), NOW())
        `,
        [
          reservation.id,
          reservation.clientId,
          reservation.roomId,
          reservation.clientId,
          reservation.personName,
          reservation.date,
          `${reservation.startTime}:00`,
          `${reservation.endTime}:00`,
          reservation.participants,
          reservation.status,
          reservation.roomName,
          reservation.roomColor,
          reservation.floor || null,
          toDateTimeString(reservation.cancelledAt || null),
          reservation.cancelReason || null,
          reservation.status === "completed" ? toDateTimeString(reservation.date) : null,
        ],
      );
    }

    for (const ticket of tickets) {
      await connection.execute(
        `
          INSERT INTO tickets (
            id,
            client_user_id,
            created_by_user_id,
            assigned_to_user_id,
            client_name_snapshot,
            company_snapshot,
            email_snapshot,
            title,
            description,
            status,
            priority,
            resolved_at,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'medium', ?, ?, ?)
        `,
        [
          ticket.id,
          ticket.clientId,
          ticket.clientId,
          ticket.assignedTo ? masterUser.id : null,
          ticket.clientName,
          ticket.company,
          ticket.email,
          ticket.title,
          ticket.description,
          ticket.status,
          ticket.status === "resolved" ? toDateTimeString(ticket.updatedAt) : null,
          toDateTimeString(ticket.createdAt),
          toDateTimeString(ticket.updatedAt),
        ],
      );

      for (const note of ticket.notes || []) {
        await connection.execute(
          `
            INSERT INTO ticket_notes (
              id,
              ticket_id,
              author_user_id,
              author_name,
              note_text,
              is_internal,
              created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
          [
            note.id,
            ticket.id,
            note.internal ? masterUser.id : ticket.clientId,
            note.author,
            note.text,
            note.internal ? 1 : 0,
            toDateTimeString(note.createdAt),
          ],
        );
      }
    }
  });
}
