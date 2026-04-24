// ============================================================
// TIPOS CANÓNICOS — Pegaso Expediciones
// Fuente de verdad: 02_SYSTEM_CODEX_REGISTRY.md
// Última mutación: 2026-04-23 — Disponibilidad Dinámica
//   · ExpeditionDate eliminado (tabla expedition_dates deprecada)
//   · Expedition recibe daily_capacity + blocked_dates[]
//   · bookings ahora porta departure_date y departure_time
// ============================================================

// Wrapper estándar de respuesta PHP
export interface ApiResponse<T = unknown> {
  status: "success" | "error"
  message: string
  data?: T
  errors?: string[]
}

// ── blocked_dates ─────────────────────────────────────────────
// Tabla nueva (2026-04-23). El Arquitecto bloquea días específicos
// por expedición (sin cupo, mantenimiento, clima, etc.).

export interface BlockedDate {
  date: string        // "YYYY-MM-DD"
  reason: string | null  // motivo legible; null = sin descripción pública
}

// ── expeditions ───────────────────────────────────────────────

export interface Expedition {
  id: number
  name: string
  description: string | null
  price: string             // DECIMAL(10,2) como string desde PHP — nunca calcular precio en frontend
  daily_capacity: number    // cupo diario máximo (reemplaza max_capacity + expedition_dates.available_spots)
  image_url: string | null
  status: "active" | "inactive"
  custom_fields: Record<string, unknown> | null
  blocked_dates: BlockedDate[]  // días deshabilitados en el Calendar — entregados por get_expediciones.php
}

// ── bookings ──────────────────────────────────────────────────

export type PaymentStatus = "pending" | "completed" | "failed" | "refunded"

/**
 * Vista enriquecida de una reserva para el dashboard de admin.
 * Incluye campos JOIN de customers y expeditions.
 * ⚠️ PUNTO CIEGO: GET /api/get_reservas.php no está en 03_CONTRATOS.
 * El Arquitecto debe registrarlo antes de implementar el endpoint PHP.
 */
export interface BookingAdminView {
  id: number
  num_spots: number
  total_amount: string      // DECIMAL como string
  payment_status: PaymentStatus
  paypal_order_id: string
  paypal_transaction_id: string | null
  created_at: string        // "YYYY-MM-DD HH:mm:ss"
  departure_date: string    // "YYYY-MM-DD" — migrado desde expedition_dates
  departure_time: string | null  // "HH:MM:SS" — nullable
  // Campos JOIN
  expedition_name: string
  customer_name: string
  customer_email: string
  customer_phone: string
}

// ── Payload de crear orden (Front → Back) ─────────────────────
// Contrato: 03_CONTRATOS_API_Y_LOGICA.md § ENDPOINT 2 (actualizado 2026-04-23)
// expedition_date_id eliminado — el frontend ahora envía departure_date elegida en Calendar.

export interface CreateOrderPayload {
  expedition_id: number
  departure_date: string   // "YYYY-MM-DD" — fecha libre elegida en Calendar
  num_spots: number
  customer_name: string
  customer_email: string
  customer_phone: string
}
