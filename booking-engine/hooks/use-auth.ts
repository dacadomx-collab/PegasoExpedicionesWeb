"use client"

import { useState, useEffect, useCallback } from "react"
import type { AdminRole } from "@/lib/types"

const TOKEN_KEY   = "pegaso_admin_token"
const NAME_KEY    = "pegaso_admin_name"
const EMAIL_KEY   = "pegaso_admin_email"

export interface AuthState {
  token:           string | null
  adminName:       string | null
  adminEmail:      string | null
  adminRole:       AdminRole | null   // decodificado del JWT — no almacenado por separado
  isSuperAdmin:    boolean            // shorthand para role === 'super_admin'
  isAuthenticated: boolean
  isReady:         boolean
}

interface AuthActions {
  login:  (token: string, name: string, email: string) => void
  logout: () => void
}

export function useAuth(): AuthState & AuthActions {
  const [token,      setToken]      = useState<string | null>(null)
  const [adminName,  setAdminName]  = useState<string | null>(null)
  const [adminEmail, setAdminEmail] = useState<string | null>(null)
  const [isReady,    setIsReady]    = useState(false)

  // Cargar desde localStorage post-hidratación (evita flash)
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY)
    if (storedToken && !isTokenExpired(storedToken)) {
      setToken(storedToken)
      setAdminName(localStorage.getItem(NAME_KEY))
      setAdminEmail(localStorage.getItem(EMAIL_KEY))
    } else if (storedToken) {
      // Token expirado → limpiar
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(NAME_KEY)
      localStorage.removeItem(EMAIL_KEY)
    }
    setIsReady(true)
  }, [])

  const login = useCallback((newToken: string, name: string, email: string) => {
    localStorage.setItem(TOKEN_KEY,  newToken)
    localStorage.setItem(NAME_KEY,   name)
    localStorage.setItem(EMAIL_KEY,  email)
    setToken(newToken)
    setAdminName(name)
    setAdminEmail(email)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(NAME_KEY)
    localStorage.removeItem(EMAIL_KEY)
    setToken(null)
    setAdminName(null)
    setAdminEmail(null)
  }, [])

  const adminRole = token ? (decodeTokenPayload(token)?.role as AdminRole | null ?? null) : null

  return {
    token,
    adminName,
    adminEmail,
    adminRole,
    isSuperAdmin:    adminRole === "super_admin",
    isAuthenticated: token !== null && !isTokenExpired(token),
    isReady,
    login,
    logout,
  }
}

/** Decodifica el payload JWT sin verificar firma (solo lectura en cliente). */
function decodeTokenPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return null
    return JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))) as Record<string, unknown>
  } catch {
    return null
  }
}

function isTokenExpired(token: string): boolean {
  const payload = decodeTokenPayload(token)
  if (!payload) return true
  if (!payload["exp"]) return false
  return (payload["exp"] as number) * 1000 < Date.now()
}
