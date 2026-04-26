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

// ── Confirmación de reserva (Back → Front tras captura PayPal) ──

export interface BookingConfirmation {
  paypal_transaction_id: string
  created_at: string       // "YYYY-MM-DD HH:mm:ss"
  customer_name: string
  expedition_name: string
  departure_date: string   // "YYYY-MM-DD"
  num_spots: number
  total_amount: string     // DECIMAL como string
}

// ── FASE 5: RBAC (2026-04-24) ────────────────────────────────
// Roles canónicos — deben coincidir con los valores en admin_users.role (DB)
export type AdminRole = "super_admin" | "operaciones" | "ventas"

export interface AdminUser {
  id:            number
  name:          string
  email:         string
  role:          AdminRole
  active:        number       // 0 | 1
  last_login_at: string | null
  created_at:    string
}

export interface CreateAdminUserPayload {
  name:     string
  email:    string
  password: string
  role:     AdminRole
}

// ── FASE 4: Auth & Settings (2026-04-24) ─────────────────────

export interface LoginPayload {
  email:    string
  password: string
}

export interface LoginResponse {
  token:       string
  admin_name:  string
  admin_email: string
  role:        string
  expires_in:  number
}

export interface SystemSetting {
  key:          string
  value:        string
  description:  string | null
  is_sensitive: number  // 0 | 1
  updated_at:   string | null
}

export interface PublicSettings {
  paypal_client_id: string
  paypal_mode:      "sandbox" | "live"
  whatsapp_phone:   string
  sales_paused:     string
}

// ── FASE 6: Gestión de Expediciones (2026-04-25) ─────────────

export interface CustomFieldEntry {
  key:   string
  value: string
}

export interface SaveExpeditionPayload {
  id?:            number
  name:           string
  description:    string
  price:          string
  daily_capacity: number
  image_url:      string
  status:         "active" | "inactive"
  custom_fields:  CustomFieldEntry[]
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
