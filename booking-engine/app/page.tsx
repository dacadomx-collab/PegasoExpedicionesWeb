"use client"

import { useState } from "react"
import { BookingWidget } from "@/components/booking-widget"
import { AdminDashboard } from "@/components/admin-dashboard"
import { MapPin } from "lucide-react"

export default function Home() {
  const [view, setView] = useState<"widget" | "dashboard">("widget")

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
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setView("widget")}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      view === "widget"
                        ? "bg-[#f26d52] text-white"
                        : "text-[#4c4c4c] hover:bg-gray-100"
                    }`}
                  >
                    Widget
                  </button>
                  <button
                    onClick={() => setView("dashboard")}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      view === "dashboard"
                        ? "bg-[#f26d52] text-white"
                        : "text-[#4c4c4c] hover:bg-gray-100"
                    }`}
                  >
                    Dashboard
                  </button>
                </div>
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
                  Descubre experiencias unicas en los paisajes mas impresionantes del sur de Argentina
                </p>
              </div>
              <BookingWidget />
            </div>
          </main>

          {/* Footer */}
          <footer className="border-t border-gray-200 bg-white py-6">
            <div className="max-w-7xl mx-auto px-4 text-center text-sm text-[#4c4c4c]">
              <p>Pegaso Expediciones - Sistema Operativo Turistico</p>
            </div>
          </footer>
        </div>
      ) : (
        <div className="relative">
          {/* View Switcher Floating */}
          <div className="fixed top-4 right-4 z-[60] flex items-center gap-2 bg-white rounded-lg shadow-lg border border-gray-200 p-1">
            <button
              onClick={() => setView("widget")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                view === "widget"
                  ? "bg-[#f26d52] text-white"
                  : "text-[#4c4c4c] hover:bg-gray-100"
              }`}
            >
              Widget
            </button>
            <button
              onClick={() => setView("dashboard")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                view === "dashboard"
                  ? "bg-[#f26d52] text-white"
                  : "text-[#4c4c4c] hover:bg-gray-100"
              }`}
            >
              Dashboard
            </button>
          </div>
          <AdminDashboard />
        </div>
      )}
    </div>
  )
}
