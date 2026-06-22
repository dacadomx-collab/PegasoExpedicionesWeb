-- ============================================================
-- Migración 005: Sistema de Bienvenida para Partners
-- Fecha: 2026-06-16
-- Autor: AXON DCD — Ejecutor Forense
-- ============================================================
-- Propósito:
--   Agrega la columna `fecha_fundacion` a `admin_users`.
--   Esta columna registra el PRIMER acceso de un usuario con rol
--   'partner'. Mientras sea NULL, el portal muestra la tarjeta de
--   bienvenida histórica. Una vez establecida, el partner va directo
--   al dashboard.
--
-- El campo `role` ya es VARCHAR(50) — 'partner' es válido sin ALTER.
--
-- EJECUTAR SOLO UNA VEZ. Idempotente: usa IF NOT EXISTS.
-- ============================================================

-- 1. Agregar columna fecha_fundacion (NULL = nunca ha ingresado)
ALTER TABLE `admin_users`
  ADD COLUMN IF NOT EXISTS `fecha_fundacion` DATETIME DEFAULT NULL
    COMMENT 'Timestamp del primer acceso del partner (portal AXON DCD). NULL = no ha visto la bienvenida.';

-- 2. Índice para filtrar por rol rápidamente (útil en list_admin_users)
CREATE INDEX IF NOT EXISTS `idx_admin_users_role`
  ON `admin_users` (`role`);

-- 3. Insertar partners de la Fase Deploy (idempotente via ON DUPLICATE KEY)
--    Contraseñas: hash bcrypt cost=12 generado externamente.
--    REEMPLAZAR los hashes a continuación antes de ejecutar en producción.
--    Para generar: php -r "echo password_hash('PASSWORD_AQUI', PASSWORD_BCRYPT, ['cost'=>12]);"
--
-- INSERT INTO `admin_users` (name, email, password_hash, role, active)
-- VALUES
--   ('Yadira', 'yadira@email.com', '$2y$12$HASH_YADIRA', 'partner', 1),
--   ('Bere',   'bere@email.com',   '$2y$12$HASH_BERE',   'partner', 1)
-- ON DUPLICATE KEY UPDATE role = 'partner', active = 1;

-- ============================================================
-- ROLLBACK (ejecutar si se necesita revertir):
-- ALTER TABLE `admin_users` DROP COLUMN IF EXISTS `fecha_fundacion`;
-- DROP INDEX IF EXISTS `idx_admin_users_role` ON `admin_users`;
-- ============================================================
