"use client"

import { useState, useEffect } from "react"
import type { BookingAdminView } from "@/lib/types"
import { fetchBookings } from "@/lib/api"

interface UseBookingsResult {
  bookings: BookingAdminView[]
  isLoading: boolean
  error: string | null
  retry: () => void
}

/**
 * ⚠️ PUNTO CIEGO (DT-02): Este hook consume GET /api/get_reservas.php,
 * endpoint que AÚN NO ESTÁ registrado en 03_CONTRATOS_API_Y_LOGICA.md.
 * El Arquitecto debe definir el contrato antes de implementar el PHP.
 */
export function useBookings(): UseBookingsResult {
  const [bookings, setBookings] = useState<BookingAdminView[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    let cancelled = false

    setIsLoading(true)
    setError(null)

    fetchBookings()
      .then((data) => {
        if (!cancelled) setBookings(data)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "No se pudo cargar las reservas. Intenta de nuevo."
          )
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [retryCount])

  return {
    bookings,
    isLoading,
    error,
    retry: () => setRetryCount((n) => n + 1),
  }
}
