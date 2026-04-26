"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { MapPin, Loader2, Eye, EyeOff } from "lucide-react"
import { loginAdmin } from "@/lib/api"
import { useAuth } from "@/hooks/use-auth"

const schema = z.object({
  email:    z.string().email("Correo electrónico inválido"),
  password: z.string().min(1, "Contraseña requerida"),
})
type FormData = z.infer<typeof schema>

export default function AdminLoginPage() {
  const router                    = useRouter()
  const { login, isAuthenticated, isReady } = useAuth()
  const [showPassword, setShowPassword]     = useState(false)
  const [serverError,  setServerError]      = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  // Redirigir si ya hay sesión activa
  useEffect(() => {
    if (isReady && isAuthenticated) {
      router.replace("/?view=dashboard")
    }
  }, [isReady, isAuthenticated, router])

  async function onSubmit(data: FormData) {
    setServerError(null)
    try {
      const res = await loginAdmin({ email: data.email, password: data.password })
      login(res.token, res.admin_name, res.admin_email)
      router.replace("/?view=dashboard")
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Error desconocido.")
    }
  }

  // No renderizar hasta saber el estado de auth (evita flash)
  if (!isReady) {
    return (
      <div className="min-h-screen bg-[#fcfaf5] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#f26d52]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#fcfaf5] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="h-12 w-12 rounded-2xl bg-[#f26d52] flex items-center justify-center shadow-md">
            <MapPin className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="font-serif font-bold text-[#0f0200] text-xl leading-tight">Pegaso</p>
            <p className="text-xs text-[#4c4c4c]">Panel de Administración</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h1 className="font-serif font-bold text-[#0f0200] text-xl mb-1">Iniciar sesión</h1>
          <p className="text-sm text-[#4c4c4c] mb-6">Ingresa tus credenciales de administrador</p>

          {serverError && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-[#0f0200] mb-1.5" htmlFor="email">
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                className={`w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition-colors
                  focus:border-[#f26d52] focus:ring-2 focus:ring-[#f26d52]/10
                  ${errors.email ? "border-red-300 bg-red-50" : "border-gray-200 bg-white"}`}
                placeholder="admin@pegasoexpediciones.com"
                {...register("email")}
              />
              {errors.email && (
                <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-[#0f0200] mb-1.5" htmlFor="password">
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  className={`w-full rounded-xl border px-3.5 py-2.5 pr-10 text-sm outline-none transition-colors
                    focus:border-[#f26d52] focus:ring-2 focus:ring-[#f26d52]/10
                    ${errors.password ? "border-red-300 bg-red-50" : "border-gray-200 bg-white"}`}
                  placeholder="••••••••"
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-[#f26d52] py-2.5 text-sm font-semibold text-white
                transition-colors hover:bg-[#e05a40] disabled:opacity-60 disabled:cursor-not-allowed
                flex items-center justify-center gap-2"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? "Verificando…" : "Entrar al panel"}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-[#4c4c4c]">
          Pegaso Expediciones — Sistema de reservas v2
        </p>
      </div>
    </div>
  )
}
