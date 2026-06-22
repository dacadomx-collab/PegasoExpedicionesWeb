"use client"

/**
 * WelcomeCard — Tarjeta de bienvenida histórica (Fundación AXON DCD).
 *
 * Lógica:
 *   - Se monta como overlay de pantalla completa.
 *   - Al hacer clic en "Continuar", llama a setWelcomeSeen() y notifica al padre.
 *   - Si la llamada falla, permite reintentar sin bloquear al usuario.
 */

import { useState, useEffect } from "react"
import { setWelcomeSeen } from "@/lib/api"

interface WelcomeCardProps {
  partnerName: string
  token:       string
  onContinue:  () => void
}

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

function pad(n: number) { return String(n).padStart(2, "0") }

export function WelcomeCard({ partnerName, token, onContinue }: WelcomeCardProps) {
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)
  const now = useNow()

  const fecha = now.toLocaleDateString("es-MX", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  })
  const hora = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`

  async function handleContinue() {
    setSaving(true)
    setError(null)
    try {
      await setWelcomeSeen(token)
      onContinue()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido.")
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "radial-gradient(ellipse at 50% 30%, #0a0f1e 0%, #000 100%)" }}
    >
      {/* Particle grid overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg,transparent,transparent 59px,#334155 60px)," +
            "repeating-linear-gradient(90deg,transparent,transparent 59px,#334155 60px)",
        }}
      />

      <div className="relative z-10 w-full max-w-lg">
        {/* Glow ring */}
        <div
          className="absolute -inset-px rounded-2xl"
          style={{
            background: "linear-gradient(135deg, #38bdf8 0%, #818cf8 50%, #34d399 100%)",
            filter: "blur(1px)",
          }}
        />

        <div className="relative rounded-2xl overflow-hidden"
             style={{ background: "#0f172a", border: "1px solid #1e293b" }}>

          {/* Header band */}
          <div
            className="px-8 py-5 text-center"
            style={{ background: "linear-gradient(90deg, #0ea5e920 0%, #818cf820 50%, #34d39920 100%)" }}
          >
            <p className="text-xs font-mono tracking-[0.3em] text-sky-400 uppercase mb-1">
              AXON DCD · PORTAL DE PARTNERS
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              THE DEEP TECH MATRIX
            </h1>
          </div>

          {/* Body */}
          <div className="px-8 py-8 text-center space-y-6">
            {/* Status pill */}
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30
                            bg-emerald-500/10 px-4 py-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-semibold text-emerald-400 tracking-wider uppercase">
                Portal activo
              </span>
            </div>

            {/* Welcome text */}
            <div className="space-y-2">
              <p className="text-slate-400 text-sm">Bienvenida al sistema,</p>
              <p className="text-3xl font-bold text-white">{partnerName}</p>
              <p className="text-slate-400 text-sm">
                Arquitecta de Confianza Operativa
              </p>
            </div>

            {/* Divider */}
            <div className="h-px bg-gradient-to-r from-transparent via-slate-600 to-transparent" />

            {/* Timestamp of foundation */}
            <div className="space-y-1">
              <p className="text-[10px] font-mono tracking-[0.2em] text-slate-500 uppercase">
                Fecha de Fundación Histórica
              </p>
              <p className="text-base font-semibold text-sky-300 capitalize">{fecha}</p>
              <p className="text-3xl font-mono font-bold text-white tracking-widest">{hora}</p>
              <p className="text-xs text-slate-500">La Paz, Baja California Sur · México</p>
            </div>

            {/* Divider */}
            <div className="h-px bg-gradient-to-r from-transparent via-slate-600 to-transparent" />

            {/* Mission statement */}
            <p className="text-slate-400 text-sm leading-relaxed">
              Este portal es tu centro de mando para construir, escalar y proteger
              ecosistemas digitales. Cada decisión que tomes aquí queda registrada
              en la matriz operativa.
            </p>

            {/* Error message */}
            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
                {error} — Inténtalo de nuevo.
              </div>
            )}

            {/* CTA */}
            <button
              onClick={handleContinue}
              disabled={saving}
              className="w-full py-3.5 rounded-xl font-bold text-sm tracking-wider uppercase
                         transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: saving
                  ? "#1e293b"
                  : "linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)",
                color: "#fff",
                boxShadow: saving ? "none" : "0 0 24px #0ea5e940",
              }}
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 rounded-full border-2 border-white/30
                                   border-t-white animate-spin" />
                  Iniciando sesión…
                </span>
              ) : (
                "Continuar al Dashboard →"
              )}
            </button>
          </div>

          {/* Footer */}
          <div className="border-t border-slate-800 px-8 py-3 text-center">
            <p className="text-[10px] text-slate-600 font-mono tracking-wider">
              AXON DCD · GENESIS ELITE v2 · ACCESO AUTORIZADO
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
