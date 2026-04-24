"use client"

import { useState, useEffect } from "react"
import type { Expedition } from "@/lib/types"
import { fetchExpeditions } from "@/lib/api"

interface UseExpeditionsResult {
  expeditions: Expedition[]
  isLoading: boolean
  error: string | null
  retry: () => void
}

export function useExpeditions(): UseExpeditionsResult {
  const [expeditions, setExpeditions] = useState<Expedition[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    let cancelled = false

    setIsLoading(true)
    setError(null)

    fetchExpeditions()
      .then((data) => {
        if (!cancelled) setExpeditions(data)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "No se pudo cargar el catálogo. Intenta de nuevo."
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
    expeditions,
    isLoading,
    error,
    retry: () => setRetryCount((n) => n + 1),
  }
}
