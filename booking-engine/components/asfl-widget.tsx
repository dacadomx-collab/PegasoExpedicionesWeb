"use client"

/**
 * AsflWidget — Widget de diagnóstico del sistema AXON DCD.
 *
 * Visibilidad:
 *   - SIEMPRE oculto para rol 'partner'.
 *   - Visible por defecto para 'super_admin'.
 *   - Cualquier rol puede activarlo en modo debug con Ctrl+Shift+D.
 *
 * Este componente NO se elimina del árbol; solo cambia su visibilidad.
 * Esto permite que super_admin lo inspeccione en cualquier sesión.
 */

import { useState, useEffect, useCallback } from "react"
import type { AdminRole } from "@/lib/types"

interface AsflWidgetProps {
  role:       AdminRole
  userEmail:  string
  userName:   string
  apiBase?:   string
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost/PegasoExpedicionesDev/api"

export function AsflWidget({ role, userEmail, userName, apiBase = API_BASE }: AsflWidgetProps) {
  const isPartner     = role === "partner"
  const isSuperAdmin  = role === "super_admin"

  // super_admin → visible por defecto; partner → oculto, solo debug
  const [visible,    setVisible]    = useState(isSuperAdmin && !isPartner)
  const [minimized,  setMinimized]  = useState(false)
  const [debugMode,  setDebugMode]  = useState(false)
  const [pingResult, setPingResult] = useState<string | null>(null)
  const [pinging,    setPinging]    = useState(false)

  // Keyboard shortcut: Ctrl+Shift+D — toggle visibility (cualquier rol)
  const handleKeydown = useCallback((e: KeyboardEvent) => {
    if (e.ctrlKey && e.shiftKey && e.key === "D") {
      e.preventDefault()
      setVisible(v => !v)
      setDebugMode(true)
    }
  }, [])

  useEffect(() => {
    window.addEventListener("keydown", handleKeydown)
    return () => window.removeEventListener("keydown", handleKeydown)
  }, [handleKeydown])

  async function pingApi() {
    setPinging(true)
    setPingResult(null)
    const start = performance.now()
    try {
      const res = await fetch(`${apiBase}/get_public_settings.php`, {
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      })
      const ms = Math.round(performance.now() - start)
      setPingResult(res.ok ? `✅ ${res.status} OK — ${ms}ms` : `⚠️ HTTP ${res.status} — ${ms}ms`)
    } catch (e) {
      const ms = Math.round(performance.now() - start)
      setPingResult(`❌ ${e instanceof Error ? e.message : "Error"} — ${ms}ms`)
    } finally {
      setPinging(false)
    }
  }

  // No rendered for partner unless debug shortcut was triggered
  if (!visible) return null

  const env = process.env.NODE_ENV ?? "unknown"

  return (
    <div
      className="fixed bottom-4 right-4 z-40 w-72 rounded-xl overflow-hidden shadow-2xl
                 font-mono text-xs"
      style={{ background: "#0a0f1e", border: "1px solid #1e3a5f" }}
      role="complementary"
      aria-label="ASFL System Widget"
    >
      {/* Title bar */}
      <div
        className="flex items-center justify-between px-3 py-2 cursor-pointer select-none"
        style={{ background: "#0f172a", borderBottom: "1px solid #1e3a5f" }}
        onClick={() => setMinimized(m => !m)}
      >
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
          <span className="text-sky-400 font-bold tracking-wider">ASFL · SYSTEM</span>
          {debugMode && !isSuperAdmin && (
            <span className="rounded px-1 py-0.5 text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/30">
              DEBUG
            </span>
          )}
        </div>
        <button
          className="text-slate-500 hover:text-white transition-colors"
          onClick={(e) => { e.stopPropagation(); setVisible(false) }}
          aria-label="Cerrar widget"
          title="Cerrar (Ctrl+Shift+D para reabrir)"
        >
          ✕
        </button>
      </div>

      {/* Body */}
      {!minimized && (
        <div className="p-3 space-y-2 text-slate-400">
          <Row label="Usuario"   value={userName}  />
          <Row label="Email"     value={userEmail} />
          <Row label="Rol"       value={role}      highlight={isSuperAdmin ? "sky" : "amber"} />
          <Row label="Entorno"   value={env}       highlight={env === "production" ? "red" : "green"} />
          <Row label="API Base"  value={apiBase.replace(/^https?:\/\//, "")} />
          <Row label="Timestamp" value={new Date().toISOString().slice(0, 19).replace("T", " ")} />

          {/* API Ping */}
          <div className="pt-1 border-t border-slate-800">
            <button
              onClick={pingApi}
              disabled={pinging}
              className="w-full rounded py-1.5 text-center text-[10px] font-bold tracking-wider
                         transition-colors disabled:opacity-50"
              style={{ background: "#1e293b", color: "#38bdf8" }}
            >
              {pinging ? "Comprobando API…" : "PING API →"}
            </button>
            {pingResult && (
              <p className="mt-1.5 text-center text-[10px] text-slate-300">{pingResult}</p>
            )}
          </div>

          <p className="pt-1 text-[9px] text-slate-600 text-center tracking-wider border-t border-slate-800">
            AXON DCD · GÉNESIS ÉLITE v2 · Ctrl+Shift+D
          </p>
        </div>
      )}
    </div>
  )
}

function Row({
  label, value, highlight,
}: {
  label: string
  value: string
  highlight?: "sky" | "green" | "amber" | "red"
}) {
  const colors: Record<string, string> = {
    sky:   "text-sky-400",
    green: "text-emerald-400",
    amber: "text-amber-400",
    red:   "text-red-400",
  }
  const valueClass = highlight ? colors[highlight] : "text-slate-300"
  return (
    <div className="flex justify-between gap-2 items-baseline">
      <span className="text-slate-600 shrink-0">{label}</span>
      <span className={`truncate text-right ${valueClass}`}>{value}</span>
    </div>
  )
}
