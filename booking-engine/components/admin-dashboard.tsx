"use client"

import { useMemo, useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import {
  LayoutDashboard, MapPin, ClipboardList, Menu, X,
  MessageCircle, XCircle, Bell, Users, AlertCircle, Loader2,
  TrendingUp, DollarSign, Clock, ExternalLink, Calendar,
  ChevronRight, RefreshCw, ShieldOff, ShieldCheck, Download,
  Settings, LogOut,
} from "lucide-react"
import { Badge }   from "@/components/ui/badge"
import { Button }  from "@/components/ui/button"
import { Input }   from "@/components/ui/input"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useBookings }        from "@/hooks/use-bookings"
import { useExpeditions }     from "@/hooks/use-expeditions"
import { useSalesPause }      from "@/hooks/use-sales-pause"
import { useAuth }            from "@/hooks/use-auth"
import { OccupancyCalendar }  from "@/components/occupancy-calendar"
import { SettingsPanel }      from "@/components/settings-panel"
import { UsersPanel }         from "@/components/users-panel"
import { ExpeditionsPanel }   from "@/components/expeditions-panel"
import type { PaymentStatus, BookingAdminView } from "@/lib/types"

type DashboardTab = "reservas" | "configuracion" | "usuarios" | "expediciones"

// ── Config ────────────────────────────────────────────────────
const PAYPAL_MODE = process.env.NEXT_PUBLIC_PAYPAL_MODE ?? "sandbox"

const STATUS: Record<PaymentStatus, { label: string; dot: string; badge: string }> = {
  pending:   { label: "Pendiente",   dot: "bg-amber-400",   badge: "bg-amber-50  text-amber-700  border-amber-200"   },
  completed: { label: "Pagado",      dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 border-emerald-200"},
  failed:    { label: "Fallido",     dot: "bg-red-400",     badge: "bg-red-50    text-red-700    border-red-200"     },
  refunded:  { label: "Reembolsado", dot: "bg-sky-400",     badge: "bg-sky-50    text-sky-700    border-sky-200"     },
}

function paypalReceiptUrl(captureId: string) {
  return PAYPAL_MODE === "live"
    ? `https://www.paypal.com/activity/payment/${captureId}`
    : `https://www.sandbox.paypal.com/activity/payment/${captureId}`
}

function sanitizePhone(p: string) { return p.replace(/[\s+\-()]/g, "") }

function friendlyDate(iso: string) {
  try { return format(parseISO(iso), "d MMM yyyy", { locale: es }) }
  catch { return iso }
}

function friendlyDateTime(iso: string) {
  try { return format(parseISO(iso), "d MMM, HH:mm", { locale: es }) }
  catch { return iso }
}

// ── Módulo 6: Exportar CSV ────────────────────────────────────
function exportCsv(rows: BookingAdminView[], label = "manifiesto") {
  if (rows.length === 0) return

  const headers = [
    "Nombre", "Teléfono", "Email",
    "Expedición", "Fecha salida", "Personas",
    "Total", "Estado",
  ]
  const data = rows.map((b) => [
    b.customer_name,
    b.customer_phone,
    b.customer_email,
    b.expedition_name,
    b.departure_date,
    String(b.num_spots),
    `$${b.total_amount}`,
    STATUS[b.payment_status].label,
  ])

  const csv = [headers, ...data]
    .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\r\n")

  // BOM UTF-8 → Excel abre caracteres especiales (ñ, acentos) correctamente
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" })
  const url  = URL.createObjectURL(blob)
  const a    = Object.assign(document.createElement("a"), {
    href:     url,
    download: `${label}-${format(new Date(), "yyyy-MM-dd")}.csv`,
  })
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── Componente principal ──────────────────────────────────────
export function AdminDashboard() {
  const router = useRouter()
  const { bookings, isLoading, error, retry } = useBookings()
  const { expeditions }                        = useExpeditions()
  const { isPaused, togglePause, isReady: pauseReady } = useSalesPause()
  const { token, adminName, adminEmail, isAuthenticated, isSuperAdmin, isReady: authReady, logout } = useAuth()
  // Extraer ID del admin desde el JWT (para UsersPanel — evitar auto-desactivación)
  const currentAdminId = token
    ? (() => { try { const p = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))); return (p as { sub?: number }).sub ?? 0 } catch { return 0 } })()
    : 0

  const [activeTab, setActiveTab]       = useState<DashboardTab>("reservas")
  const [sidebarOpen, setSidebarOpen]   = useState(false)
  const [search, setSearch]             = useState("")
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | "all">("all")
  const [localOverrides, setLocalOverrides] = useState<Record<number, PaymentStatus>>({})

  // ── Auth Guard (efecto de redirección) ───────────────────
  useEffect(() => {
    if (authReady && !isAuthenticated) {
      router.replace("/admin/login")
    }
  }, [authReady, isAuthenticated, router])

  // ── TODOS LOS HOOKS DEBEN ESTAR ANTES DE CUALQUIER RETURN ──
  // Rules of Hooks: no llamar hooks condicionalmente.
  // Los useMemo se ejecutan siempre; producen valores vacíos/seguros
  // mientras authReady es false o bookings aún no cargó.

  const bookingsList = useMemo(
    () => bookings.map((b) => localOverrides[b.id] ? { ...b, payment_status: localOverrides[b.id] } : b),
    [bookings, localOverrides]
  )

  const stats = useMemo(() => {
    const thisMonth = new Date().toISOString().slice(0, 7)
    const monthly   = bookingsList.filter((b) => b.created_at.startsWith(thisMonth))
    const monthRev  = monthly
      .filter((b) => b.payment_status === "completed")
      .reduce((s, b) => s + parseFloat(b.total_amount), 0)

    const pending   = bookingsList.filter((b) => b.payment_status === "pending").length
    const completed = bookingsList.filter((b) => b.payment_status === "completed").length
    const rate      = bookingsList.length > 0 ? Math.round((completed / bookingsList.length) * 100) : 0

    return [
      { icon: DollarSign, label: "Ventas del mes",      value: `$${monthRev.toLocaleString("es-MX", { minimumFractionDigits: 0 })}`,
        sub: `${monthly.filter((b) => b.payment_status === "completed").length} pagos confirmados`,  color: "text-emerald-600", bg: "bg-emerald-50"    },
      { icon: Clock,       label: "Pendientes de pago", value: String(pending),
        sub: pending === 1 ? "reserva esperando pago" : "reservas esperando pago",                   color: "text-amber-600",   bg: "bg-amber-50"      },
      { icon: TrendingUp,  label: "Tasa de conversión", value: `${rate}%`,
        sub: `${completed} de ${bookingsList.length} completadas`,                                   color: "text-[#f26d52]",  bg: "bg-[#f26d52]/10" },
    ]
  }, [bookingsList])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return bookingsList.filter((b) => {
      const matchStatus = statusFilter === "all" || b.payment_status === statusFilter
      const matchSearch = !q || [b.customer_name, b.customer_email, b.expedition_name]
        .some((v) => v.toLowerCase().includes(q))
      return matchStatus && matchSearch
    })
  }, [bookingsList, search, statusFilter])

  // ── Returns condicionales DESPUÉS de todos los hooks ─────
  // Spinner de auth: mientras se verifica la sesión o si no está autenticado
  if (!authReady || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#fcfaf5] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#f26d52]" />
      </div>
    )
  }

  function handleCancel(id: number) {
    setLocalOverrides((p) => ({ ...p, [id]: "failed" }))
  }

  function handleWhatsApp(b: BookingAdminView) {
    const msg = encodeURIComponent(
      `Hola ${b.customer_name}! Te contactamos de Pegaso Expediciones sobre tu reserva de ${b.expedition_name}.`
    )
    window.open(`https://wa.me/${sanitizePhone(b.customer_phone)}?text=${msg}`, "_blank")
  }

  return (
    <div className="min-h-screen bg-[#fcfaf5] flex">
      {/* Overlay mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-100 flex flex-col transform transition-transform duration-200 ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#f26d52] flex items-center justify-center">
              <MapPin className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-serif font-bold text-[#0f0200] text-lg leading-tight">Pegaso</h1>
              <p className="text-xs text-[#4c4c4c]">Expediciones</p>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1 hover:bg-gray-100 rounded">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {([
            { icon: LayoutDashboard, label: "Dashboard",     tab: "reservas" as const,      show: true         },
            { icon: MapPin,          label: "Expediciones",  tab: "expediciones" as const,  show: isSuperAdmin },
            { icon: Settings,        label: "Configuración", tab: "configuracion" as const, show: isSuperAdmin },
            { icon: Users,           label: "Usuarios",      tab: "usuarios" as const,      show: isSuperAdmin },
          ]).filter(({ show }) => show).map(({ icon: Icon, label, tab }) => (
            <button key={label}
              onClick={() => { setActiveTab(tab); setSidebarOpen(false) }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm transition-colors ${activeTab === tab ? "bg-[#f26d52]/10 text-[#f26d52] font-semibold" : "text-[#4c4c4c] hover:bg-[#fcfaf5] hover:text-[#0f0200]"}`}>
              <Icon className="h-4 w-4" />
              <span>{label}</span>
              {activeTab === tab && <ChevronRight className="h-4 w-4 ml-auto" />}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-100 space-y-2">
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-[#fcfaf5]">
            <div className="h-9 w-9 rounded-full bg-[#f26d52] flex items-center justify-center text-white text-sm font-bold shrink-0">
              {(adminName?.[0] ?? "A").toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-[#0f0200] truncate">{adminName ?? "Administrador"}</p>
              <p className="text-xs text-[#4c4c4c] truncate">{adminEmail ?? ""}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-[#4c4c4c] hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-100 px-4 lg:px-8 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 hover:bg-gray-100 rounded-lg">
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <h2 className="font-serif text-xl lg:text-2xl font-bold text-[#0f0200]">
                {{ reservas: "Dashboard", configuracion: "Configuración", usuarios: "Usuarios", expediciones: "Expediciones" }[activeTab]}
              </h2>
              <p className="text-xs text-[#4c4c4c] hidden sm:block">
                {{ reservas: "Centro de Mando · Pegaso Expediciones", configuracion: "Variables del sistema · PayPal · WhatsApp", usuarios: "RBAC · Control de Acceso Basado en Roles", expediciones: "Catálogo dinámico · Condiciones y cupos" }[activeTab]}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={retry} title="Actualizar"
              className="p-2 hover:bg-gray-100 rounded-lg text-[#4c4c4c] transition-colors">
              <RefreshCw className="h-4 w-4" />
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-lg relative">
              <Bell className="h-5 w-5 text-[#4c4c4c]" />
              {bookingsList.filter((b) => b.payment_status === "pending").length > 0 && (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-[#f26d52] rounded-full" />
              )}
            </button>
          </div>
        </header>

        <div className="flex-1 p-4 lg:p-8 overflow-auto space-y-6">

          {/* ── Pestaña: Expediciones (super_admin only) ── */}
          {activeTab === "expediciones" && isSuperAdmin && token && (
            <ExpeditionsPanel token={token} />
          )}

          {/* ── Pestaña: Configuración (super_admin only) ── */}
          {activeTab === "configuracion" && isSuperAdmin && token && (
            <SettingsPanel token={token} />
          )}

          {/* ── Pestaña: Usuarios (super_admin only) ── */}
          {activeTab === "usuarios" && isSuperAdmin && token && (
            <UsersPanel token={token} currentUserId={currentAdminId} />
          )}

          {/* ── Pestaña: Reservas (todos los roles) ── */}
          {activeTab === "reservas" && (<>

          {/* Loading / Error — confinado a la pestaña de reservas, nunca oculta el sidebar */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center gap-4 py-24">
              <Loader2 className="h-10 w-10 animate-spin text-[#f26d52]" />
              <p className="text-sm text-[#4c4c4c]">Cargando reservas…</p>
            </div>
          )}

          {!isLoading && error && (
            <div className="flex flex-col items-center justify-center gap-4 py-24 max-w-sm mx-auto text-center">
              <AlertCircle className="h-10 w-10 text-red-500" />
              <p className="text-sm text-[#4c4c4c]">{error}</p>
              <Button variant="outline" onClick={retry}
                className="border-[#f26d52] text-[#f26d52] hover:bg-[#f26d52]/10">
                Reintentar
              </Button>
            </div>
          )}

          {!isLoading && !error && (<>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {stats.map(({ icon: Icon, label, value, sub, color, bg }) => (
              <div key={label} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-start gap-4">
                <div className={`h-11 w-11 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-[#4c4c4c] mb-0.5">{label}</p>
                  <p className="text-2xl font-bold text-[#0f0200] leading-tight">{value}</p>
                  <p className="text-xs text-[#4c4c4c] mt-0.5 truncate">{sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Módulo 4: Botón de Pánico ── */}
          {pauseReady && (
            <div className={`rounded-2xl border shadow-sm p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-colors ${isPaused ? "bg-red-50 border-red-200" : "bg-white border-gray-100"}`}>
              <div className="flex items-start gap-4">
                <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${isPaused ? "bg-red-100" : "bg-gray-100"}`}>
                  {isPaused
                    ? <ShieldOff className="h-5 w-5 text-red-600" />
                    : <ShieldCheck className="h-5 w-5 text-gray-500" />
                  }
                </div>
                <div>
                  <p className={`font-semibold text-sm ${isPaused ? "text-red-700" : "text-[#0f0200]"}`}>
                    {isPaused ? "⚠️ Ventas PAUSADAS" : "Ventas activas"}
                  </p>
                  <p className={`text-xs mt-0.5 ${isPaused ? "text-red-600" : "text-[#4c4c4c]"}`}>
                    {isPaused
                      ? "El formulario público muestra un banner rojo. Los clientes no pueden pagar."
                      : "El motor de reservas está operativo. Activa la pausa por clima o mantenimiento."
                    }
                  </p>
                  <p className="text-xs text-[#4c4c4c] mt-1 opacity-60">
                    Fase actual: localStorage. Conectar a <code className="bg-gray-100 px-1 rounded">system_settings</code> para persistencia multi-dispositivo.
                  </p>
                </div>
              </div>
              <button
                onClick={togglePause}
                className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shrink-0 ${
                  isPaused
                    ? "bg-red-600 hover:bg-red-700 text-white"
                    : "bg-gray-800 hover:bg-gray-900 text-white"
                }`}
              >
                {isPaused ? "Reanudar ventas" : "Pausar ventas"}
              </button>
            </div>
          )}

          {/* ── Módulo 5: Calendario de Ocupación Tipo Airbnb ── */}
          <OccupancyCalendar bookings={bookingsList} expeditions={expeditions} />

          {/* ── Tabla de Reservas + Módulo 6: Exportar CSV ── */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Cabecera tabla */}
            <div className="p-4 lg:p-6 border-b border-gray-100">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-serif text-lg font-bold text-[#0f0200]">Reservas</h3>
                  <p className="text-xs text-[#4c4c4c]">{filtered.length} de {bookingsList.length} registros</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Buscar */}
                  <div className="relative">
                    <Users className="h-3.5 w-3.5 text-[#4c4c4c] absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <Input value={search} onChange={(e) => setSearch(e.target.value)}
                      placeholder="Buscar…" className="pl-8 h-8 text-sm w-40 border-gray-200" />
                  </div>

                  {/* Filtro estado */}
                  <div className="flex items-center gap-1">
                    {(["all", "pending", "completed", "failed"] as const).map((s) => (
                      <button key={s} onClick={() => setStatusFilter(s)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${statusFilter === s ? "bg-[#f26d52] text-white" : "bg-gray-100 text-[#4c4c4c] hover:bg-gray-200"}`}>
                        {s === "all" ? "Todos" : STATUS[s as PaymentStatus].label}
                      </button>
                    ))}
                  </div>

                  {/* ── Módulo 6: Botón Descargar Manifiesto ── */}
                  <button
                    onClick={() => exportCsv(filtered, `manifiesto-pegaso`)}
                    disabled={filtered.length === 0}
                    title="Descargar Manifiesto CSV"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Manifiesto</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Tabla desktop */}
            <div className="hidden lg:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#fcfaf5] hover:bg-[#fcfaf5]">
                    {["Cliente", "Expedición", "Fecha salida", "Reservado el", "Estado", "Monto", "Acciones"].map((h) => (
                      <TableHead key={h} className={`text-xs font-semibold text-[#4c4c4c] uppercase tracking-wide ${h === "Monto" || h === "Acciones" ? "text-right" : ""}`}>
                        {h}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12 text-[#4c4c4c] text-sm">
                        No hay reservas que coincidan con los filtros.
                      </TableCell>
                    </TableRow>
                  ) : filtered.map((b) => (
                    <TableRow key={b.id} className="hover:bg-[#fcfaf5]/60 transition-colors">
                      <TableCell>
                        <div className="min-w-0">
                          <p className="font-medium text-[#0f0200] text-sm">{b.customer_name}</p>
                          <p className="text-xs text-[#4c4c4c] truncate max-w-[160px]">{b.customer_email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm text-[#0f0200]">{b.expedition_name}</p>
                        <p className="text-xs text-[#4c4c4c]">
                          <Users className="h-3 w-3 inline mr-0.5" />{b.num_spots} persona(s)
                        </p>
                      </TableCell>
                      <TableCell className="text-sm text-[#0f0200]">{friendlyDate(b.departure_date)}</TableCell>
                      <TableCell className="text-xs text-[#4c4c4c]">{friendlyDateTime(b.created_at)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className={`h-2 w-2 rounded-full ${STATUS[b.payment_status].dot}`} />
                          <Badge variant="outline" className={`text-xs ${STATUS[b.payment_status].badge}`}>
                            {STATUS[b.payment_status].label}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-semibold text-[#0f0200]">
                          ${parseFloat(b.total_amount).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleWhatsApp(b)}
                            className="h-8 w-8 text-emerald-600 hover:bg-emerald-50">
                            <MessageCircle className="h-4 w-4" />
                          </Button>
                          {b.payment_status === "completed" && b.paypal_transaction_id && (
                            <a href={paypalReceiptUrl(b.paypal_transaction_id)}
                              target="_blank" rel="noopener noreferrer"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-sky-600 hover:bg-sky-50 transition-colors"
                              title="Ver recibo PayPal">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                          {b.payment_status !== "failed" && b.payment_status !== "refunded" && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon"
                                  className="h-8 w-8 text-red-400 hover:bg-red-50">
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Cancelar Reserva</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    ¿Cancelar la reserva de <strong>{b.customer_name}</strong> para{" "}
                                    <strong>{b.expedition_name}</strong> el {friendlyDate(b.departure_date)}?
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Mantener</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleCancel(b.id)}
                                    className="bg-red-500 hover:bg-red-600">Cancelar reserva</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Cards mobile */}
            <div className="lg:hidden divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <p className="text-center py-10 text-sm text-[#4c4c4c]">Sin resultados.</p>
              ) : filtered.map((b) => (
                <div key={b.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-[#0f0200] text-sm">{b.customer_name}</p>
                      <p className="text-xs text-[#4c4c4c]">{b.expedition_name}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className={`h-2 w-2 rounded-full ${STATUS[b.payment_status].dot}`} />
                      <Badge variant="outline" className={`text-xs ${STATUS[b.payment_status].badge}`}>
                        {STATUS[b.payment_status].label}
                      </Badge>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-[#4c4c4c]">Salida</p>
                      <p className="font-medium text-[#0f0200]">{friendlyDate(b.departure_date)}</p>
                    </div>
                    <div>
                      <p className="text-[#4c4c4c]">Personas</p>
                      <p className="font-medium text-[#0f0200]">{b.num_spots}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[#4c4c4c]">Total</p>
                      <p className="font-bold text-[#0f0200]">
                        ${parseFloat(b.total_amount).toLocaleString("es-MX", { minimumFractionDigits: 0 })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleWhatsApp(b)}
                      className="flex-1 h-8 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50">
                      <MessageCircle className="h-3.5 w-3.5 mr-1.5" /> WhatsApp
                    </Button>
                    {b.payment_status === "completed" && b.paypal_transaction_id && (
                      <a href={paypalReceiptUrl(b.paypal_transaction_id)}
                        target="_blank" rel="noopener noreferrer"
                        className="flex-1 h-8 flex items-center justify-center gap-1.5 text-xs text-sky-600 border border-sky-200 rounded-md hover:bg-sky-50">
                        <ExternalLink className="h-3.5 w-3.5" /> Recibo
                      </a>
                    )}
                    {b.payment_status !== "failed" && b.payment_status !== "refunded" && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm"
                            className="h-8 w-8 p-0 text-red-400 border-red-200 hover:bg-red-50">
                            <XCircle className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Cancelar Reserva</AlertDialogTitle>
                            <AlertDialogDescription>
                              ¿Cancelar la reserva de <strong>{b.customer_name}</strong>?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Mantener</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleCancel(b.id)}
                              className="bg-red-500 hover:bg-red-600">Cancelar</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          </>)} {/* fin bloque sin-loading/error */}

          </>)} {/* fin pestaña reservas */}

        </div>
      </main>
    </div>
  )
}
