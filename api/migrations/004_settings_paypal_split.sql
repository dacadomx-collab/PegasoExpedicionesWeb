-- ─────────────────────────────────────────────────────────────────────────────
-- Migración 004 — Separación de credenciales PayPal sandbox/live
--                + nuevas claves de configuración
-- Fecha: 2026-04-25
-- Autor: Claude (Ejecutor) — revisado por TARS (Arquitecto)
--
-- NOTA DE ESQUEMA REAL:
--   Las columnas de system_settings son: setting_key, setting_value, is_secret
--   (NO key, value, is_sensitive — esas eran las del Codex desactualizado).
--
-- Qué hace:
--   1. Añade claves granulares de PayPal (sandbox y live por separado).
--   2. Copia valores de paypal_client_id → paypal_client_id_sandbox
--      y paypal_client_secret → paypal_secret_sandbox (migración no destructiva).
--   3. Agrega whatsapp_contact, urgent_booking_msg, admin_notification_emails.
--   4. Claves antiguas se conservan por compatibilidad y quedan OBSOLETAS.
--
-- Ejecución idempotente: INSERT IGNORE no falla si la clave ya existe.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. PayPal Sandbox
INSERT IGNORE INTO system_settings (setting_key, setting_value, description, is_secret, updated_at)
VALUES
  ('paypal_client_id_sandbox', '', 'Client ID público de la app PayPal Sandbox (pruebas)', 0, NOW()),
  ('paypal_secret_sandbox',    '', 'Client Secret de la app PayPal Sandbox — solo backend', 1, NOW());

-- 2. PayPal Live
INSERT IGNORE INTO system_settings (setting_key, setting_value, description, is_secret, updated_at)
VALUES
  ('paypal_client_id_live', '', 'Client ID público de la app PayPal Live (producción)', 0, NOW()),
  ('paypal_secret_live',    '', 'Client Secret de la app PayPal Live — solo backend', 1, NOW());

-- 3. Migrar valores actuales a las nuevas claves Sandbox (no destructivo)
UPDATE system_settings dst
JOIN   system_settings src ON src.setting_key = 'paypal_client_id'
SET    dst.setting_value = src.setting_value, dst.updated_at = NOW()
WHERE  dst.setting_key  = 'paypal_client_id_sandbox'
AND    dst.setting_value = ''
AND    src.setting_value <> '';

UPDATE system_settings dst
JOIN   system_settings src ON src.setting_key = 'paypal_client_secret'
SET    dst.setting_value = src.setting_value, dst.updated_at = NOW()
WHERE  dst.setting_key  = 'paypal_secret_sandbox'
AND    dst.setting_value = ''
AND    src.setting_value <> '';

-- 4. Comunicación y notificaciones
INSERT IGNORE INTO system_settings (setting_key, setting_value, description, is_secret, updated_at)
VALUES
  ('whatsapp_contact',          '', 'Número WhatsApp de contacto — formato 521XXXXXXXXXX', 0, NOW()),
  ('urgent_booking_msg',        'En este momento no hay disponibilidad. Contáctanos por WhatsApp.', 'Mensaje visible en el widget cuando las ventas están pausadas', 0, NOW()),
  ('admin_notification_emails', '', 'Emails separados por coma que reciben alertas de nuevas reservas', 0, NOW());

-- 5. Migrar whatsapp_phone → whatsapp_contact (no destructivo)
UPDATE system_settings dst
JOIN   system_settings src ON src.setting_key = 'whatsapp_phone'
SET    dst.setting_value = src.setting_value, dst.updated_at = NOW()
WHERE  dst.setting_key  = 'whatsapp_contact'
AND    dst.setting_value = ''
AND    src.setting_value <> '';
