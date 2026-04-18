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
> ✅ **2026-04-17:** Schema migrado a inglés — Escenario A confirmado por humano. Tablas físicas en servidor en inglés.

```sql
-- ============================================================
-- PROYECTO: PEGASO EXPEDICIONES - Sistema de Reservas v2
-- CHARSET: utf8mb4 | ENGINE: InnoDB
-- SCHEMA: INGLÉS (confirmado 2026-04-17)
-- ============================================================

CREATE TABLE `expeditions` (
    `id`            INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    `name`          VARCHAR(255)    NOT NULL,
    `description`   TEXT,
    `price`         DECIMAL(10,2)   NOT NULL,
    `max_capacity`  INT UNSIGNED    NOT NULL,
    `image_url`     VARCHAR(500),
    `status`        ENUM('active','inactive') NOT NULL DEFAULT 'active',
    `custom_fields` JSON,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE `expedition_dates` (
    `id`               INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `expedition_id`    INT UNSIGNED NOT NULL,
    `departure_date`   DATE         NOT NULL,
    `available_spots`  INT UNSIGNED NOT NULL,
    `status`           ENUM('active','inactive') NOT NULL DEFAULT 'active',
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_expedition_dates_expedition`
        FOREIGN KEY (`expedition_id`) REFERENCES `expeditions`(`id`) ON DELETE CASCADE,
    INDEX `idx_expedition_status` (`expedition_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE `customers` (
    `id`    INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `name`  VARCHAR(255) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `phone` VARCHAR(20)  NOT NULL,
    PRIMARY KEY (`id`),
    INDEX `idx_customer_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE `bookings` (
    `id`                     INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    `expedition_id`          INT UNSIGNED  NOT NULL,
    `expedition_date_id`     INT UNSIGNED  NOT NULL,
    `customer_id`            INT UNSIGNED  NOT NULL,
    `num_spots`              TINYINT UNSIGNED NOT NULL DEFAULT 1,
    `total_amount`           DECIMAL(10,2) NOT NULL,
    `payment_status`         ENUM('pending','completed','failed','refunded')
                             NOT NULL DEFAULT 'pending',
    `paypal_order_id`        VARCHAR(100)  NOT NULL UNIQUE,
    `paypal_transaction_id`  VARCHAR(100)  UNIQUE,
    `created_at`             DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `client_ip`              VARCHAR(45),
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_bookings_expedition`
        FOREIGN KEY (`expedition_id`) REFERENCES `expeditions`(`id`),
    CONSTRAINT `fk_bookings_date`
        FOREIGN KEY (`expedition_date_id`) REFERENCES `expedition_dates`(`id`),
    CONSTRAINT `fk_bookings_customer`
        FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`),
    INDEX `idx_paypal_order` (`paypal_order_id`),
    INDEX `idx_payment_status` (`payment_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE `paypal_transactions` (
    `id`             INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `booking_id`     INT UNSIGNED,
    `paypal_order_id` VARCHAR(100) NOT NULL,
    `capture_id`     VARCHAR(100),
    `phase`          ENUM('order_created','capture_success','capture_failed') NOT NULL,
    `response_json`  JSON,
    `created_at`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_txn_booking`
        FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE SET NULL,
    INDEX `idx_order_txn` (`paypal_order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE `error_log` (
    `id`           INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `endpoint`     VARCHAR(100),
    `level`        ENUM('WARNING','ERROR','CRITICAL') NOT NULL DEFAULT 'ERROR',
    `message`      TEXT NOT NULL,
    `context_json` JSON,
    `client_ip`    VARCHAR(45),
    `created_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

> ⚠️ **NOTA DEL AGENTE EJECUTOR (2026-04-17):** Las columnas de `bookings`, `customers`, `expedition_dates` y `paypal_transactions` son inferencias del Agente basadas en el schema anterior. El Arquitecto debe confirmar o corregir los nombres exactos de columnas con `DESCRIBE tablename` en producción y actualizar este Códex.

---

## 🧠 REGISTRO SEMÁNTICO (VOCABULARIO CONTROLADO)

- ✅ **Términos Permitidos (schema inglés — vigente desde 2026-04-17):**
  `booking`, `expedition`, `expedition_date`, `payment_status`, `available_spots`, `paypal_order_id`, `paypal_transaction_id`, `capture_id`, `departure_date`, `name`, `email`, `phone`, `num_spots`, `total_amount`, `error_log`, `paypal_transactions`, `custom_fields`, `customer`

- ❌ **Términos Prohibidos (español — schema anterior deprecado):**
  | Prohibido (deprecado) | Correcto (vigente) |
  | :--- | :--- |
  | `reserva` / `reservas` | `booking` / `bookings` |
  | `expedicion` / `expediciones` | `expedition` / `expeditions` |
  | `fecha_expedicion` | `expedition_date` / `expedition_dates` |
  | `estatus_pago` | `payment_status` |
  | `cupo_disponible` | `available_spots` |
  | `orden_paypal` | `paypal_order_id` |
  | `transaccion_paypal` | `paypal_transaction_id` |
  | `fecha_salida` | `departure_date` |
  | `cliente_nombre` / `cliente_email` / `cliente_telefono` | `customers.name` / `customers.email` / `customers.phone` |
  | `num_lugares` | `num_spots` |
  | `total_pagado` | `total_amount` |
  | `log_errores` | `error_log` |
  | `transacciones_paypal` | `paypal_transactions` |
  | `activo` (TINYINT) | `status` ENUM('active','inactive') |

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
| `BookingWidget` | `components/booking-widget.tsx` | Client Component | `tours[]`, `date`, `adults`, `children` | ⚠️ Datos hardcoded |
| `AdminDashboard` | `components/admin-dashboard.tsx` | Client Component | `Reservation[]`, `ReservationStatus` | ⚠️ Datos hardcoded |
| `ThemeProvider` | `components/theme-provider.tsx` | Provider | `ThemeProviderProps` | ✅ OK |

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
