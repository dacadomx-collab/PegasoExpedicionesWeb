// ============================================================
// CAPA DE SERVICIO API — Pegaso Expediciones
// Regla: NEXT_PUBLIC_API_URL se lee de .env.local (nunca hardcodeado).
// Fallback apunta a XAMPP local para desarrollo sin .env.
// Todo fetch() tiene try/catch en el hook consumidor.
// Contratos: 03_CONTRATOS_API_Y_LOGICA.md
// ============================================================

import type { ApiResponse, Expedition, BookingAdminView, CreateOrderPayload } from "./types"

// La variable de entorno debe apuntar a la carpeta /api del backend PHP.
// Ejemplo .env.local → NEXT_PUBLIC_API_URL=http://localhost/PegasoExpedicionesDev/api
const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost/PegasoExpedicionesDev/api"

async function apiFetch<T>(path: string, init?: RequestInit): Promise<ApiResponse<T>> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    cache: "no-store",
    ...init,
  })

  // Intentar parsear el JSON siempre, incluso en 4xx/5xx.
  // El backend SIEMPRE responde JSON (contrato garantizado por el try/catch PHP).
  let data: ApiResponse<T>
  try {
    data = (await res.json()) as ApiResponse<T>
  } catch {
    // Si JSON falla (Apache sirvió HTML sin CORS), lanzar error HTTP genérico.
    throw new Error(`HTTP ${res.status}: ${res.statusText}`)
  }

  // En error, usar el mensaje del backend si está disponible.
  if (!res.ok) {
    const msg = data.errors?.join(" / ") ?? data.message ?? `HTTP ${res.status}`
    throw new Error(msg)
  }

  return data
}

// ── GET /get_expediciones.php ─────────────────────────────────
// Contrato: 03_CONTRATOS_API_Y_LOGICA.md § ENDPOINT 1
// ⚠️ NOTA CODEX: El contrato (2026-04-15) usa nombres en español.
//    El schema DB migró a inglés el 2026-04-17. El Arquitecto debe
//    actualizar el contrato y el PHP para devolver nombres en inglés.
export async function fetchExpeditions(): Promise<Expedition[]> {
  const res = await apiFetch<Expedition[]>("/get_expediciones.php")
  if (res.status !== "success" || !res.data) {
    throw new Error(res.message ?? "No se pudo obtener el catálogo de expediciones.")
  }
  return res.data
}

// ── GET /get_reservas.php ─────────────────────────────────────
// ⚠️ PUNTO CIEGO (DT-02): Endpoint NO definido en el Codex.
//    El Arquitecto debe registrar GET /api/get_reservas.php en
//    03_CONTRATOS_API_Y_LOGICA.md antes de implementar el PHP.
export async function fetchBookings(): Promise<BookingAdminView[]> {
  const res = await apiFetch<BookingAdminView[]>("/get_reservas.php")
  if (res.status !== "success" || !res.data) {
    throw new Error(res.message ?? "No se pudo obtener las reservas.")
  }
  return res.data
}

// ── POST /crear_orden_paypal.php ──────────────────────────────
// Contrato: 03_CONTRATOS_API_Y_LOGICA.md § ENDPOINT 2 (actualizado 2026-04-23)
// Regla de Oro: El precio JAMÁS viaja desde el frontend.
// expedition_date_id eliminado — ahora se envía departure_date libre.
// Retorna { orden_paypal: string } para iniciar el flujo PayPal.
export async function createPaypalOrder(
  payload: CreateOrderPayload
): Promise<{ paypal_order_id: string }> {
  const res = await apiFetch<{ paypal_order_id: string }>("/crear_orden_paypal.php", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  if (res.status !== "success" || !res.data) {
    const validationErrors = res.errors?.join(" / ") ?? res.message
    throw new Error(validationErrors)
  }
  return res.data
}

// ── POST /confirmar_reserva.php ───────────────────────────────
// Contrato: 03_CONTRATOS_API_Y_LOGICA.md § ENDPOINT 3
export async function confirmBooking(
  ordenPaypal: string
): Promise<ApiResponse["data"]> {
  const res = await apiFetch("/confirmar_reserva.php", {
    method: "POST",
    body: JSON.stringify({ orden_paypal: ordenPaypal }),
  })
  if (res.status !== "success") {
    throw new Error(res.message)
  }
  return res.data
}
