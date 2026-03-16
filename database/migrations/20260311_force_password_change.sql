USE `vintenove_wahub`;

SELECT IF(
  COUNT(*) = 0,
  'ALTER TABLE `users` ADD COLUMN `must_change_password` TINYINT(1) NOT NULL DEFAULT 0 AFTER `password_hash`',
  'SELECT 1'
) INTO @sql
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'users'
  AND column_name = 'must_change_password';
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT IF(
  COUNT(*) = 0,
  'ALTER TABLE `users` ADD COLUMN `password_changed_at` DATETIME DEFAULT NULL AFTER `must_change_password`',
  'SELECT 1'
) INTO @sql
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'users'
  AND column_name = 'password_changed_at';
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE `users`
SET
  `must_change_password` = 0,
  `password_changed_at` = COALESCE(`password_changed_at`, `created_at`, NOW())
WHERE `must_change_password` = 0
  AND `password_changed_at` IS NULL;
