USE `vintenove_wahub`;

SET FOREIGN_KEY_CHECKS = 0;

DROP TRIGGER IF EXISTS `trg_reservations_validate_bi`;
DROP TRIGGER IF EXISTS `trg_reservations_validate_bu`;

DROP TABLE IF EXISTS `rooms_new`;
DROP TABLE IF EXISTS `reservations_new`;

CREATE TABLE `rooms_new` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `legacy_room_id` CHAR(36) NOT NULL,
  `client_user_id` CHAR(36) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `floor` INT UNSIGNED NOT NULL,
  `capacity` INT UNSIGNED NOT NULL,
  `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  `color` CHAR(7) NOT NULL DEFAULT '#7C3AED',
  `description` TEXT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_rooms_new_legacy_room_id` (`legacy_room_id`),
  UNIQUE KEY `uk_rooms_new_client_name` (`client_user_id`, `name`),
  KEY `idx_rooms_new_client_status` (`client_user_id`, `status`),
  CONSTRAINT `fk_rooms_client_user_v2`
    FOREIGN KEY (`client_user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `rooms_new` (
  `legacy_room_id`,
  `client_user_id`,
  `name`,
  `floor`,
  `capacity`,
  `status`,
  `color`,
  `description`,
  `created_at`,
  `updated_at`
)
SELECT
  `id`,
  `client_user_id`,
  `name`,
  `floor`,
  `capacity`,
  `status`,
  `color`,
  `description`,
  `created_at`,
  `updated_at`
FROM `rooms`
ORDER BY `created_at` ASC, `id` ASC;

CREATE TABLE `reservations_new` (
  `id` CHAR(36) NOT NULL,
  `client_user_id` CHAR(36) NOT NULL,
  `room_id` BIGINT UNSIGNED NOT NULL,
  `created_by_user_id` CHAR(36) DEFAULT NULL,
  `person_name` VARCHAR(150) NOT NULL,
  `reservation_date` DATE NOT NULL,
  `start_time` TIME NOT NULL,
  `end_time` TIME NOT NULL,
  `participants` INT UNSIGNED NOT NULL,
  `status` ENUM('confirmed', 'cancelled', 'completed') NOT NULL DEFAULT 'confirmed',
  `source` ENUM('whatsapp', 'panel', 'manual', 'api') NOT NULL DEFAULT 'whatsapp',
  `room_name_snapshot` VARCHAR(150) NOT NULL,
  `room_color_snapshot` CHAR(7) NOT NULL,
  `floor_snapshot` INT UNSIGNED DEFAULT NULL,
  `event_name` VARCHAR(200) DEFAULT NULL,
  `event_description` TEXT DEFAULT NULL,
  `requester_whatsapp` VARCHAR(25) DEFAULT NULL,
  `requester_email` VARCHAR(255) DEFAULT NULL,
  `guest_emails_json` JSON DEFAULT NULL,
  `cancelled_at` DATETIME DEFAULT NULL,
  `cancel_reason` VARCHAR(255) DEFAULT NULL,
  `completed_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_reservations_new_client_date` (`client_user_id`, `reservation_date`),
  KEY `idx_reservations_new_room_date` (`room_id`, `reservation_date`),
  KEY `idx_reservations_new_status` (`status`),
  KEY `idx_reservations_new_event_name` (`event_name`),
  KEY `idx_reservations_new_person_name` (`person_name`),
  CONSTRAINT `fk_reservations_client_user_v2`
    FOREIGN KEY (`client_user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_reservations_room_v2`
    FOREIGN KEY (`room_id`) REFERENCES `rooms_new` (`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_reservations_created_by_user_v2`
    FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `reservations_new` (
  `id`,
  `client_user_id`,
  `room_id`,
  `created_by_user_id`,
  `person_name`,
  `reservation_date`,
  `start_time`,
  `end_time`,
  `participants`,
  `status`,
  `source`,
  `room_name_snapshot`,
  `room_color_snapshot`,
  `floor_snapshot`,
  `event_name`,
  `event_description`,
  `requester_whatsapp`,
  `requester_email`,
  `guest_emails_json`,
  `cancelled_at`,
  `cancel_reason`,
  `completed_at`,
  `created_at`,
  `updated_at`
)
SELECT
  r.`id`,
  r.`client_user_id`,
  rn.`id` AS `room_id`,
  r.`created_by_user_id`,
  r.`person_name`,
  r.`reservation_date`,
  r.`start_time`,
  r.`end_time`,
  r.`participants`,
  r.`status`,
  r.`source`,
  r.`room_name_snapshot`,
  r.`room_color_snapshot`,
  r.`floor_snapshot`,
  NULL AS `event_name`,
  NULL AS `event_description`,
  NULL AS `requester_whatsapp`,
  NULL AS `requester_email`,
  NULL AS `guest_emails_json`,
  r.`cancelled_at`,
  r.`cancel_reason`,
  r.`completed_at`,
  r.`created_at`,
  r.`updated_at`
FROM `reservations` r
INNER JOIN `rooms_new` rn
  ON rn.`legacy_room_id` = r.`room_id`
ORDER BY r.`created_at` ASC, r.`id` ASC;

RENAME TABLE `rooms` TO `rooms_backup_uuid_20260311`;
RENAME TABLE `reservations` TO `reservations_backup_uuid_20260311`;
RENAME TABLE `rooms_new` TO `rooms`;
RENAME TABLE `reservations_new` TO `reservations`;

ALTER TABLE `rooms`
  DROP COLUMN `legacy_room_id`;

CREATE TABLE IF NOT EXISTS `integration_audit_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `operation` ENUM('calendarios', 'disponibilidade', 'criarevento', 'atualizarevento', 'consultarevento', 'deletarevento') NOT NULL,
  `success` TINYINT(1) NOT NULL,
  `room_id` BIGINT UNSIGNED DEFAULT NULL,
  `reservation_id` CHAR(36) DEFAULT NULL,
  `request_payload` JSON DEFAULT NULL,
  `response_payload` JSON DEFAULT NULL,
  `error_code` VARCHAR(100) DEFAULT NULL,
  `error_message` VARCHAR(255) DEFAULT NULL,
  `ip_address` VARCHAR(45) DEFAULT NULL,
  `user_agent` VARCHAR(500) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_integration_audit_operation_created` (`operation`, `created_at`),
  KEY `idx_integration_audit_reservation` (`reservation_id`),
  KEY `idx_integration_audit_room` (`room_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DELIMITER $$

CREATE TRIGGER `trg_reservations_validate_bi`
BEFORE INSERT ON `reservations`
FOR EACH ROW
BEGIN
  IF NEW.start_time >= NEW.end_time THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Horario invalido: start_time deve ser menor que end_time';
  END IF;

  IF NEW.participants < 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Participants deve ser maior que zero';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM rooms r
    WHERE r.id = NEW.room_id
      AND r.client_user_id = NEW.client_user_id
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'A sala informada nao pertence ao cliente';
  END IF;

  IF NEW.status = 'confirmed' AND EXISTS (
    SELECT 1
    FROM rooms r
    WHERE r.id = NEW.room_id
      AND r.status <> 'active'
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Nao e permitido reservar sala inativa';
  END IF;

  IF NEW.status = 'confirmed' AND EXISTS (
    SELECT 1
    FROM reservations rs
    WHERE rs.room_id = NEW.room_id
      AND rs.reservation_date = NEW.reservation_date
      AND rs.status = 'confirmed'
      AND NEW.start_time < rs.end_time
      AND NEW.end_time > rs.start_time
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Ja existe reserva confirmada em conflito para esta sala e horario';
  END IF;
END $$

CREATE TRIGGER `trg_reservations_validate_bu`
BEFORE UPDATE ON `reservations`
FOR EACH ROW
BEGIN
  IF NEW.start_time >= NEW.end_time THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Horario invalido: start_time deve ser menor que end_time';
  END IF;

  IF NEW.participants < 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Participants deve ser maior que zero';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM rooms r
    WHERE r.id = NEW.room_id
      AND r.client_user_id = NEW.client_user_id
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'A sala informada nao pertence ao cliente';
  END IF;

  IF NEW.status = 'confirmed' AND EXISTS (
    SELECT 1
    FROM rooms r
    WHERE r.id = NEW.room_id
      AND r.status <> 'active'
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Nao e permitido reservar sala inativa';
  END IF;

  IF NEW.status = 'confirmed' AND EXISTS (
    SELECT 1
    FROM reservations rs
    WHERE rs.room_id = NEW.room_id
      AND rs.reservation_date = NEW.reservation_date
      AND rs.status = 'confirmed'
      AND rs.id <> NEW.id
      AND NEW.start_time < rs.end_time
      AND NEW.end_time > rs.start_time
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Ja existe reserva confirmada em conflito para esta sala e horario';
  END IF;
END $$

DELIMITER ;

SET FOREIGN_KEY_CHECKS = 1;
