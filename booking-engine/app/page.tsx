"use client"

import { useState, useEffect } from "react"
import { BookingWidget } from "@/components/booking-widget"
import { AdminDashboard } from "@/components/admin-dashboard"
import { MapPin } from "lucide-react"

// ── Types ─────────────────────────────────────────────────────────────────────

type View = "widget" | "dashboard"

// ── Sub-components ────────────────────────────────────────────────────────────

/**
 * ViewToggle — extracted to break TypeScript control-flow narrowing.
 *
 * Root cause of TS2367: inside a `view === "widget" ? (...) : (...)` branch,
 * the compiler narrows `view` to the literal that matches, making comparisons
 * against the other literal impossible ("no overlap"). Moving the comparisons
 * here — where `view` arrives as the full union type — eliminates the error.
 */
interface ViewToggleProps {
  view: View
  onViewChange: (next: View) => void
  variant?: "header" | "floating"
}

const VIEW_LABELS: Record<View, string> = {
  widget: "Widget",
  dashboard: "Dashboard",
}

function ViewToggle({ view, onViewChange, variant = "header" }: ViewToggleProps) {
  const isFloating = variant === "floating"
  const views: View[] = ["widget", "dashboard"]

  return (
    <div className={`flex items-center gap-2 ${isFloating ? "p-0" : ""}`}>
      {views.map((v) => (
        <button
          key={v}
          onClick={() => onViewChange(v)}
          aria-pressed={view === v}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            isFloating ? "rounded-md" : "rounded-lg"
          } ${
            view === v
              ? "bg-[#f26d52] text-white"
              : "text-[#4c4c4c] hover:bg-gray-100"
          }`}
        >
          {VIEW_LABELS[v]}
        </button>
      ))}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Home() {
  const [view, setView] = useState<View>("widget")

  // Post-hidratación: leer el query param de forma segura (evita mismatch SSR/cliente)
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("view") === "dashboard") {
      setView("dashboard")
    }
  }, [])

  return (
    <div className="min-h-screen">
      {view === "widget" ? (
        <div className="min-h-screen bg-[#fcfaf5]">
          {/* Header */}
          <header className="bg-white border-b border-gray-100">
            <div className="max-w-7xl mx-auto px-4 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-[#f26d52] flex items-center justify-center">
                    <MapPin className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h1 className="font-serif font-bold text-[#0f0200] text-lg">Pegaso</h1>
                    <p className="text-xs text-[#4c4c4c]">Expediciones</p>
                  </div>
                </div>
                {/* Comparisons inside ViewToggle — view prop is View (not narrowed) */}
                <ViewToggle view={view} onViewChange={setView} variant="header" />
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="py-12 px-4">
            <div className="max-w-7xl mx-auto">
              <div className="text-center mb-10">
                <h2 className="font-serif text-3xl md:text-4xl font-bold text-[#0f0200] mb-3">
                  Explora la Patagonia
                </h2>
                <p className="text-[#4c4c4c] max-w-xl mx-auto">
                  Descubre experiencias únicas en los paisajes más impresionantes del sur de Argentina
                </p>
              </div>
              <BookingWidget />
            </div>
          </main>

          {/* Footer */}
          <footer className="border-t border-gray-200 bg-white py-6">
            <div className="max-w-7xl mx-auto px-4 text-center text-sm text-[#4c4c4c]">
              <p>Pegaso Expediciones — Sistema Operativo Turístico</p>
            </div>
          </footer>
        </div>
      ) : (
        <div className="relative">
          {/* Floating switcher — same component, no narrowing issues */}
          <div className="fixed top-4 right-4 z-[60] bg-white rounded-lg shadow-lg border border-gray-200 p-1">
            <ViewToggle view={view} onViewChange={setView} variant="floating" />
          </div>
          <AdminDashboard />
        </div>
      )}
    </div>
  )
}
