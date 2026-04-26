"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Loader2, Save, Eye, EyeOff, CheckCircle,
  AlertCircle, Settings, CreditCard, MessageCircle, Bell,
} from "lucide-react"
import { fetchSettings, updateSetting } from "@/lib/api"
import type { SystemSetting } from "@/lib/types"

// ── Tipos ─────────────────────────────────────────────────────
interface SettingsPanelProps { token: string }

type FieldType = "text" | "password" | "textarea" | "select"

interface FieldMeta {
  label:    string
  desc:     string
  type?:    FieldType
  options?: string[]
}

interface EditState {
  value:  string
  saving: boolean
  saved:  boolean
  error:  string | null
}

// ── Catálogo de campos ────────────────────────────────────────
// Orden de renderizado y metadatos de cada clave de system_settings
const FIELDS: Record<string, FieldMeta> = {
  // — Sección PayPal —
  paypal_mode: {
    label: "Modo PayPal",
    desc:  "sandbox → pruebas sin cobro real  |  live → producción real",
    type:  "select",
    options: ["sandbox", "live"],
  },
  paypal_client_id_sandbox: {
    label: "Client ID — Sandbox",
    desc:  "ID público de tu aplicación PayPal en modo pruebas (no es secreto)",
  },
  paypal_secret_sandbox: {
    label: "Secret — Sandbox",
    desc:  "Clave privada de la app Sandbox — solo se usa en el backend PHP",
    type:  "password",
  },
  paypal_client_id_live: {
    label: "Client ID — Live",
    desc:  "ID público de tu aplicación PayPal en modo producción",
  },
  paypal_secret_live: {
    label: "Secret — Live",
    desc:  "Clave privada de la app Live — mantenla en secreto",
    type:  "password",
  },
  // — Sección Comunicación —
  whatsapp_contact: {
    label: "Teléfono WhatsApp",
    desc:  "Formato internacional sin '+': 521XXXXXXXXXX",
  },
  urgent_booking_msg: {
    label: "Mensaje de alerta de reservas",
    desc:  "Texto que aparece en el widget cuando las ventas están pausadas",
    type:  "textarea",
  },
  admin_notification_emails: {
    label: "Emails de notificación admin",
    desc:  "Separados por coma — recibirán alertas de nuevas reservas",
  },
  // — Sección Sistema —
  sales_paused: {
    label: "Ventas pausadas",
    desc:  "true = widget público oculto  |  false = motor activo",
    type:  "select",
    options: ["false", "true"],
  },
}

// Secciones para agrupar visualmente los campos
const SECTIONS: { title: string; icon: React.ElementType; keys: string[] }[] = [
  {
    title: "Pasarela de Pago — PayPal",
    icon:  CreditCard,
    keys:  ["paypal_mode", "paypal_client_id_sandbox", "paypal_secret_sandbox", "paypal_client_id_live", "paypal_secret_live"],
  },
  {
    title: "Comunicación",
    icon:  MessageCircle,
    keys:  ["whatsapp_contact", "urgent_booking_msg", "admin_notification_emails"],
  },
  {
    title: "Sistema",
    icon:  Bell,
    keys:  ["sales_paused"],
  },
]

// ── Componente ────────────────────────────────────────────────
export function SettingsPanel({ token }: SettingsPanelProps) {
  const [settings,   setSettings]   = useState<SystemSetting[]>([])
  const [isLoading,  setIsLoading]  = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [editStates, setEditStates] = useState<Record<string, EditState>>({})
  const [revealed,   setRevealed]   = useState<Record<string, boolean>>({})

  const loadSettings = useCallback(async () => {
    setIsLoading(true)
    setFetchError(null)
    try {
      const data = await fetchSettings(token)
      setSettings(data)
      const states: Record<string, EditState> = {}
      data.forEach((s) => {
        states[s.key] = { value: s.value, saving: false, saved: false, error: null }
      })
      // Prefill vacío para claves conocidas que aún no existen en BD
      Object.keys(FIELDS).forEach((k) => {
        if (!states[k]) states[k] = { value: "", saving: false, saved: false, error: null }
      })
      setEditStates(states)
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Error al cargar configuración.")
    } finally {
      setIsLoading(false)
    }
  }, [token])

  useEffect(() => { loadSettings() }, [loadSettings])

  function handleChange(key: string, value: string) {
    setEditStates((p) => ({ ...p, [key]: { ...p[key], value, saved: false, error: null } }))
  }

  async function handleSave(key: string) {
    const state = editStates[key]
    if (!state) return
    setEditStates((p) => ({ ...p, [key]: { ...p[key], saving: true, error: null, saved: false } }))
    try {
      await updateSetting(key, state.value, token)
      setEditStates((p) => ({ ...p, [key]: { ...p[key], saving: false, saved: true } }))
      setTimeout(() => {
        setEditStates((p) => ({ ...p, [key]: { ...p[key], saved: false } }))
      }, 3000)
    } catch (err) {
      setEditStates((p) => ({
        ...p,
        [key]: { ...p[key], saving: false, error: err instanceof Error ? err.message : "Error al guardar." },
      }))
    }
  }

  function originalValue(key: string) {
    return settings.find((s) => s.key === key)?.value ?? ""
  }

  // ── States de carga ───────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-[#f26d52]" />
        <span className="ml-2 text-sm text-[#4c4c4c]">Cargando configuración…</span>
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <AlertCircle className="h-8 w-8 text-red-500" />
        <p className="text-sm text-red-600">{fetchError}</p>
        <button onClick={loadSettings}
          className="px-4 py-2 text-sm rounded-lg border border-red-200 text-red-600 hover:bg-red-50">
          Reintentar
        </button>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto space-y-8">

      {/* Cabecera */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-[#f26d52]/10 flex items-center justify-center shrink-0">
          <Settings className="h-5 w-5 text-[#f26d52]" />
        </div>
        <div>
          <h3 className="font-serif font-bold text-[#0f0200]">Configuración del sistema</h3>
          <p className="text-xs text-[#4c4c4c]">Cambios aplicados de inmediato. Se registra auditoría por cada modificación.</p>
        </div>
      </div>

      {/* Secciones */}
      {SECTIONS.map(({ title, icon: Icon, keys }) => (
        <section key={title}>
          {/* Header de sección */}
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-200">
            <Icon className="h-4 w-4 text-[#f26d52]" />
            <h4 className="text-sm font-semibold text-[#0f0200]">{title}</h4>
          </div>

          <div className="space-y-3">
            {keys.map((key) => {
              const meta    = FIELDS[key]
              const state   = editStates[key] ?? { value: "", saving: false, saved: false, error: null }
              const isDirty = state.value !== originalValue(key)
              const existsInDb = settings.some((s) => s.key === key)
              const setting = settings.find((s) => s.key === key)
              const ftype   = meta?.type ?? "text"

              return (
                <div key={key} className={`bg-white rounded-2xl border shadow-sm p-5 ${!existsInDb ? "opacity-60 border-dashed border-amber-300" : "border-gray-100"}`}>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#0f0200]">{meta.label}</p>
                      <p className="text-xs text-[#4c4c4c] mt-0.5">{meta.desc}</p>
                      {!existsInDb && (
                        <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Clave no encontrada en BD — insértala en system_settings primero
                        </p>
                      )}
                    </div>
                    {state.saved && (
                      <div className="flex items-center gap-1 text-emerald-600 text-xs shrink-0">
                        <CheckCircle className="h-3.5 w-3.5" /> Guardado
                      </div>
                    )}
                  </div>

                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      {ftype === "select" ? (
                        <select
                          value={state.value}
                          onChange={(e) => handleChange(key, e.target.value)}
                          disabled={!existsInDb}
                          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm bg-white outline-none focus:border-[#f26d52] focus:ring-2 focus:ring-[#f26d52]/10 disabled:bg-gray-50 disabled:cursor-not-allowed"
                        >
                          {(meta.options ?? []).map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>

                      ) : ftype === "textarea" ? (
                        <textarea
                          rows={3}
                          value={state.value}
                          onChange={(e) => handleChange(key, e.target.value)}
                          disabled={!existsInDb}
                          placeholder="Escribe el mensaje de alerta…"
                          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#f26d52] focus:ring-2 focus:ring-[#f26d52]/10 resize-none disabled:bg-gray-50 disabled:cursor-not-allowed"
                        />

                      ) : (
                        <div className="relative">
                          <input
                            type={ftype === "password" && !revealed[key] ? "password" : "text"}
                            value={state.value}
                            onChange={(e) => handleChange(key, e.target.value)}
                            disabled={!existsInDb}
                            autoComplete={ftype === "password" ? "new-password" : "off"}
                            className={`w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#f26d52] focus:ring-2 focus:ring-[#f26d52]/10 disabled:bg-gray-50 disabled:cursor-not-allowed ${ftype === "password" ? "pr-10 font-mono tracking-widest" : ""}`}
                          />
                          {ftype === "password" && (
                            <button
                              type="button"
                              onClick={() => setRevealed((p) => ({ ...p, [key]: !p[key] }))}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                              aria-label={revealed[key] ? "Ocultar" : "Revelar"}
                            >
                              {revealed[key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          )}
                        </div>
                      )}

                      {state.error && (
                        <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3 shrink-0" /> {state.error}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => handleSave(key)}
                      disabled={state.saving || !isDirty || !existsInDb}
                      className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold bg-[#f26d52] text-white hover:bg-[#e05a40] disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
                    >
                      {state.saving
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Save className="h-3.5 w-3.5" />
                      }
                      <span className="hidden sm:inline">{state.saving ? "Guardando…" : "Guardar"}</span>
                    </button>
                  </div>

                  {setting?.updated_at && (
                    <p className="mt-2 text-xs text-[#4c4c4c] opacity-50">
                      Actualizado: {setting.updated_at}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      ))}

    </div>
  )
}
