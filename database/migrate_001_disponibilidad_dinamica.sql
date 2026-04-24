-- =============================================================
-- MIGRACIÓN 001 — Disponibilidad Dinámica
-- Autorizada por: El Arquitecto (2026-04-23)
-- Ejecutar UNA sola vez en local y staging antes de producción.
-- Mandamiento #9: solo el Arquitecto ejecuta migraciones.
-- =============================================================

-- ── DIAGNÓSTICO PREVIO ────────────────────────────────────────
-- Ejecutar antes para confirmar el estado actual:
--   DESCRIBE expeditions;
--   DESCRIBE bookings;
--   SHOW CREATE TABLE bookings;
--   SHOW TABLES LIKE 'blocked_dates';

-- ── PASO 1: expedition_dates ──────────────────────────────────
-- Eliminar el FK de bookings que apunta a expedition_dates.
-- Nombre del constraint confirmado en error.log: fk_bookings_date
ALTER TABLE bookings DROP FOREIGN KEY fk_bookings_date;

-- Eliminar la columna FK ahora que la constraint no bloquea.
ALTER TABLE bookings DROP COLUMN expedition_date_id;

-- NOTA: La tabla expedition_dates se deja intacta por seguridad.
-- El Arquitecto puede eliminarla manualmente cuando confirme que
-- ningún otro sistema la referencia: DROP TABLE expedition_dates;

-- ── PASO 2: bookings — añadir departure_date y departure_time ─
-- Solo ejecutar si las columnas aún no existen.
-- (MySQL 8.0+ soporta ADD COLUMN IF NOT EXISTS)
ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS departure_date DATE         NOT NULL COMMENT 'Elegida libremente por el usuario en el Calendar' AFTER expedition_id,
    ADD COLUMN IF NOT EXISTS departure_time TIME         NULL     COMMENT 'Opcional — asignado por admin post-reserva'       AFTER departure_date;

-- ── PASO 3: expeditions — daily_capacity ─────────────────────
-- Cupo diario máximo (reemplaza la lógica de available_spots).
-- DEFAULT 10 como valor seguro hasta que el Arquitecto configure cada tour.
ALTER TABLE expeditions
    ADD COLUMN IF NOT EXISTS daily_capacity INT UNSIGNED NOT NULL DEFAULT 10 COMMENT 'Cupo máximo por día. Codex §02.' AFTER price;

-- ── PASO 4: blocked_dates — tabla nueva ──────────────────────
CREATE TABLE IF NOT EXISTS blocked_dates (
    id            INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
    expedition_id INT UNSIGNED  NOT NULL,
    blocked_date  DATE          NOT NULL,
    reason        VARCHAR(255)  NULL COMMENT 'Motivo visible opcionalmente en UI',
    created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_blocked_expedition
        FOREIGN KEY (expedition_id) REFERENCES expeditions(id)
        ON DELETE CASCADE,
    UNIQUE KEY uq_expedition_blocked_date (expedition_id, blocked_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── VERIFICACIÓN FINAL ────────────────────────────────────────
-- Ejecutar para confirmar que la migración fue exitosa:
--   DESCRIBE bookings;
--   DESCRIBE expeditions;
--   SHOW TABLES LIKE 'blocked_dates';
--   SELECT * FROM blocked_dates LIMIT 5;
