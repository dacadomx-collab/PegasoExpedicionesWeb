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
GET  api/get_expediciones.php     <- Alimenta el formulario inicial
POST api/crear_orden_paypal.php   <- Fase 1 del pago (Backend -> PayPal)
POST api/confirmar_reserva.php    <- Fase 2 del pago (PayPal -> Backend -> DB)
```

---

## 🛠️ ENDPOINTS REGISTRADOS (CONTRATOS ESTRICTOS)

---

### ENDPOINT 1: `api/get_expediciones.php`
**Método:** `GET`
**Propósito:** Devolver el catálogo de expediciones activas con sus fechas de salida disponibles. Alimenta el paso 1 del formulario de reservas.

**Payload Requerido (Front -> Back):** Ninguno.

**Validaciones del Backend:**
- Solo devuelve expediciones donde `expediciones.activo = 1`.
- Solo devuelve fechas donde `fechas_expedicion.activo = 1` AND `cupo_disponible > 0` AND `fecha_salida >= CURDATE()`.

**Response Exitoso (HTTP 200):**
```json
{
  "status": "success",
  "message": "Expediciones obtenidas correctamente.",
  "data": [
    {
      "expedicion_id": 1,
      "nombre": "Tiburón Ballena",
      "descripcion": "Nada junto al gigante del mar en La Paz, BCS.",
      "precio": "1500.00",
      "imagen_url": "/assets/img/tiburon-ballena.jpg",
      "fechas": [
        {
          "fecha_expedicion_id": 3,
          "fecha_salida": "2026-05-10",
          "cupo_disponible": 8
        },
        {
          "fecha_expedicion_id": 7,
          "fecha_salida": "2026-05-24",
          "cupo_disponible": 12
        }
      ]
    }
  ]
}
```

**Response Error (HTTP 500):**
```json
{ "status": "error", "message": "No se pudo obtener el catálogo. Intenta de nuevo." }
```

---

### ENDPOINT 2: `api/crear_orden_paypal.php`
**Método:** `POST`
**Propósito:** Validar el payload del cliente, verificar disponibilidad de cupo, calcular el `total_pagado` en backend y crear una Orden en la API de PayPal. Devuelve el `orden_paypal` al frontend para iniciar el flujo de aprobación del usuario.

> 🔒 **Fase 1 del Flujo de Pago Blindado. El precio JAMÁS viene del frontend.**

**Payload Requerido (Front -> Back):**
```json
{
  "expedicion_id": 1,
  "fecha_expedicion_id": 3,
  "num_lugares": 2,
  "cliente_nombre": "Ana García López",
  "cliente_email": "ana@ejemplo.com",
  "cliente_telefono": "6641234567"
}
```

**Validaciones del Backend (HTTP 422 si falla alguna):**
| Campo | Tipo esperado | Regla |
| :--- | :--- | :--- |
| `expedicion_id` | INT > 0 | Existe en DB y `activo = 1` |
| `fecha_expedicion_id` | INT > 0 | Existe en DB, `activo = 1`, `fecha_salida >= CURDATE()` |
| `num_lugares` | INT 1–20 | `<= cupo_disponible` actual (consulta en tiempo real) |
| `cliente_nombre` | STRING | `trim()`, no vacío, min 3 chars |
| `cliente_email` | STRING | `FILTER_VALIDATE_EMAIL`, lowercase |
| `cliente_telefono` | STRING | `trim()`, min 7 dígitos, solo numérico |

**Lógica Interna del Backend (orden de ejecución):**
1. Sanitizar y validar todos los campos. Devolver HTTP 422 si falla.
2. Consultar `precio` de `expediciones` y `cupo_disponible` de `fechas_expedicion` (con `SELECT ... FOR UPDATE` para evitar race conditions).
3. Verificar `cupo_disponible >= num_lugares`. Devolver HTTP 422 si falla.
4. Calcular `total_pagado = precio × num_lugares`.
5. Crear fila en `reservas` con `estatus_pago = 'pendiente'` (pre-reserva atómica).
6. Llamar a la API de PayPal para crear la Orden con el `total_pagado` calculado en backend.
7. Actualizar la fila en `reservas` con el `orden_paypal` devuelto por PayPal.
8. Insertar registro en `transacciones_paypal` con `fase = 'orden_creada'`.
9. Devolver `orden_paypal` al frontend.

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

## 🧠 LÓGICA DE NEGOCIO (REGLAS DE PIEDRA)

1. **Precio Canónico (Regla de Oro):** `total_pagado` se calcula EXCLUSIVAMENTE en `crear_orden_paypal.php` como `precio × num_lugares`, leyendo `precio` de `expediciones` en DB. El frontend NUNCA envía ni sugiere el precio.

2. **Flujo de Dos Fases (Inmutable):** El orden es siempre: `crear_orden_paypal.php` → Usuario aprueba en PayPal UI → `confirmar_reserva.php`. No existe atajo o endpoint alternativo para registrar una reserva completada.

3. **Atomicidad de Cupo:** En `confirmar_reserva.php`, el `UPDATE cupo_disponible` y el `UPDATE estatus_pago = 'completado'` ocurren dentro de la MISMA transacción DB. Si cualquier operación falla: `ROLLBACK` completo.

4. **Anti-Doble Reserva (Race Condition Guard):** En `crear_orden_paypal.php`, la consulta de disponibilidad usa `SELECT ... FOR UPDATE` para bloquear la fila durante la verificación, previniendo que dos usuarios simultáneos reserven el último lugar.

5. **Validación HTTP 422 Estricta:** Antes de ejecutar CUALQUIER lógica de negocio o consulta a PayPal, el backend valida el 100% de los campos del payload. Un campo inválido detiene el proceso con HTTP 422.

6. **Blindaje Técnico Universal:** Todo string de entrada pasa por `trim()`. Enteros con `FILTER_VALIDATE_INT`. Emails con `FILTER_VALIDATE_EMAIL`. Todos los queries usan Prepared Statements PDO. Ningún dato del usuario se interpola directamente en SQL.

7. **Circuit Breaker PayPal:** Si la llamada HTTP a la API de PayPal genera una excepción (timeout, 4xx, 5xx), el sistema la captura con `try/catch`, loguea el error completo en `log_errores` y devuelve al frontend un mensaje amigable genérico. NUNCA expone el error técnico de PayPal.

8. **Idempotencia de Confirmación:** Si `confirmar_reserva.php` recibe un `orden_paypal` cuyo `estatus_pago` ya es `'completado'`, devuelve HTTP 422 sin reintentar la captura. Previene cobros dobles si el usuario recarga la página de confirmación.
