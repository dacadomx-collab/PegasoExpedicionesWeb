# 🧬 SYSTEM CODEX & REGISTRY — Pegaso Expediciones
**v2 | Sistema de Reservas y Pagos con PayPal Checkout**
**Proyecto:** Turismo de Aventura (Tiburón Ballena, Buceo, etc.)
**Última actualización:** 2026-04-17 (Schema migrado a inglés — Escenario A confirmado) | **Modo:** Génesis Élite v2

> ⚠️ **MANDAMIENTO #4 EN VIGOR:** Si una variable, tabla o componente **NO aparece aquí**, la IA debe **DETENERSE** y solicitar registro explícito al Arquitecto antes de proceder.

---

## 📊 MAPEO DE VARIABLES VALIDADAS (FRONT VS BACK)

### Módulo: `expediciones`
| Concepto | DB / Backend (`snake_case`) | Frontend (`camelCase`) | Tipo de Dato | Regla de Validación |
| :--- | :--- | :--- | :--- | :--- |
| ID de expedición | `expedicion_id` | `expedicionId` | INT UNSIGNED | > 0, requerido |
| Nombre de la expedición | `nombre` | `nombre` | VARCHAR(255) | `trim()`, no vacío, max 255 |
| Descripción | `descripcion` | `descripcion` | TEXT | `trim()`, nullable |
| Precio por persona | `precio` | `precio` | DECIMAL(10,2) | > 0.00, canónico en backend |
| Cupo máximo del grupo | `cupo_maximo` | `cupoMaximo` | INT UNSIGNED | > 0 |
| URL de imagen de portada | `imagen_url` | `imagenUrl` | VARCHAR(500) | URL válida, nullable |
| Visibilidad pública | `activo` | `activo` | TINYINT(1) | Valores: `0` o `1` |

### Módulo: `fechas_expedicion`
| Concepto | DB / Backend (`snake_case`) | Frontend (`camelCase`) | Tipo de Dato | Regla de Validación |
| :--- | :--- | :--- | :--- | :--- |
| ID de fecha | `fecha_expedicion_id` | `fechaExpedicionId` | INT UNSIGNED | > 0, requerido |
| FK expedición padre | `expedicion_id` | `expedicionId` | INT UNSIGNED | FK existente en `expediciones` |
| Fecha de salida | `fecha_salida` | `fechaSalida` | DATE | >= hoy (`CURDATE()`), formato `YYYY-MM-DD` |
| Lugares restantes | `cupo_disponible` | `cupoDisponible` | INT UNSIGNED | >= 0, se decrementa atómicamente |
| Vendible al público | `activo` | `activo` | TINYINT(1) | Valores: `0` o `1` |

### Módulo: `reservas`
| Concepto | DB / Backend (`snake_case`) | Frontend (`camelCase`) | Tipo de Dato | Regla de Validación |
| :--- | :--- | :--- | :--- | :--- |
| ID interno de reserva | `reserva_id` | `reservaId` | INT UNSIGNED | Auto PK, no exponer al form |
| FK expedición | `expedicion_id` | `expedicionId` | INT UNSIGNED | FK válida |
| FK fecha elegida | `fecha_expedicion_id` | `fechaExpedicionId` | INT UNSIGNED | FK válida |
| Nombre completo | `cliente_nombre` | `clienteNombre` | VARCHAR(255) | `trim()`, no vacío, min 3 chars |
| Correo electrónico | `cliente_email` | `clienteEmail` | VARCHAR(255) | `FILTER_VALIDATE_EMAIL`, lowercase |
| Teléfono de contacto | `cliente_telefono` | `clienteTelefono` | VARCHAR(20) | `trim()`, mínimo 7 dígitos numéricos |
| Lugares adquiridos | `num_lugares` | `numLugares` | TINYINT UNSIGNED | >= 1 y <= `cupo_disponible` actual |
| Monto total cobrado | `total_pagado` | `totalPagado` | DECIMAL(10,2) | Calculado SOLO en backend: `precio × num_lugares` |
| Estado del ciclo de pago | `estatus_pago` | `estatusPago` | ENUM | Ver estados permitidos abajo |
| Order ID de PayPal | `orden_paypal` | `ordenPaypal` | VARCHAR(100) | UNIQUE, NOT NULL, generado por PayPal |
| Capture ID de PayPal | `transaccion_paypal` | `transaccionPaypal` | VARCHAR(100) | UNIQUE, nullable hasta la Fase 2 |
| Timestamp del registro | `fecha_reserva` | `fechaReserva` | DATETIME | `DEFAULT CURRENT_TIMESTAMP`, solo lectura |
| IP del cliente | `ip_cliente` | ❌ NO EXPONER | VARCHAR(45) | Solo backend. Usar `$_SERVER['REMOTE_ADDR']` |

**Estados ENUM `estatus_pago` (flujo permitido):**
```
'pendiente' ──► 'completado'
'pendiente' ──► 'fallido'
'completado' ──► 'reembolsado'
```

### Módulo: `transacciones_paypal` (Auditoría inmutable)
| Concepto | DB / Backend (`snake_case`) | Frontend | Tipo de Dato | Notas |
| :--- | :--- | :--- | :--- | :--- |
| ID de evento | `transaccion_id` | ❌ NO EXPONER | INT UNSIGNED | Auto PK |
| FK reserva asociada | `reserva_id` | ❌ NO EXPONER | INT UNSIGNED | Nullable (FK → `reservas.id`) |
| Order ID de PayPal | `orden_paypal` | ❌ NO EXPONER | VARCHAR(100) | Requerido |
| Capture ID de PayPal | `capture_id` | ❌ NO EXPONER | VARCHAR(100) | Nullable |
| Fase del evento | `fase` | ❌ NO EXPONER | ENUM | `'orden_creada'`, `'captura_exitosa'`, `'captura_fallida'` |
| Respuesta raw de PayPal | `respuesta_json` | ❌ NO EXPONER | JSON | JSON crudo de la API. Para análisis forense. |
| Timestamp del evento | `fecha_evento` | ❌ NO EXPONER | DATETIME | `DEFAULT CURRENT_TIMESTAMP` |

### Módulo: `log_errores` (Guardrail — Pilar 05)
| Concepto | DB / Backend (`snake_case`) | Frontend | Tipo | Notas |
| :--- | :--- | :--- | :--- | :--- |
| ID del log | `log_id` | ❌ NO EXPONER | INT UNSIGNED | Auto PK |
| Endpoint de origen | `endpoint` | ❌ NO EXPONER | VARCHAR(100) | Nombre del archivo PHP |
| Nivel de severidad | `nivel` | ❌ NO EXPONER | ENUM | `'WARNING'`, `'ERROR'`, `'CRITICAL'` |
| Mensaje técnico | `mensaje` | ❌ NO EXPONER | TEXT | Nunca al frontend. Solo `error.log` o tabla. |
| Payload de entrada | `contexto_json` | ❌ NO EXPONER | JSON | Datos recibidos al momento del fallo |
| IP del cliente | `ip_cliente` | ❌ NO EXPONER | VARCHAR(45) | Para trazabilidad |
| Timestamp del error | `fecha_evento` | ❌ NO EXPONER | DATETIME | `DEFAULT CURRENT_TIMESTAMP` |

---

## 🗄️ SQL SCHEMA CANÓNICO (FUENTE DE VERDAD)

> ⚠️ **MANDAMIENTO #9:** Ninguna IA puede alterar este schema sin autorización humana explícita.
> ✅ 📊 MAPEO DE VARIABLES VALIDADAS (FRONT VS BACK)'en inglés.

## 📊 MAPEO DE VARIABLES VALIDADAS (FRONT VS BACK) — VERSIÓN INGLÉS (2026-04-21)

### Módulo: `expeditions` (Expediciones)
| Concepto | DB / Backend (`snake_case`) | Frontend (`camelCase`) | Tipo de Dato | Regla |
| :--- | :--- | :--- | :--- | :--- |
| ID de expedición (PK) | `id` | `id` | INT UNSIGNED | > 0, auto_increment |
| Nombre | `name` | `name` | VARCHAR(255) | no vacío |
| Descripción | `description` | `description` | TEXT | nullable |
| Precio (Adulto) | `price` | `price` | DECIMAL(10,2) | > 0.00, canónico en backend |
| **Cupo diario** | **`daily_capacity`** | **`dailyCapacity`** | **INT UNSIGNED** | **> 0. Reemplaza `max_capacity` (2026-04-23). El backend cuenta bookings activos para esa fecha y compara contra este valor.** |
| Imagen de portada | `image_url` | `imageUrl` | VARCHAR(500) | URL válida |
| Visibilidad | `status` | `status` | ENUM | 'active', 'inactive' |

> **Campo virtual en respuesta JSON:** `get_expediciones.php` adjunta `blocked_dates[]` a cada expedición (ver módulo `blocked_dates` abajo). No es columna de `expeditions`.

### ~~Módulo: `expedition_dates`~~ — ⛔ DEPRECADO (2026-04-23)
> **Mutación: Disponibilidad Dinámica.** La tabla `expedition_dates` fue eliminada del schema activo. `departure_date` y `departure_time` migraron a la tabla `bookings`. Los campos `available_spots` desaparecen; el cupo se calcula en tiempo real contando bookings activos contra `expeditions.daily_capacity`. El frontend usa un `<Calendar />` libre bloqueado solo por `blocked_dates` y fechas pasadas.
>
> **Términos prohibidos derivados de esta tabla:** `expedition_date_id`, `available_spots`, `expedition_dates`.

### Módulo: `blocked_dates` (Fechas Bloqueadas) — NUEVO 2026-04-23
| Concepto | DB / Backend (`snake_case`) | Frontend (`camelCase`) | Tipo de Dato | Regla |
| :--- | :--- | :--- | :--- | :--- |
| ID (PK) | `id` | ❌ NO EXPONER | INT UNSIGNED | auto_increment |
| FK expedición | `expedition_id` | ❌ NO EXPONER | INT UNSIGNED | FK → `expeditions.id` ON DELETE CASCADE |
| Fecha bloqueada | `blocked_date` | `date` | DATE | El backend bloquea días completos (sin cupo, clima, mantenimiento) |
| Motivo | `reason` | `reason` | VARCHAR(255) | nullable — visible opcionalmente en UI |

> **Regla:** `get_expediciones.php` adjunta el array `blocked_dates` en cada objeto expedición. El frontend los mapea al prop `disabled` del `<Calendar />`. El backend también valida en `crear_orden_paypal.php` que `departure_date` no esté en `blocked_dates` (doble blindaje).

### Módulo: `customers` (Clientes)
| Concepto | DB / Backend (`snake_case`) | Frontend (`camelCase`) | Tipo de Dato | Regla |
| :--- | :--- | :--- | :--- | :--- |
| ID Cliente (PK) | `id` | `customerId` | INT UNSIGNED | auto_increment |
| Nombre completo | `name` | `name` | VARCHAR(255) | no vacío |
| Correo | `email` | `email` | VARCHAR(255) | FILTER_VALIDATE_EMAIL |
| Teléfono | `phone` | `phone` | VARCHAR(20) | solo numérico/símbolos válidos |

### Módulo: `bookings` (Reservas) — ACTUALIZADO 2026-04-23
| Concepto | DB / Backend (`snake_case`) | Frontend (`camelCase`) | Tipo de Dato | Regla |
| :--- | :--- | :--- | :--- | :--- |
| ID Reserva (PK) | `id` | `id` | INT UNSIGNED | auto_increment |
| FK expedición | `expedition_id` | `expeditionId` | INT UNSIGNED | FK → `expeditions.id` |
| ~~FK fecha~~ | ~~`expedition_date_id`~~ | ~~deprecado~~ | ~~FK~~ | **ELIMINADO — migración Disponibilidad Dinámica** |
| FK cliente | `customer_id` | `customerId` | INT UNSIGNED | FK → `customers.id` |
| **Fecha de salida** | **`departure_date`** | **`departureDate`** | **DATE** | **Elegida libremente por el usuario en Calendar. >= CURDATE(). No debe estar en `blocked_dates`.** |
| **Horario de salida** | **`departure_time`** | **`departureTime`** | **TIME** | **nullable — asignado por el Arquitecto/admin post-reserva o fijo por expedición.** |
| Lugares comprados | `num_spots` | `numSpots` | TINYINT UNSIGNED | >= 1 y <= `daily_capacity` disponible para esa fecha |
| Monto total | `total_amount` | `totalAmount` | DECIMAL(10,2) | Calculado SOLO en backend: `price × num_spots` |
| Estado de pago | `payment_status` | `paymentStatus` | ENUM | 'pending','completed','failed','refunded' |
| Order ID PayPal | `paypal_order_id` | `paypalOrderId` | VARCHAR(100) | UNIQUE |
| Capture ID PayPal | `paypal_transaction_id`| `paypalTransactionId`| VARCHAR(100) | UNIQUE, nullable hasta Fase 2 |
| Fecha de creación | `created_at` | `createdAt` | DATETIME | DEFAULT CURRENT_TIMESTAMP |

> **Regla de cupo dinámico (2026-04-23):** El backend valida que `(SELECT COUNT(*) FROM bookings WHERE expedition_id = X AND departure_date = Y AND payment_status != 'failed') + num_spots <= daily_capacity`. Esta consulta usa `SELECT ... FOR UPDATE` para evitar race conditions (anti-doble reserva).

### Módulo: `admin_users` — FASE 4 (2026-04-24) ⚠️ SCHEMA VERIFICADO CON ALTER TABLE REAL
> **Origen:** Columnas base creadas por el Arquitecto TARS. Columnas `role`, `active` y `last_login_at`
> añadidas con ALTER TABLE ejecutado manualmente el 2026-04-24. Este registro refleja el schema REAL.

| Concepto | DB (`snake_case`) | Frontend | Tipo REAL (confirmado) | Regla |
| :--- | :--- | :--- | :--- | :--- |
| ID Admin (PK) | `id` | ❌ NO EXPONER | INT UNSIGNED | auto_increment |
| Nombre completo | `name` | `adminName` | VARCHAR(255) | no vacío |
| Correo | `email` | `adminEmail` | VARCHAR(255) | UNIQUE, FILTER_VALIDATE_EMAIL |
| Rol | `role` | `role` | VARCHAR(50) | DEFAULT `'super_admin'`. Posibles valores: `'super_admin'`. Se añadió AFTER `email`. |
| Activo | `active` | ❌ NO EXPONER | TINYINT(1) | DEFAULT 1. Solo `active = 1` puede iniciar sesión. Se añadió AFTER `role`. |
| Hash de contraseña | `password_hash` | ❌ NO EXPONER | VARCHAR(255) | bcrypt cost 12. NUNCA al frontend ni logs. |
| Creación | `created_at` | ❌ NO EXPONER | DATETIME | DEFAULT CURRENT_TIMESTAMP |
| Último login | `last_login_at` | ❌ NO EXPONER | DATETIME NULL | Actualizado post-login con try/catch aislado. Se añadió AFTER `created_at`. |

> **Roles canónicos permitidos en `admin_users.role` (FASE 5 — 2026-04-24):**
> | Valor en DB | Label UI | Acceso permitido |
> | :--- | :--- | :--- |
> | `super_admin` | Super Admin | Todas las pestañas: Reservas, Configuración, Usuarios |
> | `operaciones` | Operaciones | Solo pestaña Reservas + Calendario de Ocupación |
> | `ventas` | Ventas | Solo pestaña Reservas (vista y WhatsApp) |
>
> **Endpoints protegidos por rol (Seguridad Perimetral):**
> - `requireRole(['super_admin'])` → `get_settings.php`, `update_settings.php`, `list_admin_users.php`, `create_admin_user.php`, `toggle_admin_user.php`
> - `requireRole(['super_admin', 'operaciones', 'ventas'])` → endpoints sin restricción de rol adicional (solo JWT válido)
>
> **ALTER TABLE ejecutados (2026-04-24 — por el Arquitecto TARS, corrección de violación Mandamiento #9):**
> ```sql
> ALTER TABLE admin_users ADD COLUMN role VARCHAR(50) NOT NULL DEFAULT 'super_admin' AFTER email;
> ALTER TABLE admin_users ADD COLUMN active TINYINT(1) NOT NULL DEFAULT 1 AFTER role;
> ALTER TABLE admin_users ADD COLUMN last_login_at DATETIME NULL AFTER created_at;
> ```

> **Reglas de Seguridad:**
> - `password_hash` usa `PASSWORD_BCRYPT` con `cost = 12`. Nunca almacenar texto plano.
> - `login.php` usa `password_verify()` con hash dummy si el usuario no existe (evita timing attacks).
> - Los tokens JWT tienen TTL 8 horas. Firmados con HS256 usando `JWT_SECRET` del `.env`.
> - El script `setup_first_admin.php` inserta `role = 'super_admin'` (alineado con DEFAULT real). Solo funciona si `admin_users` está vacío. **Eliminarlo tras el primer uso.**
> - `UPDATE last_login_at` está en su propio `try/catch` en `login.php` — un fallo aquí NO impide que el admin acceda.

### Módulo: `system_settings` — CORREGIDO FASE 6 (2026-04-25) ⚠️ COLUMNAS REALES VERIFICADAS
> **ERRATA resuelta 2026-04-25:** El Codex previo usaba `key`, `value`, `is_sensitive`. El esquema REAL en BD es `setting_key`, `setting_value`, `is_secret`. Todo el PHP fue corregido para usar los nombres reales. Los endpoints usan alias SQL para mantener el contrato JSON con el frontend sin cambios.

| Concepto | DB — columna REAL | JSON API (alias) | Tipo | Regla |
| :--- | :--- | :--- | :--- | :--- |
| ID (PK) | `id` | ❌ NO EXPONER | INT UNSIGNED | auto_increment |
| Clave del ajuste | `setting_key` | `key` | VARCHAR(100) | UNIQUE. Formato `snake_case`. |
| Valor del ajuste | `setting_value` | `value` | TEXT | El valor real. Ver enmascarado abajo. |
| Descripción | `description` | `description` | VARCHAR(500) | nullable. |
| ¿Sensible? | `is_secret` | `is_sensitive` (alias) | TINYINT(1) | 1 = enmascarar en `get_settings.php` (muestra `••••••••` + últimos 4 chars). |
| Actualizado el | `updated_at` | `updated_at` | DATETIME | Se actualiza en cada UPDATE. |
| Actualizado por | `updated_by` | ❌ NO EXPONER | INT UNSIGNED | FK → `admin_users.id`. Nullable. |

**Claves canónicas de `system_settings` — ACTUALIZADAS FASE 6 (2026-04-25):**
| setting_key | Tipo de valor | is_secret | Descripción |
| :--- | :--- | :--- | :--- |
| `paypal_mode` | `sandbox` \| `live` | 0 | Entorno PayPal activo |
| `paypal_client_id_sandbox` | STRING | 0 | Client ID público de la app PayPal Sandbox |
| `paypal_secret_sandbox` | STRING | **1** | Client Secret de la app PayPal Sandbox — enmascarado en UI |
| `paypal_client_id_live` | STRING | 0 | Client ID público de la app PayPal Live |
| `paypal_secret_live` | STRING | **1** | Client Secret de la app PayPal Live — enmascarado en UI |
| `whatsapp_contact` | STRING `521XXXXXXXXXX` | 0 | Número de WhatsApp sin `+` (reemplaza `whatsapp_phone`) |
| `urgent_booking_msg` | STRING | 0 | Mensaje en widget cuando ventas pausadas |
| `admin_notification_emails` | `email1,email2` | 0 | CSV de correos que reciben alertas de nueva reserva |
| `sales_paused` | `true` \| `false` | 0 | Pausa global de ventas |
| `paypal_client_id` | STRING | 0 | **OBSOLETA** — legacy, reemplazada por las granulares sandbox/live |
| `paypal_client_secret` | STRING | **1** | **OBSOLETA** — legacy, reemplazada por las granulares sandbox/live |
| `whatsapp_phone` | STRING | 0 | **OBSOLETA** — legacy, reemplazada por `whatsapp_contact` |

> **Reglas de Lectura:**
> - `get_public_settings.php` (sin auth): lee `paypal_mode`, resuelve `paypal_client_id_{mode}` y lo expone como `paypal_client_id`. Lee `whatsapp_contact` (fallback `whatsapp_phone`). Expone también `sales_paused` y `urgent_booking_msg`. NUNCA expone secrets.
> - `get_settings.php` (JWT requerido): devuelve todas las claves. Los de `is_secret = 1` se enmascaran. Alias SQL: `setting_key AS key`, `setting_value AS value`, `is_secret AS is_sensitive`.
> - `crear_orden_paypal.php` lee `paypal_mode` → selecciona `paypal_client_id_{mode}` y `paypal_secret_{mode}`. Fallback a claves legacy → `.env`.
> - `update_settings.php` recibe `{ key, value }` del frontend. Busca en BD por `setting_key = key`. Actualiza `setting_value`.

### Módulo: `system_settings_audit` — CORREGIDO FASE 6 (2026-04-25)
| Concepto | DB — columna REAL | Frontend | Tipo | Regla |
| :--- | :--- | :--- | :--- | :--- |
| ID (PK) | `id` | ❌ NO EXPONER | INT UNSIGNED | auto_increment |
| Clave modificada | `setting_key` | ❌ NO EXPONER | VARCHAR(100) | Copia de `system_settings.setting_key` |
| Valor anterior | `old_value` | ❌ NO EXPONER | TEXT | nullable. |
| Valor nuevo | `new_value` | ❌ NO EXPONER | TEXT | El valor guardado. |
| Quién cambió | `changed_by` | ❌ NO EXPONER | INT UNSIGNED | FK → `admin_users.id`. Nullable. |
| Cuándo | `changed_at` | ❌ NO EXPONER | DATETIME | DEFAULT CURRENT_TIMESTAMP |

> **Regla:** Tabla de solo append (INSERT only). NUNCA UPDATE ni DELETE. El INSERT va dentro de la misma transacción que el UPDATE de `system_settings`.

---

## 🧠 REGISTRO SEMÁNTICO (VOCABULARIO CONTROLADO)

- ✅ **Términos Permitidos (vigente 2026-04-23 — Disponibilidad Dinámica):**
  `booking`, `expedition`, `blocked_date`, `blocked_dates`, `payment_status`, `paypal_order_id`, `paypal_transaction_id`, `capture_id`, `departure_date`, `departure_time`, `daily_capacity`, `name`, `email`, `phone`, `num_spots`, `total_amount`, `error_log`, `paypal_transactions`, `custom_fields`, `customer`

- ❌ **Términos Prohibidos:**
  | Prohibido | Correcto (vigente) | Motivo |
  | :--- | :--- | :--- |
  | `reserva` / `reservas` | `booking` / `bookings` | español deprecado |
  | `expedicion` / `expediciones` | `expedition` / `expeditions` | español deprecado |
  | `fecha_expedicion` / `expedition_date` / `expedition_dates` | `blocked_dates` | tabla eliminada |
  | `expedition_date_id` | `departure_date` en payload | FK eliminada |
  | `available_spots` | `daily_capacity` (+ conteo dinámico) | columna eliminada |
  | `max_capacity` | `daily_capacity` | renombrado 2026-04-23 |
  | `estatus_pago` | `payment_status` | español deprecado |
  | `cupo_disponible` | cálculo dinámico en backend | columna eliminada |
  | `orden_paypal` | `paypal_order_id` | español deprecado |
  | `transaccion_paypal` | `paypal_transaction_id` | español deprecado |
  | `fecha_salida` | `departure_date` | español deprecado |
  | `cliente_nombre` / `cliente_email` / `cliente_telefono` | `customers.name` / `customers.email` / `customers.phone` | español deprecado |
  | `num_lugares` | `num_spots` | español deprecado |
  | `total_pagado` | `total_amount` | español deprecado |
  | `log_errores` | `error_log` | español deprecado |
  | `transacciones_paypal` | `paypal_transactions` | español deprecado |
  | `activo` (TINYINT) | `status` ENUM('active','inactive') | tipo cambiado |

---

## 🧩 REGISTRO DE COMPONENTES FRONTEND

> **Nota:** Stack 100% nativo. HTML5 / CSS3 / Vanilla JS. Sin frameworks.

| Componente | Ruta | Tipo | Estado | Variables que consume |
| :--- | :--- | :--- | :--- | :--- |
| `FormularioReserva` | `index.html` | Page | Pendiente | Todos los módulos |
| `SelectorExpedicion` | `js/ui/selector-expedicion.js` | UI | Pendiente | `expedicionId`, `nombre`, `precio`, `imagenUrl` |
| `SelectorFecha` | `js/ui/selector-fecha.js` | UI | Pendiente | `fechaExpedicionId`, `fechaSalida`, `cupoDisponible` |
| `FormCliente` | `js/ui/form-cliente.js` | UI | Pendiente | `clienteNombre`, `clienteEmail`, `clienteTelefono`, `numLugares` |
| `ResumenPago` | `js/ui/resumen-pago.js` | UI | Pendiente | `nombre`, `fechaSalida`, `numLugares`, `totalPagado` |
| `BotonPayPal` | `js/paypal-checkout.js` | Logic | Pendiente | `ordenPaypal`, `totalPagado` |
| `ConfirmacionReserva` | `js/ui/confirmacion.js` | UI | Pendiente | `transaccionPaypal`, `fechaReserva`, `clienteNombre` |

**Reglas de Interfaz Aplicadas:**
- `SelectorFecha`: Solo muestra fechas donde `activo = 1` y `cupo_disponible > 0`. Deshabilita fechas pasadas en frontend Y backend.
- `ResumenPago`: El campo `totalPagado` es de SOLO LECTURA. Nunca editable por el usuario. Viene del backend.
- `BotonPayPal`: Se renderiza SOLO después de que el backend confirme la creación de la orden (`orden_paypal` disponible).

---

## 🏗️ INFRAESTRUCTURA BACKEND — REGISTRO v2 (2026-04-17)

> Estado: **VALIDADO** por `test_crud.php` — schema confirmado en servidor local.

### Archivos de Fundación (Mandamiento #11)

| Archivo | Ruta | Descripción | Estado |
| :--- | :--- | :--- | :--- |
| Variables de entorno | `.env` | Credenciales locales. **NUNCA commitear.** | ✅ Creado |
| Plantilla pública | `.env.example` | Plantilla sin valores reales. Sí commiteable. | ✅ Creado |
| Blindaje Apache | `.htaccess` | Bloquea `.env`, `logs/`, `.md`, `.sql` desde navegador. | ✅ Creado |
| Conexión PDO | `api/Database.php` | Singleton. Unico punto de acceso a BD. | ✅ Creado |

### Credenciales de BD (Entorno Local)

| Variable `.env` | Valor |
| :--- | :--- |
| `DB_HOST` | `127.0.0.1` |
| `DB_PORT` | `3306` |
| `DB_NAME` | `pegaso_web_services_DB` |
| `DB_USER` | `pegaso_user_db` |
| `DB_CHARSET` | `utf8mb4` |
| `LOG_PATH` | `logs/error.log` |

### PKs Canónicas (schema real en BD)

> ⚠️ Las PKs de todas las tablas se llaman `id` (no `expedicion_id` etc.). Los nombres `_id` del mapeo arriba se refieren a **columnas FK en otras tablas**, no a las PKs.

| Tabla | PK real | FK que la referencia |
| :--- | :--- | :--- |
| `expediciones` | `id` | `fechas_expedicion.expedicion_id`, `reservas.expedicion_id` |
| `fechas_expedicion` | `id` | `reservas.fecha_expedicion_id` |
| `reservas` | `id` | `transacciones_paypal.reserva_id` |
| `transacciones_paypal` | `id` | — |
| `log_errores` | `id` | — |

### Reglas de Integridad Referencial Confirmadas

| Relación | Tipo | Comportamiento |
| :--- | :--- | :--- |
| `fechas_expedicion` → `expediciones` | FK | `ON DELETE CASCADE` (borra fechas al borrar expedición) |
| `reservas` → `expediciones` | FK | Sin acción explícita = `RESTRICT` (no borra expedición con reservas) |
| `reservas` → `fechas_expedicion` | FK | Sin acción explícita = `RESTRICT` |
| `transacciones_paypal` → `reservas` | FK | `ON DELETE SET NULL` (preserva el log aunque se borre la reserva) |

### Columnas de tipo JSON en BD

| Tabla | Columna | Contenido esperado |
| :--- | :--- | :--- |
| `transacciones_paypal` | `respuesta_json` | Respuesta raw de la API PayPal. Siempre `json_encode()` antes de insertar, `json_decode($val, true)` al leer. |
| `log_errores` | `contexto_json` | Payload de entrada al momento del error. Mismas reglas de encode/decode. |

### Orden de INSERT obligatorio (restricciones FK)

```
1. expediciones
2. fechas_expedicion  (necesita expedicion_id)
3. reservas           (necesita expedicion_id + fecha_expedicion_id)
4. transacciones_paypal (necesita reserva_id)
```

### Orden de DELETE obligatorio (evitar FK violation)

```
1. transacciones_paypal
2. reservas
3. fechas_expedicion
4. expediciones
```

---

## 🖥️ INFRAESTRUCTURA FRONTEND (NEXT.JS) — REGISTRO v2 (2026-04-17)

> Estado: **AUDITADO** — motor generado por v0.app, revisado y corregido por Agente Ejecutor.

### Stack de UI Confirmado

| Tecnología | Versión | Rol |
| :--- | :--- | :--- |
| Next.js | 16.2.0 | Framework (App Router, Static Export `output:'export'`) |
| React | 19.2.4 | Runtime |
| TypeScript | 5.7.3 | Tipado estricto (`strict: true`) |
| Tailwind CSS | v4.2.0 | Estilos (sintaxis nueva: `@import 'tailwindcss'`) |
| shadcn/ui | new-york | Componentes base (Radix UI) |
| Radix UI | 1.x–2.x | Primitivas accesibles (45 componentes instalados) |
| date-fns | 4.1.0 | Utilidades de fecha (locale `es`) |
| react-hook-form | 7.54.x | Formularios (instalado, pendiente de integrar) |
| zod | 3.24.x | Validación de schemas (instalado, pendiente de integrar) |
| lucide-react | 0.564.0 | Iconografía |
| next-themes | — | Sistema Dark/Light mode |

### Paleta de Color Canónica (booking-engine)

| Token | Valor | Uso |
| :--- | :--- | :--- |
| `--color-cream` | `#fcfaf5` | Fondo principal |
| `--color-coral` | `#f26d52` | Acción primaria (CTAs, toggles activos) |
| `--color-dark` | `#0f0200` | Texto principal |
| `--color-muted` | `#4c4c4c` | Texto secundario |

**Tipografía:** `Playfair Display` (serif, títulos) + `DM Sans` (sans, cuerpo).

### Estructura de Rutas (App Router)

| Ruta | Archivo | Descripción |
| :--- | :--- | :--- |
| `/` | `app/page.tsx` | Shell principal; renderiza `widget` o `dashboard` según estado |
| Layout raíz | `app/layout.tsx` | Fuentes, `lang="es"`, Vercel Analytics (solo prod) |
| Estilos globales | `app/globals.css` | Variables CSS oklch, Tailwind v4 |

### Componentes Clave Registrados

| Componente | Archivo | Tipo | Variables que consume | Estado |
| :--- | :--- | :--- | :--- | :--- |
| `Home` | `app/page.tsx` | Page (Client) | `View` type | ✅ Corregido |
| `ViewToggle` | `app/page.tsx` | Sub-component | `view: View`, `onViewChange`, `variant` | ✅ Nuevo |
| `BookingWidget` | `components/booking-widget.tsx` | Client Component | `Expedition[]`, `ExpeditionDate`, `departure_time` | ✅ Integrado con API |
| `AdminDashboard` | `components/admin-dashboard.tsx` | Client Component | `BookingAdminView[]`, `PaymentStatus` | ⚠️ Datos hardcoded |
| `ThemeProvider` | `components/theme-provider.tsx` | Provider | `ThemeProviderProps` | ✅ OK |

### Constantes de Contacto (Frontend)

> ⚠️ **PUNTO DE ACCIÓN PARA EL ARQUITECTO:** El número de WhatsApp de Daniel es una constante de negocio. Debe ser registrado aquí y configurado como variable de entorno `NEXT_PUBLIC_CONTACT_PHONE` en `.env.local` y `.env.example`. Actualmente es un placeholder en el código.

| Constante | Variable de Entorno | Valor actual | Uso |
| :--- | :--- | :--- | :--- |
| `DANIEL_WHATSAPP` | `NEXT_PUBLIC_CONTACT_PHONE` | `"521XXXXXXXXXX"` ← **REEMPLAZAR** | Botón WhatsApp en widget cuando la fecha es hoy o mañana |

**Regla de negocio registrada:** Si el usuario selecciona una fecha de salida que corresponde a **hoy** o **mañana**, el flujo de pago online se suspende y el widget muestra un botón de contacto directo por WhatsApp con mensaje pre-llenado (nombre de expedición, fecha, horario, número de personas).

### Types Canónicos del Frontend (booking-engine)

```typescript
// app/page.tsx
type View = "widget" | "dashboard"

// components/admin-dashboard.tsx
type ReservationStatus = "pagado" | "interesado" | "cancelado"
interface Reservation {
  id: number; client: string; phone: string; email: string
  tour: string; date: string; status: ReservationStatus
  amount: number; guests: number
}

// components/booking-widget.tsx  (pendiente formalizar)
interface Tour {
  id: number; name: string; price: number; childPrice: number
  minAge: number; duration: string; requirements: string[]
}
```

### Hooks Registrados

| Hook | Archivo | Qué hace |
| :--- | :--- | :--- |
| `useIsMobile()` | `hooks/use-mobile.ts` | Retorna `boolean` (breakpoint 768px via `matchMedia`) |
| `useToast()` | `hooks/use-toast.ts` | Toast con reducer. `TOAST_LIMIT=1`. No usa React Context. |

### Reglas de Integración con Backend PHP

> Estas reglas aplican cuando se conecten los endpoints definidos en `03_CONTRATOS_API_Y_LOGICA.md`.

1. **URL de API:** Usar variable de entorno `NEXT_PUBLIC_API_URL`. **PROHIBIDO** hardcodear la URL del servidor PHP.
2. **`NEXT_PUBLIC_` scope:** Solo variables no-secretas (URL base de API). Nunca credenciales.
3. **Fallback obligatorio:** Todo `fetch()` a PHP debe tener un bloque `try/catch` con estado de error visible en UI.
4. **Total monetario:** El campo `totalPagado` viene del backend. El frontend NO calcula el precio final para PayPal.
5. **Static Export:** `output: 'export'` está activado. **PROHIBIDO** usar API Routes de Next.js (`app/api/`). Toda la lógica de servidor va en PHP.

### Advertencias de Deuda Técnica (Auditadas 2026-04-17)

| ID | Componente | Problema | Prioridad |
| :--- | :--- | :--- | :--- |
| DT-01 | `booking-widget.tsx` | `tours[]` hardcodeado — debe venir del endpoint `GET /api/expediciones` | Alta |
| DT-02 | `admin-dashboard.tsx` | `reservations[]` hardcodeado — debe venir de `GET /api/reservas` | Alta |
| DT-03 | `booking-widget.tsx` | Parámetro `date` en `disabled={(date) => ...}` oculta el estado `date` del componente | Media |
| DT-04 | `booking-widget.tsx` | Sin validación Zod en el formulario (zod instalado pero sin usar) | Media |
| DT-05 | `admin-dashboard.tsx` | `handleWhatsApp` usa `replace(/\s/g,'')` — no elimina `+` ni `-` del número | Baja |
| DT-06 | `booking-widget.tsx` | Interfaz `Tour` no formalizada (inferida de array) | Baja |

---

## 🚀 INFRAESTRUCTURA CI/CD — FIX FTP 421 (2026-06-22)

> **Archivo:** `.github/workflows/main-deploy.yml` — acción `SamKirkland/FTP-Deploy-Action@v4.3.5`.

**Causa raíz del error 421:** la cuenta FTP `despliegue@pegasoexpediciones.com` está **enjaulada (chrooted) por cPanel** en `/home/pegaso/public_html/despliegue`. Una cuenta FTP enjaulada ve su propio directorio home como la raíz `/` de la conexión — no existe un `public_html/` navegable dentro de su propia jaula. El workflow tenía `server-dir: public_html/`, lo cual intentaba aterrizar en `.../despliegue/public_html/` (ruta inexistente) → fallo de conexión/path.

**Fix aplicado:** `server-dir: ./` — sube siempre a la raíz que el FTP enjaulado expone, sin importar cuál sea físicamente esa carpeta en el servidor.

**Regla para el futuro (si se decide deployar directo a la raíz real de `public_html/`):** el cambio NO se hace en este YAML. Se gestiona desde cPanel → File Manager → Cuentas FTP, creando/editando la cuenta para que su "Directory" sea `public_html/` directamente. El parámetro `server-dir: ./` del workflow se queda igual — el enjaulado siempre expone su propio home como `/`.

**Secrets:** `server`, `username`, `password` siguen viniendo de `${{ secrets.FTP_SERVER }}`, `${{ secrets.FTP_USERNAME }}`, `${{ secrets.FTP_PASSWORD }}` (Mandamiento #12, Bóveda de Secretos). Sin cambios — ya cumplía.

### 🛠️ FIX: `next build` roto por `AdminRole` incompleto en `users-panel.tsx` (2026-06-22)

**Causa raíz:** `AdminRole` se extendió a `"super_admin" | "operaciones" | "ventas" | "partner"` en Fase 7 (2026-06-16, Portal AXON DCD) — ver `lib/types.ts:83`. `booking-engine/components/users-panel.tsx` nunca se actualizó: `ROLES` (`Record<AdminRole, …>`) y `AVATAR_BG` (`Record<AdminRole, string>`) seguían con solo 3 claves → TypeScript estricto rompe el build (`next build` corre `tsc` antes de generar páginas).

**Fix aplicado:**
- `ROLES.partner` agregado: `label: "Partner"`, `description: "Portal AXON DCD: Partner Academy, sin acceso al dashboard de reservas"` (descripción real, alineada con `admin-dashboard.tsx` — `isPartner` oculta el tab Dashboard y el `ASFLWidget`, redirige a `academia`), `icon: Handshake` (lucide-react, nuevo import), `badge`/`dot` en paleta teal (sin colisión con los 3 roles existentes).
- `AVATAR_BG.partner` agregado: `bg-teal-500`.
- `schema.role` (zod) ahora acepta `"partner"` — si no, el formulario de alta de admin rechazaría ese rol con un 422 silencioso en frontend.
- Grid de "Descripción de permisos" (antes `grid-cols-3` fijo para 3 roles) cambiado a `grid-cols-2 sm:grid-cols-4` para acomodar las 4 tarjetas sin overflow visual.

**Validado:** `npx tsc --noEmit` limpio y `npm run build` (`next build`) completa exitosamente generando las 4 rutas estáticas (`/`, `/_not-found`, `/academy`, `/admin/login`).

> **Regla para el futuro:** cualquier extensión de `AdminRole` en `lib/types.ts` DEBE acompañarse de la actualización simultánea de `ROLES` y `AVATAR_BG` en `users-panel.tsx` — TypeScript ya fuerza esto vía `Record<AdminRole, …>`, pero ambos deben corregirse a la vez para que el contrato de roles no se desincronice silenciosamente otra vez.

---

⚠️ **Hallazgo colateral (fuera de alcance de este fix, reportar al Arquitecto):** `knowledge/info.txt` contiene credenciales reales en texto plano (FTP, BD, PayPal sandbox, login del portal admin) dentro de un archivo del repositorio. Aunque `.htaccess` bloquea `.md`/`.sql`/`.env`, **no bloquea `.txt`** — y de cualquier forma nunca debería vivir en el repo versionado. Recomendado: rotar esas credenciales y mover el contenido a un gestor de secretos fuera de Git.

---

## 🖨️ MÓDULO: `catalog_services` — Landing Print-First (2026-06-22)

> **Contexto:** Página estática `catalogo.html` (catálogo/póster imprimible). NO consume la BD ni la API PHP — es contenido de marketing 100% estático, fuera del flujo de reservas/PayPal. Vive en su propia carpeta `css/` y `js/` en la raíz del proyecto (separada de `assets/css` y `assets/js` del sitio principal) porque es una pieza independiente, no una vista del sitio Bootstrap existente.

| Concepto | Variable JS (`camelCase`) | Tipo | Regla |
| :--- | :--- | :--- | :--- |
| ID del servicio | `id` | STRING (kebab-case) | único, usado como `id` de anchor/print-break |
| Nombre del servicio | `name` | STRING | título visible en la tarjeta |
| Descripción breve | `description` | STRING | días/horario/detalle clave, máx ~120 chars |
| Imagen del servicio | `image` | STRING | nombre de archivo dentro de `assets/images/` (rutas resueltas con `IMAGE_BASE_PATH`) |
| Mensaje de WhatsApp | `whatsappMessage` | STRING | texto plano (SIN urlencode manual); el QR lo codifica dinámicamente con `encodeURIComponent` |

**Constante de contacto:** `WHATSAPP_NUMBER` en `js/catalog-data.js` = `"526121480200"` (número real de Daniel, confirmado por el Arquitecto 2026-06-22). El mismo placeholder pendiente sigue abierto en `booking-engine` (`NEXT_PUBLIC_CONTACT_PHONE`) — no se tocó en esta entrega.

**Imágenes finales (auditoría visual 2026-06-22 — confirmado, fuente de verdad para AXON DCD):**
| Servicio | Constante `image` en `js/catalog-data.js` | Archivo real en `assets/images/` | Motivo de selección |
| :--- | :--- | :--- | :--- |
| Cabalgata al Atardecer | `Horseback_BG.jpg` | ✅ existe | Familia a caballo en playa al atardecer, alta conversión |
| Nado con Tiburón Ballena | `explore-image2.jpg` | ✅ existe | Gráfico ya rotulado "WHALE SHARK SWIMMING" sobre foto real del animal |
| Isla Espíritu Santo | `espiritu_santo_1.jpg` | ✅ existe | Snorkelers en caleta turquesa, más dinámica que `espiritu_santo_2.jpg` |
| Kayak en el Mar de Cortés | `kayak3.jpg` | ✅ existe | Acción real de kayak en mar abierto (vs. `kayak1`/`kayak2` que muestran sombrilla de playa) |
| Hiking Sierra de la Laguna | `hiking3.jpeg` | ✅ existe | Cascada y poza natural, la más vendedora de las 3 opciones de hiking |
| Tour en Lancha a Balandra | `balandra1.jpg` | ✅ existe | La roca-hongo, ícono turístico reconocible de Playa Balandra |

> ⚠️ **Pendiente real:** `tiburon_ballena` usa una imagen genérica rotulada, no una foto propia del tour Pegaso. Sustituir por foto real cuando el Arquitecto la proporcione.

**Maquetación (corregido 2026-06-22 — bug de 4ta columna en desktop ultra-wide):** `.service-card` usa `flex`, `width` Y `max-width` **al mismo `calc(33.333% - gap)`** — los tres atados al mismo porcentaje, nunca un `max-width` en px independiente (esa era la causa del bug: un `max-width:380px` fijo dejaba hueco para una 4ª tarjeta en pantallas >1140px). Mobile-first: 2 columnas ≤979px (`calc(50% - gap)`), 1 columna ≤639px — cada breakpoint repite el patrón flex/width/max-width juntos. En `@media print` se repite el mismo patrón con `min-width: 0` (anula el `min-width:280px` base) para garantizar 3 tarjetas por fila en papel A4/Letter sin importar el viewport reducido del motor de impresión.

**Botón de impresión:** `#print-catalog-btn` en `catalogo.html`, clase `.print-button` (paleta accent `--color-accent`), envuelto junto al lang-switcher en `.catalog-header__actions.no-print`. `js/catalog.js → bindPrintButton()` ejecuta `window.print()`. `.no-print { display: none !important; }` dentro de `@media print` en `css/main.css` oculta TODO el wrapper de acciones (impresión + idioma) en el papel.

### i18n bilingüe EN/ES (2026-06-22)

> **Idioma por defecto:** Inglés (`DEFAULT_LANG = "en"` en `js/catalog-data.js`). El Español es opcional, activado por el usuario.

| Concepto | Variable | Ubicación | Regla |
| :--- | :--- | :--- | :--- |
| Diccionario de textos de servicio | `title: {en, es}`, `description: {en, es}` | `js/catalog-data.js` → `CATALOG_SERVICES[]` | **Rompe el contrato anterior**: `name`/`description` (string plano) quedan REEMPLAZADOS por objetos `{en, es}`. `whatsappMessage` precalculado se ELIMINA — ahora se genera en runtime con `buildCatalogMessage(title, lang)`. |
| Textos estáticos de UI | `UI_STRINGS = {en, es}` | `js/catalog-data.js` | Claves: `pageTitle`, `subtitle`, `printButton`, `qrCaption`, `langSwitchLabel` |
| Plantillas de mensaje WhatsApp | `CATALOG_MESSAGE_TEMPLATES = {en, es}` | `js/catalog-data.js` | Función por idioma, recibe el `title` ya traducido |
| Estado del idioma activo | `let currentLang` | `js/catalog.js` (module-level, no persiste entre reloads — vuelve a `DEFAULT_LANG` al refrescar) | Mutado solo por `bindLangSwitcher()` |

**Flujo de cambio de idioma:** click en `#lang-switch-btn` → `currentLang` alterna `en`/`es` → `renderAll(currentLang)` re-ejecuta `renderStaticStrings()` (header, botones, `document.title`, `document.documentElement.lang`) y `renderCatalog()` (vacía `#catalog-grid` con `innerHTML=""` y reconstruye las 6 tarjetas, incluyendo URL del QR recalculada con el mensaje de WhatsApp en el nuevo idioma).

**Términos prohibidos (rompen el dataset i18n):** `service.name` (usar `service.title[lang]`), `service.whatsappMessage` precalculado (usar `buildCatalogMessage()` en runtime).

**Mensaje de WhatsApp (corregido 2026-06-23):** `CATALOG_MESSAGE_TEMPLATES` ya NO saluda a "Daniel" ni agrega la palabra "tour" después del nombre del servicio (bug: títulos que ya terminan en "Tour", ej. "Balandra Boat Tour", generaban "...Balandra Boat Tour tour..."). Plantilla actual: EN `Hello Pegaso, I'm interested in ${title} and I would like to receive more info.` / ES `Hola Pegaso, me interesa ${title} y quiero recibir más información.`. El número de WhatsApp (`WHATSAPP_NUMBER`) sigue siendo el real de Daniel — solo cambió el saludo del texto, no el destinatario.

**Bitácora de contenido — actualización de horarios/specs (2026-06-23):** El cliente refinó horarios, duraciones y servicios incluidos de 5 de los 6 tours (Hiking sin cambios). Cambios clave: Espíritu Santo y Balandra ahora distinguen salida "Privado" vs "Colectivo"/solo privado y listan "snorkeling, marine safari, beach day"; Tiburón Ballena cambió su salida de 8:00 AM a 11:00 AM y especifica "wetsuits" (antes "life vest"); Kayak cambió su segunda salida de 3:00 PM a 4:00 PM. Re-validado tras el cambio: `numpages === 1` (PDF Letter) sigue cumpliéndose pese a descripciones más largas, 0 errores de consola, EN/ES y QR intactos.

**Impresión en una sola hoja Carta (corregido 2026-06-23):** `@media print` ahora declara `@page { size: letter portrait; margin: 0.3in; }` y reduce proporcionalmente logo/título/tarjetas/QR para que el logo + 6 tarjetas (grid 3x2) entren en una sola página Letter. Validado generando el PDF real (`page.pdf({ format: 'Letter' })`) y confirmando `numpages === 1` con `pdf-parse`.

**Contacto por email (2026-06-24):** Se añadió un canal de contacto por correo (`pegasoexpediciones@gmail.com`) junto al WhatsApp QR, ubicado en `.catalog-header__actions` (junto a imprimir/idioma) por ser otra acción de cabecera, no un dato de tarjeta — se reutiliza el mismo contenedor flex (`display:flex; flex-wrap:wrap; justify-content:center; gap:12px`), ya conforme a ARF-Grid, sin crear un grid nuevo. **Anti-scraping básico:** la dirección NUNCA existe como string literal en `catalogo.html`, `catalog.js` ni `catalog-data.js` — se guarda invertida en `CONTACT_EMAIL_REVERSED` (`js/catalog-data.js`) y se reconstruye solo en memoria vía `getContactEmail()` (`js/catalog.js`), frenando bots que hacen regex sobre el HTML/JS crudo sin ejecutar JS; cualquier navegador real la ejecuta sin fricción. Verificado con Playwright: `fetch` de los 3 archivos fuente confirma ausencia del literal; el DOM ya renderizado sí la muestra en texto plano (`#catalog-email-line`), que es el comportamiento esperado y deseado para el usuario. **Resiliencia / fallback UX:** al click en `#email-contact-btn`, se intenta `navigator.clipboard.writeText(email)` (copia silenciosa) y en paralelo se dispara `window.location.href = mailto:...` con asunto/cuerpo bilingües (`CONTACT_EMAIL_TEMPLATES`); si el dispositivo no tiene cliente de correo configurado, el mailto no hace nada visible pero el email ya quedó copiado — el usuario puede pegarlo manualmente en cualquier webmail. Feedback transitorio (`#email-feedback`, `aria-live="polite"`, autolimpia a 4s) confirma la copia, bilingüe vía `UI_STRINGS[lang].emailCopiedFeedback`. **Variables/clases nuevas:** `CONTACT_EMAIL_REVERSED`, `CONTACT_EMAIL_TEMPLATES`, `buildContactEmailContent()`, `getContactEmail()`, `buildMailtoUrl()`, `showEmailFeedback()`, `bindEmailButton()`; `UI_STRINGS[lang].emailButton/emailIntro/emailCopiedFeedback`; clases CSS `.email-button`, `.catalog-header__email`, `.catalog-header__email-feedback` (todas en `css/main.css`, cero estilos inline, cero `!important`). Probado en navegador real (Playwright): click copia al portapapeles, feedback EN/ES correcto, 0 errores de consola.

**Contacto por email — bloque de impresión sincronizado con el idioma activo (corregido 2026-06-24):** El Arquitecto detectó un punto ciego: en papel no hay clics ni portapapeles, así que el botón/copiar de `#email-contact-btn` no sirve de nada impreso. Primera iteración mostraba EN+ES amontonados en la hoja; el Arquitecto corrigió el criterio de negocio: **la impresión debe ser un espejo exacto del idioma activo en pantalla, nunca ambos a la vez.** Implementación final (JS-driven, Opción B): `renderPrintEmail(lang)` (`js/catalog.js`) recibe el `lang` activo y escribe UNA sola línea (`UI_STRINGS[lang].emailIntro` + `getContactEmail()`) en `#catalog-email-print` (`catalogo.html`, dentro de `<header>`); se invoca desde `renderAll(lang)` junto con `renderStaticStrings`/`renderCatalog`, así que cada toggle de `#lang-switch-btn` reescribe el bloque impreso al nuevo idioma automáticamente — no hay estado duplicado que pueda desincronizarse. El correo sigue reconstruyéndose en memoria con `getContactEmail()`; nunca existe como literal en el HTML/JS fuente, solo en el DOM ya renderizado. **CSS (`main.css`):** `.catalog-header__email-print { display: none; }` por defecto (cero huella en pantalla); dentro de `@media print` se sobreescribe a `display: block` con su propio tipografía (8.5px, `color-secondary`) — cero estilos inline, cero `!important`. **Verificado con Playwright:** con la app en EN, el PDF real (`page.pdf({format:"Letter"})` + `pdf-parse`) contiene la línea EN y **no** contiene el texto ES ("Prefieres correo"); tras alternar a ES, el nuevo PDF contiene solo la línea ES y **no** el texto EN ("Prefer email"); `numpages === 1` en ambos casos; 0 errores de consola.

**Generación del QR (decisión del Arquitecto 2026-06-22):** SIN librería vendorizada. Se usa la API pública `https://api.qrserver.com/v1/create-qr-code/?size={W}x{H}&format=svg&data={mensaje}` dentro de un `<img>`. El parámetro `format=svg` devuelve un vector nítido a cualquier resolución de impresión (no rasteriza). `js/catalog.js` construye la URL por tarjeta con `encodeURIComponent(whatsappMessage completo con número)`. Requiere conexión a internet al momento de ver/imprimir la página (trade-off aceptado por el Humano frente a vendorizar una librería de terceros).
