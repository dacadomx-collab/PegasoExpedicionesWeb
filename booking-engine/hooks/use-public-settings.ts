"use client"

import { useState, useEffect } from "react"

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost/PegasoExpedicionesDev/api"

export interface PublicSettings {
  paypal_client_id: string
  paypal_mode:      "sandbox" | "live"
  whatsapp_phone:   string
  sales_paused:     string   // "true" | "false" — string porque viene de DB TEXT
}

interface UsePublicSettingsReturn {
  settings:  PublicSettings | null
  isLoading: boolean
  error:     string | null
}

const DEFAULTS: PublicSettings = {
  paypal_client_id: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? "",
  paypal_mode:      (process.env.NEXT_PUBLIC_PAYPAL_MODE as "sandbox" | "live") ?? "sandbox",
  whatsapp_phone:   process.env.NEXT_PUBLIC_CONTACT_PHONE ?? "",
  sales_paused:     "false",
}

export function usePublicSettings(): UsePublicSettingsReturn {
  const [settings,  setSettings]  = useState<PublicSettings | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error,     setError]     = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchSettings() {
      try {
        const res  = await fetch(`${API_BASE}/get_public_settings.php`, { cache: "no-store" })
        const json = await res.json() as { status: string; data?: Partial<PublicSettings> }

        if (!cancelled && json.status === "success" && json.data) {
          setSettings({ ...DEFAULTS, ...json.data })
        } else if (!cancelled) {
          // API respondió pero sin data — usar defaults
          setSettings(DEFAULTS)
        }
      } catch {
        if (!cancelled) {
          // Fallo de red — usar defaults para no bloquear el widget
          setSettings(DEFAULTS)
          setError("No se pudo conectar al servidor de configuración.")
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    fetchSettings()
    return () => { cancelled = true }
  }, [])

  return { settings, isLoading, error }
}
