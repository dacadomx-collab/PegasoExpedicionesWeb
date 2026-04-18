# 🧬 SYSTEM CODEX & REGISTRY — Pegaso Expediciones
**v2 | Sistema de Reservas y Pagos con PayPal Checkout**
**Proyecto:** Turismo de Aventura (Tiburón Ballena, Buceo, etc.)
**Última actualización:** 2026-04-17 | **Modo:** Génesis Élite v2

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

```sql
-- ============================================================
-- PROYECTO: PEGASO EXPEDICIONES - Sistema de Reservas v2
-- CHARSET: utf8mb4 | ENGINE: InnoDB
-- ============================================================

CREATE TABLE `expediciones` (
    `id`           INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    `nombre`       VARCHAR(255)    NOT NULL,
    `descripcion`  TEXT,
    `precio`       DECIMAL(10,2)   NOT NULL,
    `cupo_maximo`  INT UNSIGNED    NOT NULL,
    `imagen_url`   VARCHAR(500),
    `activo`       TINYINT(1)      NOT NULL DEFAULT 1,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE `fechas_expedicion` (
    `id`               INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `expedicion_id`    INT UNSIGNED NOT NULL,
    `fecha_salida`     DATE         NOT NULL,
    `cupo_disponible`  INT UNSIGNED NOT NULL,
    `activo`           TINYINT(1)   NOT NULL DEFAULT 1,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_fechas_expedicion`
        FOREIGN KEY (`expedicion_id`) REFERENCES `expediciones`(`id`) ON DELETE CASCADE,
    INDEX `idx_expedicion_activo` (`expedicion_id`, `activo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE `reservas` (
    `id`                   INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    `expedicion_id`        INT UNSIGNED  NOT NULL,
    `fecha_expedicion_id`  INT UNSIGNED  NOT NULL,
    `cliente_nombre`       VARCHAR(255)  NOT NULL,
    `cliente_email`        VARCHAR(255)  NOT NULL,
    `cliente_telefono`     VARCHAR(20)   NOT NULL,
    `num_lugares`          TINYINT UNSIGNED NOT NULL DEFAULT 1,
    `total_pagado`         DECIMAL(10,2) NOT NULL,
    `estatus_pago`         ENUM('pendiente','completado','fallido','reembolsado')
                           NOT NULL DEFAULT 'pendiente',
    `orden_paypal`         VARCHAR(100)  NOT NULL UNIQUE,
    `transaccion_paypal`   VARCHAR(100)  UNIQUE,
    `fecha_reserva`        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `ip_cliente`           VARCHAR(45),
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_reservas_expedicion`
        FOREIGN KEY (`expedicion_id`) REFERENCES `expediciones`(`id`),
    CONSTRAINT `fk_reservas_fecha`
        FOREIGN KEY (`fecha_expedicion_id`) REFERENCES `fechas_expedicion`(`id`),
    INDEX `idx_orden_paypal` (`orden_paypal`),
    INDEX `idx_estatus_pago` (`estatus_pago`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE `transacciones_paypal` (
    `id`             INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `reserva_id`     INT UNSIGNED,
    `orden_paypal`   VARCHAR(100) NOT NULL,
    `capture_id`     VARCHAR(100),
    `fase`           ENUM('orden_creada','captura_exitosa','captura_fallida') NOT NULL,
    `respuesta_json` JSON,
    `fecha_evento`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_txn_reserva`
        FOREIGN KEY (`reserva_id`) REFERENCES `reservas`(`id`) ON DELETE SET NULL,
    INDEX `idx_orden_txn` (`orden_paypal`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE `log_errores` (
    `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `endpoint`      VARCHAR(100),
    `nivel`         ENUM('WARNING','ERROR','CRITICAL') NOT NULL DEFAULT 'ERROR',
    `mensaje`       TEXT NOT NULL,
    `contexto_json` JSON,
    `ip_cliente`    VARCHAR(45),
    `fecha_evento`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 🧠 REGISTRO SEMÁNTICO (VOCABULARIO CONTROLADO)

- ✅ **Términos Permitidos:**
  `reserva`, `expedicion`, `fecha_expedicion`, `estatus_pago`, `cupo_disponible`, `orden_paypal`, `transaccion_paypal`, `capture_id`, `fecha_salida`, `cliente_nombre`, `cliente_email`, `cliente_telefono`, `num_lugares`, `total_pagado`, `log_errores`, `transacciones_paypal`

- ❌ **Términos Prohibidos (y su reemplazo correcto):**
  | Prohibido | Correcto |
  | :--- | :--- |
  | `booking` | `reserva` |
  | `trip` / `tour` | `expedicion` |
  | `status` | `estatus_pago` |
  | `available` | `cupo_disponible` |
  | `transaction` (variable) | `transaccion_paypal` |
  | `slot` | `num_lugares` |
  | `amount` | `total_pagado` |
  | `user` / `usuario` | `cliente_nombre`, `cliente_email` |
  | `payment_id` | `orden_paypal` o `transaccion_paypal` según la fase |

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
