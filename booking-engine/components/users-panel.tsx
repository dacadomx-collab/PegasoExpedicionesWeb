"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  UserPlus, Users, ShieldCheck, Loader2, AlertCircle,
  Eye, EyeOff, CheckCircle, XCircle, RefreshCw,
  Crown, Briefcase, TrendingUp,
} from "lucide-react"
import { useAdminUsers } from "@/hooks/use-admin-users"
import type { AdminRole } from "@/lib/types"

// ── Config de roles ───────────────────────────────────────────
const ROLES: Record<AdminRole, { label: string; description: string; icon: React.ElementType; badge: string; dot: string }> = {
  super_admin: {
    label: "Super Admin",
    description: "Acceso completo: usuarios, configuración y reservas",
    icon: Crown,
    badge: "bg-[#f26d52]/10 text-[#f26d52] border-[#f26d52]/20",
    dot:   "bg-[#f26d52]",
  },
  operaciones: {
    label: "Operaciones",
    description: "Reservas, calendario y ocupación",
    icon: Briefcase,
    badge: "bg-blue-50 text-blue-700 border-blue-200",
    dot:   "bg-blue-500",
  },
  ventas: {
    label: "Ventas",
    description: "Vista de reservas y contacto por WhatsApp",
    icon: TrendingUp,
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot:   "bg-emerald-500",
  },
}

// ── Zod schema ────────────────────────────────────────────────
const schema = z.object({
  name:     z.string().trim().min(3, "Mínimo 3 caracteres"),
  email:    z.string().trim().email("Correo inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
  role:     z.enum(["super_admin", "operaciones", "ventas"]),
})
type FormData = z.infer<typeof schema>

// ── Componente ────────────────────────────────────────────────
interface UsersPanelProps {
  token: string
  currentUserId: number  // para evitar que el super_admin se desactive a sí mismo
}

export function UsersPanel({ token, currentUserId }: UsersPanelProps) {
  const { users, isLoading, error, retry, create, toggle } = useAdminUsers(token)
  const [showForm,     setShowForm]     = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [formError,    setFormError]    = useState<string | null>(null)
  const [toggling,     setToggling]     = useState<number | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: "ventas" },
  })

  async function onSubmit(data: FormData) {
    setFormError(null)
    try {
      await create(data)
      reset()
      setShowForm(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error al crear el usuario.")
    }
  }

  async function handleToggle(userId: number) {
    setToggling(userId)
    try {
      await toggle(userId)
    } catch (err) {
      console.error(err)
    } finally {
      setToggling(null)
    }
  }

  // ── Stats ─────────────────────────────────────────────────
  const activeCount  = users.filter((u) => u.active === 1).length
  const byRole = (r: AdminRole) => users.filter((u) => u.role === r).length

  // ── Formato de fecha ──────────────────────────────────────
  function friendlyDate(iso: string | null): string {
    if (!iso) return "—"
    try {
      return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })
    } catch { return iso }
  }

  // ── Iniciales de avatar ───────────────────────────────────
  function initials(name: string): string {
    return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()
  }

  // ── Colores de avatar por rol ─────────────────────────────
  const AVATAR_BG: Record<AdminRole, string> = {
    super_admin: "bg-[#f26d52]",
    operaciones: "bg-blue-500",
    ventas:      "bg-emerald-500",
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#0f0200]/5 flex items-center justify-center">
            <Users className="h-5 w-5 text-[#0f0200]" />
          </div>
          <div>
            <h3 className="font-serif font-bold text-[#0f0200]">Gestión de Usuarios</h3>
            <p className="text-xs text-[#4c4c4c]">Administradores del sistema · RBAC activo</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={retry} className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-[#4c4c4c]">
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => { setShowForm((p) => !p); setFormError(null) }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${showForm ? "bg-gray-100 text-[#4c4c4c]" : "bg-[#f26d52] text-white hover:bg-[#e05a40]"}`}
          >
            <UserPlus className="h-4 w-4" />
            {showForm ? "Cancelar" : "Nuevo Admin"}
          </button>
        </div>
      </div>

      {/* Stats rápidas */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total",       value: users.length,            color: "text-[#0f0200]", bg: "bg-white" },
          { label: "Activos",     value: activeCount,             color: "text-emerald-700", bg: "bg-emerald-50" },
          { label: "Super Admin", value: byRole("super_admin"),   color: "text-[#f26d52]", bg: "bg-[#f26d52]/10" },
          { label: "Operaciones", value: byRole("operaciones"),   color: "text-blue-700", bg: "bg-blue-50" },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`${bg} rounded-2xl border border-gray-100 p-4 text-center shadow-sm`}>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-[#4c4c4c] mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Formulario Nuevo Admin */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-[#f26d52]/20 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-5">
            <ShieldCheck className="h-5 w-5 text-[#f26d52]" />
            <h4 className="font-semibold text-[#0f0200]">Crear nuevo administrador</h4>
          </div>

          {formError && (
            <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" /> {formError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              {/* Nombre */}
              <div>
                <label className="block text-xs font-semibold text-[#0f0200] mb-1.5">Nombre completo</label>
                <input
                  type="text" placeholder="Daniel García"
                  className={`w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none focus:border-[#f26d52] focus:ring-2 focus:ring-[#f26d52]/10 ${errors.name ? "border-red-300 bg-red-50" : "border-gray-200"}`}
                  {...register("name")}
                />
                {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-[#0f0200] mb-1.5">Correo electrónico</label>
                <input
                  type="email" placeholder="operador@pegaso.com"
                  className={`w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none focus:border-[#f26d52] focus:ring-2 focus:ring-[#f26d52]/10 ${errors.email ? "border-red-300 bg-red-50" : "border-gray-200"}`}
                  {...register("email")}
                />
                {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-[#0f0200] mb-1.5">Contraseña (mín. 8 chars)</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"} placeholder="••••••••"
                    className={`w-full rounded-xl border px-3.5 py-2.5 pr-10 text-sm outline-none focus:border-[#f26d52] focus:ring-2 focus:ring-[#f26d52]/10 ${errors.password ? "border-red-300 bg-red-50" : "border-gray-200"}`}
                    {...register("password")}
                  />
                  <button type="button" onClick={() => setShowPassword((p) => !p)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
              </div>

              {/* Rol */}
              <div>
                <label className="block text-xs font-semibold text-[#0f0200] mb-1.5">Rol de acceso</label>
                <select
                  className={`w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none focus:border-[#f26d52] focus:ring-2 focus:ring-[#f26d52]/10 bg-white ${errors.role ? "border-red-300" : "border-gray-200"}`}
                  {...register("role")}
                >
                  {(Object.entries(ROLES) as [AdminRole, typeof ROLES[AdminRole]][]).map(([key, { label, description }]) => (
                    <option key={key} value={key}>{label} — {description}</option>
                  ))}
                </select>
                {errors.role && <p className="mt-1 text-xs text-red-600">{errors.role.message}</p>}
              </div>
            </div>

            {/* Descripción de permisos */}
            <div className="grid grid-cols-3 gap-2 mb-5">
              {(Object.entries(ROLES) as [AdminRole, typeof ROLES[AdminRole]][]).map(([key, { label, description, icon: Icon, badge }]) => (
                <div key={key} className={`rounded-xl border px-3 py-2.5 ${badge}`}>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Icon className="h-3 w-3" />
                    <p className="text-xs font-semibold">{label}</p>
                  </div>
                  <p className="text-xs opacity-75 leading-tight">{description}</p>
                </div>
              ))}
            </div>

            <button
              type="submit" disabled={isSubmitting}
              className="w-full py-2.5 rounded-xl bg-[#f26d52] text-white text-sm font-semibold hover:bg-[#e05a40] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? "Creando…" : "Crear administrador"}
            </button>
          </form>
        </div>
      )}

      {/* Estado de carga / error */}
      {isLoading && (
        <div className="flex items-center justify-center py-16 gap-3 text-[#4c4c4c]">
          <Loader2 className="h-5 w-5 animate-spin text-[#f26d52]" />
          <span className="text-sm">Cargando usuarios…</span>
        </div>
      )}

      {error && !isLoading && (
        <div className="flex flex-col items-center gap-3 py-12">
          <AlertCircle className="h-8 w-8 text-red-400" />
          <p className="text-sm text-red-600">{error}</p>
          <button onClick={retry} className="px-4 py-2 text-sm rounded-lg border border-red-200 text-red-600 hover:bg-red-50">
            Reintentar
          </button>
        </div>
      )}

      {/* Tabla de usuarios */}
      {!isLoading && !error && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {users.length === 0 ? (
            <div className="py-16 text-center text-sm text-[#4c4c4c]">
              No hay usuarios registrados.
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {users.map((user) => {
                const role = ROLES[user.role] ?? ROLES.ventas
                const RoleIcon = role.icon
                const isSelf  = user.id === currentUserId
                const isActive = user.active === 1
                const isTogglingThis = toggling === user.id

                return (
                  <div key={user.id}
                    className={`flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[#fcfaf5]/60 ${!isActive ? "opacity-50" : ""}`}
                  >
                    {/* Avatar */}
                    <div className={`h-10 w-10 rounded-full ${AVATAR_BG[user.role]} flex items-center justify-center text-white text-sm font-bold shrink-0`}>
                      {initials(user.name)}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-[#0f0200]">{user.name}</p>
                        {isSelf && (
                          <span className="px-1.5 py-0.5 rounded text-xs bg-gray-100 text-[#4c4c4c]">Tú</span>
                        )}
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${role.badge}`}>
                          <RoleIcon className="h-3 w-3" />
                          {role.label}
                        </span>
                      </div>
                      <p className="text-xs text-[#4c4c4c] mt-0.5">{user.email}</p>
                      <p className="text-xs text-[#4c4c4c]/60 mt-0.5">
                        Último acceso: {friendlyDate(user.last_login_at)}
                      </p>
                    </div>

                    {/* Estado + acción */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className={`flex items-center gap-1.5 text-xs font-medium ${isActive ? "text-emerald-600" : "text-gray-400"}`}>
                        <span className={`h-2 w-2 rounded-full ${isActive ? "bg-emerald-500" : "bg-gray-300"}`} />
                        {isActive ? "Activo" : "Inactivo"}
                      </div>

                      <button
                        onClick={() => handleToggle(user.id)}
                        disabled={isSelf || isTogglingThis}
                        title={isSelf ? "No puedes desactivar tu propia cuenta" : isActive ? "Desactivar usuario" : "Activar usuario"}
                        className={`p-2 rounded-xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                          isActive
                            ? "text-red-400 hover:bg-red-50"
                            : "text-emerald-600 hover:bg-emerald-50"
                        }`}
                      >
                        {isTogglingThis
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : isActive
                          ? <XCircle className="h-4 w-4" />
                          : <CheckCircle className="h-4 w-4" />
                        }
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
