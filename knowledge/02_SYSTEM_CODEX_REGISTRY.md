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
