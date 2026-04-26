"use client"

import { useMemo, useState } from "react"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { Calendar } from "@/components/ui/calendar"
import { Users } from "lucide-react"
import type { BookingAdminView, Expedition } from "@/lib/types"

interface OccupancyCalendarProps {
  bookings: BookingAdminView[]
  expeditions: Expedition[]
}

/** Calcula cupo ocupado por fecha a partir de las reservas activas */
function useOccupancy(bookings: BookingAdminView[], expeditions: Expedition[]) {
  return useMemo(() => {
    // Cupo diario total = suma de daily_capacity de todas las expediciones activas
    const totalCapacity = expeditions.reduce((s, e) => s + e.daily_capacity, 0)

    // Sumar num_spots por fecha (solo pending y completed cuentan)
    const byDate = new Map<string, number>()
    for (const b of bookings) {
      if (b.payment_status === "failed" || b.payment_status === "refunded") continue
      byDate.set(b.departure_date, (byDate.get(b.departure_date) ?? 0) + b.num_spots)
    }

    // Clasificar cada fecha
    const high: Date[] = []    // > 50% disponible  → verde
    const medium: Date[] = []  // > 0 y ≤ 50%       → amarillo
    const full: Date[] = []    // 0 disponible       → rojo

    byDate.forEach((booked, dateStr) => {
      const available  = Math.max(0, totalCapacity - booked)
      const pct        = totalCapacity > 0 ? available / totalCapacity : 0
      const d          = new Date(dateStr + "T12:00:00")

      if (pct > 0.5)       high.push(d)
      else if (pct > 0)    medium.push(d)
      else                 full.push(d)
    })

    return { byDate, totalCapacity, high, medium, full }
  }, [bookings, expeditions])
}

export function OccupancyCalendar({ bookings, expeditions }: OccupancyCalendarProps) {
  const [selected, setSelected] = useState<Date | undefined>()
  const { byDate, totalCapacity, high, medium, full } = useOccupancy(bookings, expeditions)

  const selectedInfo = useMemo(() => {
    if (!selected) return null
    const dateStr  = format(selected, "yyyy-MM-dd")
    const booked   = byDate.get(dateStr) ?? 0
    const available= Math.max(0, totalCapacity - booked)
    const dayBookings = bookings.filter(
      (b) => b.departure_date === dateStr &&
             b.payment_status !== "failed" &&
             b.payment_status !== "refunded"
    )
    return { dateStr, booked, available, dayBookings }
  }, [selected, byDate, totalCapacity, bookings])

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="font-serif font-bold text-[#0f0200]">Ocupación por Fecha</h3>
          <p className="text-xs text-[#4c4c4c]">
            Cupo total del sistema: {totalCapacity} personas/día
          </p>
        </div>
        {/* Leyenda */}
        <div className="hidden sm:flex items-center gap-3 text-xs">
          {[
            { color: "#bbf7d0", label: "> 50% libre" },
            { color: "#fef08a", label: "< 50% libre" },
            { color: "#fecaca", label: "Sin cupo"    },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: color }} />
              <span className="text-[#4c4c4c]">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row">
        {/* Calendar */}
        <div className="p-4 flex justify-center lg:border-r border-gray-100">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={setSelected}
            locale={es}
            modifiers={{ high, medium, full }}
            modifiersStyles={{
              high:   { backgroundColor: "#bbf7d0", color: "#14532d", fontWeight: "600", borderRadius: "6px" },
              medium: { backgroundColor: "#fef08a", color: "#713f12", fontWeight: "600", borderRadius: "6px" },
              full:   { backgroundColor: "#fecaca", color: "#7f1d1d", fontWeight: "600", borderRadius: "6px" },
            }}
          />
        </div>

        {/* Panel de detalle del día seleccionado */}
        <div className="flex-1 p-5">
          {!selectedInfo ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-[#4c4c4c] gap-2 py-8">
              <p className="text-2xl">📅</p>
              <p className="text-sm font-medium">Selecciona un día</p>
              <p className="text-xs">para ver las reservas activas</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="font-serif font-bold text-[#0f0200] text-lg">
                  {format(selected!, "EEEE d 'de' MMMM", { locale: es })}
                </p>
                <div className="flex items-center gap-4 mt-2">
                  <Stat label="Reservados" value={selectedInfo.booked}   color="text-[#f26d52]" />
                  <Stat label="Disponibles" value={selectedInfo.available} color="text-emerald-600" />
                  <Stat label="Reservas"   value={selectedInfo.dayBookings.length} color="text-[#0f0200]" />
                </div>
              </div>

              {selectedInfo.dayBookings.length === 0 ? (
                <p className="text-sm text-[#4c4c4c]">Sin reservas para este día.</p>
              ) : (
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {selectedInfo.dayBookings.map((b) => (
                    <div key={b.id}
                      className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[#fcfaf5] border border-gray-100">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#0f0200] truncate">{b.customer_name}</p>
                        <p className="text-xs text-[#4c4c4c]">{b.expedition_name}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-semibold text-[#f26d52]">
                          <Users className="h-3 w-3 inline mr-0.5" />{b.num_spots}
                        </p>
                        <p className="text-xs text-[#4c4c4c]">${b.total_amount}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-[#4c4c4c]">{label}</p>
    </div>
  )
}
