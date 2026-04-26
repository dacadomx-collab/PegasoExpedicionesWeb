# 🤝 CONTRATOS DE API Y LÓGICA DE NEGOCIO — Pegaso Expediciones
**v2 | Sistema de Reservas y Pagos con PayPal Checkout**
**Última actualización:** 2026-04-15 | **Modo:** Génesis Élite v2

> ⚠️ **MANDAMIENTO #5 EN VIGOR:** Prohibido alterar nombres de propiedades JSON definidos aquí. Cualquier cambio requiere aprobación del Arquitecto y actualización de este contrato.

---

## 📡 PROTOCOLO DE INTEGRACIÓN (BASE)

- **Intercambio:** JSON / UTF-8 exclusivamente.
- **Headers de respuesta:** Gestionados por `api/conexion.php` (CORS dinámico, `Content-Type: application/json`).
- **Métodos soportados:** `GET`, `POST`, `OPTIONS` (preflight).
- **Cero Deriva (JSON Schema):** Por cada endpoint documentado aquí, Claude DEBE crear un validador PHP estricto para rechazar cargas inválidas con HTTP 422 antes de tocar DB o APIs externas.
- **Snippets primero:** Consultar `/knowledge/snippets/` antes de crear componentes desde cero.

### Estructura Standard de Respuesta (INMUTABLE)
```json
// Éxito
{ "status": "success", "message": "string descriptivo", "data": { } }

// Error de validación de entrada (HTTP 422 Unprocessable Entity)
{ "status": "error", "message": "string descriptivo", "errors": [ "campo: motivo" ] }

// Error de servidor o de API externa (HTTP 500)
{ "status": "error", "message": "Ocurrió un error interno. Intenta de nuevo." }
```

> **Regla de Oro de Errores (Guardrail 05):** El `message` en errores 500 es SIEMPRE genérico al frontend. El error técnico real va al `error.log` / tabla `log_errores`. **NUNCA** exponer stack traces, mensajes PDO ni detalles de PayPal al cliente.

---

## 🗺️ MAPA DE ENDPOINTS (ARQUITECTURA)

```
GET  api/get_expediciones.php       <- Catálogo de expediciones con blocked_dates
POST api/crear_orden_paypal.php     <- Fase 1 del pago (Backend -> PayPal)
POST api/confirmar_reserva.php      <- Fase 2 del pago (PayPal -> Backend -> DB)
GET  api/get_reservas.php           <- Reservas enriquecidas para el admin dashboard
POST api/login.php                  <- Auth admin: email + password -> JWT  [FASE 4]
GET  api/get_public_settings.php    <- Config pública: paypal_client_id, whatsapp  [FASE 4]
GET  api/get_settings.php           <- Todas las settings (JWT + super_admin)  [FASE 4]
POST api/update_settings.php        <- Actualizar setting + audit log (JWT + super_admin)  [FASE 4]
GET  api/list_admin_users.php       <- Listar admins (JWT + super_admin)  [FASE 5]
POST api/create_admin_user.php      <- Crear admin con rol (JWT + super_admin)  [FASE 5]
POST api/toggle_admin_user.php      <- Activar/desactivar admin (JWT + super_admin)  [FASE 5]
```

---

## 🛠️ ENDPOINTS REGISTRADOS (CONTRATOS ESTRICTOS)

---

### ENDPOINT 1: `api/get_expediciones.php` — ACTUALIZADO 2026-04-23
**Método:** `GET`
**Propósito:** Devolver el catálogo de expediciones activas con su `daily_capacity` y el array `blocked_dates` para que el `<Calendar />` deshabilite días específicos. Ya **no devuelve** `expedition_dates` ni `available_spots`.

**Payload Requerido (Front -> Back):** Ninguno.

**Validaciones del Backend:**
- Solo devuelve expediciones donde `expeditions.status = 'active'`.
- El array `blocked_dates` se obtiene con `SELECT blocked_date, reason FROM blocked_dates WHERE expedition_id = X`.

**Response Exitoso (HTTP 200):**
```json
{
  "status": "success",
  "message": "Expediciones obtenidas correctamente.",
  "data": [
    {
      "id": 1,
      "name": "Tiburón Ballena",
      "description": "Nada junto al gigante del mar en La Paz, BCS.",
      "price": "1500.00",
      "daily_capacity": 12,
      "image_url": "/assets/img/tiburon-ballena.jpg",
      "status": "active",
      "custom_fields": null,
      "blocked_dates": [
        { "date": "2026-05-15", "reason": "mantenimiento de embarcación" },
        { "date": "2026-05-20", "reason": null }
      ]
    }
  ]
}
```

> **Nota de implementación PHP:** El array `blocked_dates` puede ser vacío `[]` si no hay días bloqueados para esa expedición. El frontend maneja ambos casos.

**Response Error (HTTP 500):**
```json
{ "status": "error", "message": "No se pudo obtener el catálogo. Intenta de nuevo." }
```

---

### ENDPOINT 2: `api/crear_orden_paypal.php` — ACTUALIZADO 2026-04-23
**Método:** `POST`
**Propósito:** Validar el payload del cliente, verificar disponibilidad dinámica de cupo para la `departure_date` elegida, calcular el total en backend y crear una Orden en la API de PayPal.

> 🔒 **Fase 1 del Flujo de Pago Blindado. El precio JAMÁS viene del frontend.**
> 🔒 **`expedition_date_id` ELIMINADO — reemplazado por `departure_date` libre elegida en Calendar.**

**Payload Requerido (Front -> Back):**
```json
{
  "expedition_id": 1,
  "departure_date": "2026-05-10",
  "num_spots": 2,
  "customer_name": "Ana García López",
  "customer_email": "ana@ejemplo.com",
  "customer_phone": "6641234567"
}
```

**Validaciones del Backend (HTTP 422 si falla alguna):**
| Campo | Tipo esperado | Regla |
| :--- | :--- | :--- |
| `expedition_id` | INT > 0 | Existe en `expeditions` con `status = 'active'` |
| `departure_date` | STRING DATE | Formato `YYYY-MM-DD`, `>= CURDATE()`, NO en `blocked_dates` de esa expedición |
| `num_spots` | INT 1–20 | `(bookings activos en esa fecha) + num_spots <= daily_capacity` |
| `customer_name` | STRING | `trim()`, no vacío, min 3 chars |
| `customer_email` | STRING | `FILTER_VALIDATE_EMAIL`, lowercase |
| `customer_phone` | STRING | `trim()`, min 7 dígitos numéricos |

**Lógica Interna del Backend (orden de ejecución):**
1. Sanitizar y validar todos los campos (422 si falla).
2. Verificar que `departure_date` no esté en `blocked_dates` para esa expedición (422 si bloqueada).
3. **Anti-doble reserva:** `SELECT COUNT(*) FROM bookings WHERE expedition_id=X AND departure_date=Y AND payment_status != 'failed' FOR UPDATE`. Verificar `count + num_spots <= daily_capacity` (422 si sin cupo).
4. Consultar `price` de `expeditions`. Calcular `total_amount = price × num_spots`.
5. Insertar en `customers` (o reutilizar por email). Obtener `customer_id`.
6. Insertar en `bookings` con `payment_status = 'pending'` y `departure_date` recibida.
7. Llamar a la API de PayPal para crear la Orden con `total_amount`.
8. Actualizar `bookings.paypal_order_id` con el ID devuelto por PayPal.
9. Insertar en `paypal_transactions` con `fase = 'orden_creada'`.
10. Devolver `paypal_order_id` al frontend.

**Response Exitoso (HTTP 200):**
```json
{
  "status": "success",
  "message": "Orden de pago creada. Procede a la aprobación.",
  "data": {
    "orden_paypal": "3TY12345AB678901C"
  }
}
```

**Response Error Validación (HTTP 422):**
```json
{
  "status": "error",
  "message": "El formulario contiene errores.",
  "errors": [
    "cliente_email: Formato de correo inválido.",
    "num_lugares: No hay suficiente cupo disponible para esa fecha."
  ]
}
```

**Response Error Servidor (HTTP 500):**
```json
{ "status": "error", "message": "No se pudo crear la orden de pago. Intenta de nuevo." }
```

---

### ENDPOINT 3: `api/confirmar_reserva.php`
**Método:** `POST`
**Propósito:** Recibir el `orden_paypal` aprobado por el usuario en PayPal, ejecutar la Captura del pago contra la API de PayPal y, SOLO si es exitosa, marcar la reserva como `completado` y decrementar `cupo_disponible` en DB. Fase 2 y final del flujo.

> 🔒 **Fase 2. El decremento de cupo y el cambio de estatus son ATÓMICOS. Si PayPal falla, la DB NO se modifica.**

**Payload Requerido (Front -> Back):**
```json
{
  "orden_paypal": "3TY12345AB678901C"
}
```

**Validaciones del Backend (HTTP 422 si falla alguna):**
| Campo | Tipo esperado | Regla |
| :--- | :--- | :--- |
| `orden_paypal` | STRING | No vacío, existe en `reservas` con `estatus_pago = 'pendiente'` |

**Lógica Interna del Backend (orden de ejecución):**
1. Validar que `orden_paypal` es un string no vacío. HTTP 422 si falla.
2. Buscar fila en `reservas` por `orden_paypal`. HTTP 422 si no existe o no está `pendiente` (idempotencia).
3. Llamar a la API de PayPal: `POST /v2/checkout/orders/{orden_paypal}/capture`.
4. **Si la captura PayPal FALLA:**
   - Actualizar `reservas.estatus_pago = 'fallido'`.
   - Insertar en `transacciones_paypal` con `fase = 'captura_fallida'` y el JSON de error.
   - Escribir en `log_errores` con `nivel = 'CRITICAL'`.
   - Devolver HTTP 500 con mensaje genérico amigable.
5. **Si la captura PayPal TIENE ÉXITO:**
   - Iniciar transacción DB (`BEGIN TRANSACTION`).
   - `UPDATE reservas SET estatus_pago = 'completado', transaccion_paypal = {capture_id}`.
   - `UPDATE fechas_expedicion SET cupo_disponible = cupo_disponible - num_lugares`.
   - Insertar en `transacciones_paypal` con `fase = 'captura_exitosa'` y JSON de respuesta.
   - `COMMIT`. Si falla el COMMIT: `ROLLBACK` y loguear como `CRITICAL`.
   - Devolver HTTP 200 con datos de confirmación.

**Response Exitoso (HTTP 200):**
```json
{
  "status": "success",
  "message": "¡Reserva confirmada! Revisa tu correo.",
  "data": {
    "transaccion_paypal": "5H782641GX123456A",
    "fecha_reserva": "2026-04-15 14:30:00",
    "cliente_nombre": "Ana García López",
    "expedicion": "Tiburón Ballena",
    "fecha_salida": "2026-05-10",
    "num_lugares": 2,
    "total_pagado": "3000.00"
  }
}
```

**Response Error Validación (HTTP 422):**
```json
{
  "status": "error",
  "message": "Esta orden de pago no es válida o ya fue procesada.",
  "errors": [ "orden_paypal: No encontrada o en estatus incorrecto." ]
}
```

**Response Error de Pago (HTTP 500):**
```json
{ "status": "error", "message": "El pago no pudo ser completado. No se realizó ningún cargo. Intenta de nuevo." }
```

---

---

### ENDPOINT 4: `api/login.php` — FASE 4 (2026-04-24)
**Método:** `POST`
**Propósito:** Autenticar un administrador con email + contraseña. Devuelve JWT HS256 con TTL 8 h.
**Auth requerida:** No.

**Payload Requerido (Front -> Back):**
```json
{ "email": "admin@pegasoexpediciones.com", "password": "miContraseñaSegura" }
```

**Validaciones (HTTP 422 si falla):**
| Campo | Regla |
| :--- | :--- |
| `email` | `FILTER_VALIDATE_EMAIL`, lowercase |
| `password` | no vacío |

**Lógica:**
1. Validar campos (422 si falla).
2. Buscar en `admin_users` por email con `active = 1`.
3. Ejecutar `password_verify()` con hash dummy si el usuario no existe (timing-safe).
4. Si falla: HTTP 401 con mensaje genérico (no revelar si el email existe).
5. Si éxito: firmar JWT HS256 con `JWT_SECRET` del `.env`, TTL 8 h. Actualizar `last_login_at`.

**Response Exitoso (HTTP 200):**
```json
{
  "status": "success",
  "message": "¡Bienvenido, Daniel!",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiJ9...",
    "admin_name": "Daniel García",
    "admin_email": "admin@pegasoexpediciones.com",
    "role": "admin",
    "expires_in": 28800
  }
}
```

**Response Error (HTTP 401):**
```json
{ "status": "error", "message": "Credenciales incorrectas." }
```

---

### ENDPOINT 5: `api/get_public_settings.php` — FASE 4 (2026-04-24)
**Método:** `GET`
**Propósito:** Configuración pública del sistema para el booking widget. Sin auth. NUNCA devuelve el `paypal_client_secret`.
**Auth requerida:** No.

**Payload Requerido:** Ninguno.

**Response Exitoso (HTTP 200):**
```json
{
  "status": "success",
  "message": "Configuración pública obtenida.",
  "data": {
    "paypal_client_id": "AZm5Bv63l_CgRYhMl96i1gWEwqezz54...",
    "paypal_mode": "sandbox",
    "whatsapp_phone": "521XXXXXXXXXX",
    "sales_paused": "false"
  }
}
```

---

### ENDPOINT 6: `api/get_settings.php` — ACTUALIZADO FASE 6 (2026-04-25)
**Método:** `GET`
**Propósito:** Devuelve todas las claves de `system_settings`. Los de `is_secret = 1` se enmascaran (muestra `••••••••` + últimos 4 chars).
**Auth requerida:** JWT Bearer Token + `role = super_admin`.

> **Implementación:** Usa alias SQL (`setting_key AS key`, `setting_value AS value`, `is_secret AS is_sensitive`) para que el JSON mantenga el contrato con el frontend sin cambios.

**Headers requeridos:**
```
Authorization: Bearer <token>
```

**Response Exitoso (HTTP 200):**
```json
{
  "status": "success",
  "message": "Configuración obtenida.",
  "data": [
    { "key": "paypal_mode",              "value": "sandbox",         "description": "Entorno PayPal activo",           "is_sensitive": 0, "updated_at": "2026-04-25 10:00:00" },
    { "key": "paypal_client_id_sandbox", "value": "AZm5Bv63...",     "description": "Client ID PayPal Sandbox",        "is_sensitive": 0, "updated_at": "2026-04-25 10:00:00" },
    { "key": "paypal_secret_sandbox",    "value": "••••••••Vm7m",    "description": "Client Secret PayPal Sandbox",    "is_sensitive": 1, "updated_at": "2026-04-25 10:00:00" },
    { "key": "paypal_client_id_live",    "value": "",                 "description": "Client ID PayPal Live",           "is_sensitive": 0, "updated_at": null },
    { "key": "paypal_secret_live",       "value": "",                 "description": "Client Secret PayPal Live",       "is_sensitive": 1, "updated_at": null },
    { "key": "whatsapp_contact",         "value": "521XXXXXXXXXX",   "description": "WhatsApp de contacto",            "is_sensitive": 0, "updated_at": null },
    { "key": "urgent_booking_msg",       "value": "Sin disponibilidad…", "description": "Mensaje cuando pausado",      "is_sensitive": 0, "updated_at": null },
    { "key": "admin_notification_emails","value": "admin@x.com",     "description": "Emails CSV de alertas admin",     "is_sensitive": 0, "updated_at": null },
    { "key": "sales_paused",             "value": "false",           "description": "Pausa global de ventas",          "is_sensitive": 0, "updated_at": null }
  ]
}
```

**Response Error (HTTP 401):**
```json
{ "status": "error", "message": "Autenticación requerida." }
```

---

### ENDPOINT 7: `api/update_settings.php` — ACTUALIZADO FASE 6 (2026-04-25)
**Método:** `POST`
**Propósito:** Actualiza el valor de una clave en `system_settings` e inserta registro en `system_settings_audit`.
**Auth requerida:** JWT Bearer Token + `role = super_admin`.

**Payload Requerido (Front -> Back):**
```json
{ "key": "whatsapp_contact", "value": "521YYYYYYYYYY" }
```

**Validaciones (HTTP 422 si falla):**
| Campo | Regla |
| :--- | :--- |
| `key` | No vacío. Debe existir como `setting_key` en `system_settings`. |
| `value` | String (puede ser vacío para limpiar). |

**Lógica (columnas reales en BD):**
1. Validar JWT + rol (401/403 si falla).
2. Validar `key` no vacía (422).
3. `SELECT setting_key, setting_value FROM system_settings WHERE setting_key = ?` (422 si no existe).
4. Transacción: `UPDATE system_settings SET setting_value = ?, updated_at = NOW(), updated_by = ? WHERE setting_key = ?`
5. `INSERT INTO system_settings_audit (setting_key, old_value, new_value, changed_by, changed_at)`
6. Si algo falla: ROLLBACK.

**Response Exitoso (HTTP 200):**
```json
{
  "status": "success",
  "message": "Configuración 'whatsapp_contact' actualizada correctamente.",
  "data": { "key": "whatsapp_contact" }
}
```

**Response Error (HTTP 422):**
```json
{
  "status": "error",
  "message": "Clave de configuración no reconocida.",
  "errors": [ "key: 'clave_inventada' no existe en system_settings." ]
}
```

---

### ENDPOINT 8: `api/list_admin_users.php` — FASE 5 (2026-04-24)
**Método:** `GET` | **Auth:** JWT + `role = super_admin`

**Response Exitoso (HTTP 200):**
```json
{
  "status": "success", "message": "Usuarios obtenidos.",
  "data": [
    { "id": 1, "name": "Daniel García", "email": "admin@pegaso.com", "role": "super_admin",
      "active": 1, "last_login_at": "2026-04-24 10:00:00", "created_at": "2026-04-24 09:00:00" }
  ]
}
```
> `password_hash` NUNCA se incluye en la respuesta.

---

### ENDPOINT 9: `api/create_admin_user.php` — FASE 5 (2026-04-24)
**Método:** `POST` | **Auth:** JWT + `role = super_admin`

**Payload:**
```json
{ "name": "María López", "email": "maria@pegaso.com", "password": "segura1234", "role": "operaciones" }
```
**Validaciones (422):** name ≥ 3 chars · email válido · password ≥ 8 chars · role ∈ {super_admin, operaciones, ventas} · email único.

**Response Exitoso (HTTP 200):**
```json
{ "status": "success", "message": "Usuario 'María López' creado con éxito.", "data": { "id": 2, "name": "María López", "email": "maria@pegaso.com", "role": "operaciones", "active": 1 } }
```

---

### ENDPOINT 10: `api/toggle_admin_user.php` — FASE 5 (2026-04-24)
**Método:** `POST` | **Auth:** JWT + `role = super_admin`

**Payload:** `{ "user_id": 2 }`

**Validaciones (422):** user_id ≥ 1 · no puede ser el mismo ID del admin autenticado (auto-desactivación bloqueada).

**Response Exitoso (HTTP 200):**
```json
{ "status": "success", "message": "Usuario 'María López' desactivado correctamente.", "data": { "id": 2, "active": 0 } }
```

---

## 🌐 GESTIÓN DE ENTORNOS — FASE 6 (2026-04-25)

### Variables de entorno del Backend (PHP — `.env` raíz)

| Variable | Dev | Prod | Propósito |
| :--- | :--- | :--- | :--- |
| `FRONTEND_URL` | *(vacío)* | `https://pegasoexpediciones.com` | Añadida dinámicamente a la whitelist CORS en `cors.php`. Si está vacía, solo localhost es permitido. |
| `JWT_SECRET` | secreto local | secreto prod (≥ 32 chars) | Firma HS256 de los JWT. Nunca igual en dev y prod. |
| `PAYPAL_MODE` | `sandbox` | `live` | Fallback si `paypal_mode` no está en `system_settings`. |
| `PAYPAL_CLIENT_ID` | ID sandbox | ID live | Fallback si `paypal_client_id_{mode}` no está en `system_settings`. |
| `PAYPAL_CLIENT_SECRET` | Secret sandbox | Secret live | Fallback si `paypal_secret_{mode}` no está en `system_settings`. |

### Variables de entorno del Frontend (Next.js)

| Variable | Dev (`.env.local`) | Prod (`.env.production` + GitHub Actions) | Propósito |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | `http://localhost/PegasoExpedicionesDev/api` | `https://pegasoexpediciones.com/api` | URL base de todos los `fetch` al backend. **Horneada en el bundle estático en tiempo de build.** |
| `NEXT_PUBLIC_PAYPAL_MODE` | `sandbox` | `live` | Modo PayPal para el SDK del frontend. |
| `NEXT_PUBLIC_CONTACT_PHONE` | `521XXXXXXXXXX` | `521XXXXXXXXXX` | Número de WhatsApp de contacto (fallback si BD no responde). |

> **Regla crítica — "Localhost Leak":** `NEXT_PUBLIC_*` se hornean (bake) en el HTML/JS estático durante `npm run build`. Si el build se ejecuta sin inyectar las variables de producción, el bundle quedará con `http://localhost/...` hardcodeado para siempre. **Solución:** GitHub Actions inyecta explícitamente `NEXT_PUBLIC_API_URL=https://pegasoexpediciones.com/api` en el step de build (ver `main-deploy.yml`).

### Arquitectura CORS — `api/cors.php`

```
Toda petición cross-origin a cualquier endpoint PHP:
  └─ require_once 'cors.php'   ← primera línea de cada endpoint
       ├─ Lee FRONTEND_URL del .env
       ├─ Whitelist: localhost (dev) + FRONTEND_URL (prod)
       ├─ Si origin NO está en whitelist → NO emite Allow-Origin → navegador bloquea
       ├─ OPTIONS preflight → 204 No Content (sin tocar DB)
       └─ Allow-Headers incluye Authorization (requerido para JWT)
```

> **Anti-patrón eliminado:** Los 10 endpoints PHP tenían su propia copia del bloque CORS con localhost hardcodeado. Ahora todos delegan en `cors.php` — un único punto de cambio para añadir dominios.

### Despliegue en subdirectorio `/portal`

```
Servidor de producción:
  public_html/
  ├─ (sitio web existente del cliente — intacto)
  ├─ api/          ← PHP backend
  └─ portal/       ← Next.js compilado (basePath=/portal)
       └─ .htaccess  ← copiado de booking-engine/public/ por Next.js build
```

- `basePath: '/portal'` y `assetPrefix: '/portal'` en `next.config.mjs`
- `booking-engine/public/.htaccess` se copia a `out/` automáticamente
- GitHub Actions: `mv booking-engine/out ./portal` antes del FTP sync

---

## 🧠 LÓGICA DE NEGOCIO (REGLAS DE PIEDRA)

1. **Precio Canónico (Regla de Oro):** `total_pagado` se calcula EXCLUSIVAMENTE en `crear_orden_paypal.php` como `precio × num_lugares`, leyendo `precio` de `expediciones` en DB. El frontend NUNCA envía ni sugiere el precio.

2. **Flujo de Dos Fases (Inmutable):** El orden es siempre: `crear_orden_paypal.php` → Usuario aprueba en PayPal UI → `confirmar_reserva.php`. No existe atajo o endpoint alternativo para registrar una reserva completada.

3. **Atomicidad de Cupo:** En `confirmar_reserva.php`, el `UPDATE cupo_disponible` y el `UPDATE estatus_pago = 'completado'` ocurren dentro de la MISMA transacción DB. Si cualquier operación falla: `ROLLBACK` completo.

4. **Anti-Doble Reserva (Race Condition Guard):** En `crear_orden_paypal.php`, la consulta de disponibilidad usa `SELECT ... FOR UPDATE` para bloquear la fila durante la verificación, previniendo que dos usuarios simultáneos reserven el último lugar.

5. **Validación HTTP 422 Estricta:** Antes de ejecutar CUALQUIER lógica de negocio o consulta a PayPal, el backend valida el 100% de los campos del payload. Un campo inválido detiene el proceso con HTTP 422.

6. **Blindaje Técnico Universal:** Todo string de entrada pasa por `trim()`. Enteros con `FILTER_VALIDATE_INT`. Emails con `FILTER_VALIDATE_EMAIL`. Todos los queries usan Prepared Statements PDO. Ningún dato del usuario se interpola directamente en SQL.

7. **Circuit Breaker PayPal:** Si la llamada HTTP a la API de PayPal genera una excepción (timeout, 4xx, 5xx), el sistema la captura con `try/catch`, loguea el error completo en `log_errores` y devuelve al frontend un mensaje amigable genérico. NUNCA expone el error técnico de PayPal.

8. **Idempotencia de Confirmación:** Si `confirmar_reserva.php` recibe un `orden_paypal` cuyo `estatus_pago` ya es `'completado'`, devuelve HTTP 422 sin reintentar la captura. Previene cobros dobles si el usuario recarga la página de confirmación.
