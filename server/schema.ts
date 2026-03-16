import type { RowDataPacket } from "mysql2/promise";
import { pool } from "./db.js";

type CountRow = RowDataPacket & {
  total: number;
};

async function columnExists(tableName: string, columnName: string) {
  const [rows] = await pool.execute<CountRow[]>(
    `
      SELECT COUNT(*) AS total
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND column_name = ?
    `,
    [tableName, columnName],
  );

  return Number(rows[0]?.total || 0) > 0;
}

export async function ensureAppSchema() {
  if (!(await columnExists("users", "must_change_password"))) {
    await pool.execute(`
      ALTER TABLE users
        ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 0 AFTER password_hash
    `);
  }

  if (!(await columnExists("users", "password_changed_at"))) {
    await pool.execute(`
      ALTER TABLE users
        ADD COLUMN password_changed_at DATETIME DEFAULT NULL AFTER must_change_password
    `);
  }

  if (!(await columnExists("reservations", "meeting_link"))) {
    await pool.execute(`
      ALTER TABLE reservations
        ADD COLUMN meeting_link VARCHAR(1000) DEFAULT NULL AFTER guest_emails_json
    `);
  }

  if (!(await columnExists("user_settings", "theme_preference"))) {
    await pool.execute(`
      ALTER TABLE user_settings
        ADD COLUMN theme_preference ENUM('dark', 'light') NOT NULL DEFAULT 'dark' AFTER timezone
    `);
  }

  await pool.execute(`
    UPDATE users
    SET password_changed_at = COALESCE(password_changed_at, created_at)
    WHERE must_change_password = 0
      AND password_changed_at IS NULL
  `);

  await pool.execute(`
    UPDATE user_settings
    SET theme_preference = COALESCE(theme_preference, 'dark')
    WHERE theme_preference IS NULL
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS email_settings (
      user_id CHAR(36) NOT NULL,
      enabled TINYINT(1) NOT NULL DEFAULT 0,
      smtp_host VARCHAR(255) DEFAULT NULL,
      smtp_port SMALLINT UNSIGNED NOT NULL DEFAULT 587,
      smtp_security ENUM('none', 'starttls', 'ssl_tls') NOT NULL DEFAULT 'starttls',
      smtp_username VARCHAR(255) DEFAULT NULL,
      smtp_password_encrypted TEXT DEFAULT NULL,
      smtp_from_name VARCHAR(150) DEFAULT NULL,
      smtp_from_email VARCHAR(255) DEFAULT NULL,
      smtp_reply_to_email VARCHAR(255) DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id),
      CONSTRAINT fk_email_settings_user
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS ticket_attachments (
      id CHAR(36) NOT NULL,
      ticket_note_id CHAR(36) NOT NULL,
      uploaded_by_user_id CHAR(36) DEFAULT NULL,
      file_name VARCHAR(255) NOT NULL,
      mime_type VARCHAR(150) NOT NULL,
      file_size INT UNSIGNED NOT NULL,
      file_data LONGBLOB NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_ticket_attachments_note (ticket_note_id),
      KEY idx_ticket_attachments_uploaded_by (uploaded_by_user_id),
      CONSTRAINT fk_ticket_attachments_note
        FOREIGN KEY (ticket_note_id) REFERENCES ticket_notes (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
      CONSTRAINT fk_ticket_attachments_uploaded_by
        FOREIGN KEY (uploaded_by_user_id) REFERENCES users (id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS integration_audit_logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      operation ENUM('calendarios', 'disponibilidade', 'criarevento', 'atualizarevento', 'consultarevento', 'deletarevento') NOT NULL,
      success TINYINT(1) NOT NULL,
      room_id BIGINT UNSIGNED DEFAULT NULL,
      reservation_id CHAR(36) DEFAULT NULL,
      request_payload JSON DEFAULT NULL,
      response_payload JSON DEFAULT NULL,
      error_code VARCHAR(100) DEFAULT NULL,
      error_message VARCHAR(255) DEFAULT NULL,
      ip_address VARCHAR(45) DEFAULT NULL,
      user_agent VARCHAR(500) DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_integration_audit_operation_created (operation, created_at),
      KEY idx_integration_audit_reservation (reservation_id),
      KEY idx_integration_audit_room (room_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}
