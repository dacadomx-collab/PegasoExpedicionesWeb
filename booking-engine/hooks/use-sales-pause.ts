"use client"

import { useState, useEffect, useCallback } from "react"

const STORAGE_KEY = "pegaso_sales_paused"

interface UseSalesPauseReturn {
  isPaused: boolean
  togglePause: () => void
  isReady: boolean  // false durante hidratación para evitar flash
}

/**
 * Gestiona el estado de "Pausar Ventas".
 * Persiste en localStorage → sincroniza entre pestañas con el evento 'storage'.
 * Fase actual: solo frontend. Futuro: conectar a system_settings en DB.
 */
export function useSalesPause(): UseSalesPauseReturn {
  const [isPaused, setIsPaused] = useState(false)
  const [isReady, setIsReady]   = useState(false)

  // Leer el estado inicial del localStorage (solo en cliente, post-hidratación)
  useEffect(() => {
    setIsPaused(localStorage.getItem(STORAGE_KEY) === "true")
    setIsReady(true)
  }, [])

  // Sincronizar entre pestañas (admin dashboard ↔ booking widget en el mismo navegador)
  useEffect(() => {
    function handleStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) {
        setIsPaused(e.newValue === "true")
      }
    }
    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
  }, [])

  const togglePause = useCallback(() => {
    setIsPaused((prev) => {
      const next = !prev
      localStorage.setItem(STORAGE_KEY, String(next))
      // Disparar storage event manualmente para sincronizar dentro de la misma pestaña
      window.dispatchEvent(
        new StorageEvent("storage", { key: STORAGE_KEY, newValue: String(next) })
      )
      return next
    })
  }, [])

  return { isPaused, togglePause, isReady }
}
