"use client"

import { useState, useEffect, useCallback } from "react"
import { fetchAdminUsers, createAdminUser, toggleAdminUser } from "@/lib/api"
import type { AdminUser, CreateAdminUserPayload } from "@/lib/types"

interface UseAdminUsersReturn {
  users:       AdminUser[]
  isLoading:   boolean
  error:       string | null
  retry:       () => void
  create:      (payload: CreateAdminUserPayload) => Promise<void>
  toggle:      (userId: number) => Promise<void>
}

export function useAdminUsers(token: string | null): UseAdminUsersReturn {
  const [users,     setUsers]     = useState<AdminUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [tick,      setTick]      = useState(0)  // incrementar para refetch

  const retry = useCallback(() => setTick((n) => n + 1), [])

  useEffect(() => {
    if (!token) {
      setIsLoading(false)
      return
    }
    let cancelled = false
    setIsLoading(true)
    setError(null)

    fetchAdminUsers(token)
      .then((data) => { if (!cancelled) setUsers(data) })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Error al cargar usuarios.")
      })
      .finally(() => { if (!cancelled) setIsLoading(false) })

    return () => { cancelled = true }
  }, [token, tick])

  const create = useCallback(async (payload: CreateAdminUserPayload) => {
    if (!token) throw new Error("Sin sesión activa.")
    const newUser = await createAdminUser(payload, token)
    setUsers((prev) => [...prev, newUser])
  }, [token])

  const toggle = useCallback(async (userId: number) => {
    if (!token) throw new Error("Sin sesión activa.")
    const result = await toggleAdminUser(userId, token)
    setUsers((prev) =>
      prev.map((u) => u.id === result.id ? { ...u, active: result.active } : u)
    )
  }, [token])

  return { users, isLoading, error, retry, create, toggle }
}
