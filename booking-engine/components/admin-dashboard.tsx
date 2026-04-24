"use client"

import { useMemo, useState } from "react"
import {
  Calendar,
  LayoutDashboard,
  MapPin,
  ClipboardList,
  Menu,
  X,
  MessageCircle,
  XCircle,
  ChevronRight,
  Search,
  Bell,
  Users,
  AlertCircle,
  Loader2,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useBookings } from "@/hooks/use-bookings"
import type { PaymentStatus, BookingAdminView } from "@/lib/types"

const sidebarItems = [
  { icon: LayoutDashboard, label: "Dashboard", active: true },
  { icon: Calendar, label: "Calendario", active: false },
  { icon: MapPin, label: "Gestión de Tours", active: false },
  { icon: ClipboardList, label: "Reservas", active: false },
]

const statusConfig: Record<PaymentStatus, { label: string; className: string }> = {
  pending:   { label: "Pendiente",   className: "bg-amber-100 text-amber-700 hover:bg-amber-100" },
  completed: { label: "Pagado",      className: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" },
  failed:    { label: "Fallido",     className: "bg-red-100 text-red-700 hover:bg-red-100" },
  refunded:  { label: "Reembolsado", className: "bg-blue-100 text-blue-700 hover:bg-blue-100" },
}

/** DT-05 fix: elimina espacios, guiones y símbolo + para URL de WhatsApp */
function sanitizePhone(phone: string): string {
  return phone.replace(/[\s+\-()]/g, "")
}

export function AdminDashboard() {
  const { bookings, isLoading, error, retry } = useBookings()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  // Optimistic UI: sobrescribe el estado local antes de que el backend responda
  const [localOverrides, setLocalOverrides] = useState<Record<number, PaymentStatus>>({})

  const bookingsList: BookingAdminView[] = useMemo(
    () =>
      bookings.map((b) =>
        localOverrides[b.id] ? { ...b, payment_status: localOverrides[b.id] } : b
      ),
    [bookings, localOverrides]
  )

  // Stats derivados de los datos reales — no hardcodeados
  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    const bookingsToday = bookingsList.filter((b) => b.created_at.startsWith(today)).length

    const revenueWeek = bookingsList
      .filter((b) => b.payment_status === "completed")
      .reduce((sum, b) => sum + parseFloat(b.total_amount), 0)

    const total = bookingsList.length
    const completed = bookingsList.filter((b) => b.payment_status === "completed").length
    const conversionRate = total > 0 ? Math.round((completed / total) * 100) : 0

    return [
      { label: "Reservas Hoy",      value: String(bookingsToday), change: `de ${total} totales` },
      { label: "Ingresos Confirmados", value: `$${revenueWeek.toLocaleString("es-MX")}`, change: "solo pagos completados" },
      { label: "Tasa Conversión",   value: `${conversionRate}%`, change: `${completed} de ${total} reservas` },
    ]
  }, [bookingsList])

  function handleCancel(id: number) {
    // ⚠️ TODO: Llamar a DELETE/PATCH /api/cancelar_reserva.php antes de override local.
    // Por ahora es optimista hasta que el endpoint esté en el Codex.
    setLocalOverrides((prev) => ({ ...prev, [id]: "failed" }))
  }

  function handleWhatsApp(phone: string, client: string, tour: string) {
    const message = encodeURIComponent(
      `Hola ${client}! Te contactamos de Pegaso Expediciones respecto a tu reserva de ${tour}.`
    )
    window.open(`https://wa.me/${sanitizePhone(phone)}?text=${message}`, "_blank")
  }

  // ─── Loading ───────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#fcfaf5] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-[#4c4c4c]">
          <Loader2 className="h-10 w-10 animate-spin text-[#f26d52]" />
          <p className="text-sm">Cargando reservas…</p>
        </div>
      </div>
    )
  }

  // ─── Error ─────────────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen bg-[#fcfaf5] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 max-w-sm text-center">
          <AlertCircle className="h-10 w-10 text-red-500" />
          <p className="text-sm text-[#4c4c4c]">{error}</p>
          <Button
            variant="outline"
            onClick={retry}
            className="border-[#f26d52] text-[#f26d52] hover:bg-[#f26d52]/10"
          >
            Reintentar
          </Button>
        </div>
      </div>
    )
  }

  // ─── Dashboard ─────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#fcfaf5] flex">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-64 bg-white border-r border-gray-100
          transform transition-transform duration-200 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-gray-100">
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
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <nav className="flex-1 p-4">
            <ul className="flex flex-col gap-1">
              {sidebarItems.map((item) => (
                <li key={item.label}>
                  <button
                    className={`
                      w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors
                      ${item.active
                        ? "bg-[#fcfaf5] text-[#f26d52] font-medium"
                        : "text-[#4c4c4c] hover:bg-[#fcfaf5] hover:text-[#0f0200]"
                      }
                    `}
                  >
                    <item.icon className="h-5 w-5" />
                    <span>{item.label}</span>
                    {item.active && <ChevronRight className="h-4 w-4 ml-auto" />}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <div className="p-4 border-t border-gray-100">
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-[#fcfaf5]">
              <div className="h-10 w-10 rounded-full bg-[#f26d52]/10 flex items-center justify-center">
                <span className="text-[#f26d52] font-semibold">AD</span>
              </div>
              <div>
                <p className="font-medium text-[#0f0200] text-sm">Admin</p>
                <p className="text-xs text-[#4c4c4c]">Administrador</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gray-100 px-4 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div>
                <h2 className="font-serif text-xl lg:text-2xl font-bold text-[#0f0200]">Dashboard</h2>
                <p className="text-sm text-[#4c4c4c] hidden sm:block">Gestión de reservas y tours</p>
              </div>
            </div>
            <div className="flex items-center gap-2 lg:gap-4">
              <button className="p-2 hover:bg-gray-100 rounded-lg">
                <Search className="h-5 w-5 text-[#4c4c4c]" />
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-lg relative">
                <Bell className="h-5 w-5 text-[#4c4c4c]" />
                {bookingsList.filter((b) => b.payment_status === "pending").length > 0 && (
                  <span className="absolute top-1 right-1 h-2 w-2 bg-[#f26d52] rounded-full" />
                )}
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 p-4 lg:p-8 overflow-auto">
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {stats.map((stat) => (
              <div key={stat.label} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <p className="text-sm text-[#4c4c4c] mb-1">{stat.label}</p>
                <p className="text-3xl font-bold text-[#0f0200] mb-2">{stat.value}</p>
                <p className="text-sm text-[#f26d52]">{stat.change}</p>
              </div>
            ))}
          </div>

          {/* Reservations Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h3 className="font-serif text-xl font-bold text-[#0f0200]">Reservas Recientes</h3>
                  <p className="text-sm text-[#4c4c4c]">{bookingsList.length} reservas en total</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                    <Users className="h-3 w-3 mr-1" />
                    {bookingsList.filter((b) => b.payment_status === "completed").length} pagadas
                  </Badge>
                </div>
              </div>
            </div>

            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#fcfaf5] hover:bg-[#fcfaf5]">
                    <TableHead className="font-semibold text-[#0f0200]">Cliente</TableHead>
                    <TableHead className="font-semibold text-[#0f0200]">Expedición</TableHead>
                    <TableHead className="font-semibold text-[#0f0200]">Fecha salida</TableHead>
                    <TableHead className="font-semibold text-[#0f0200]">Estado</TableHead>
                    <TableHead className="font-semibold text-[#0f0200] text-right">Monto</TableHead>
                    <TableHead className="font-semibold text-[#0f0200] text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bookingsList.map((booking) => (
                    <TableRow key={booking.id} className="hover:bg-[#fcfaf5]/50">
                      <TableCell>
                        <div>
                          <p className="font-medium text-[#0f0200]">{booking.customer_name}</p>
                          <p className="text-sm text-[#4c4c4c]">{booking.customer_email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-[#0f0200]">{booking.expedition_name}</p>
                          <p className="text-sm text-[#4c4c4c]">{booking.num_spots} persona(s)</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-[#4c4c4c]">{booking.departure_date}</TableCell>
                      <TableCell>
                        <Badge className={statusConfig[booking.payment_status].className}>
                          {statusConfig[booking.payment_status].label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-[#0f0200]">
                        ${booking.total_amount}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              handleWhatsApp(booking.customer_phone, booking.customer_name, booking.expedition_name)
                            }
                            className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                          >
                            <MessageCircle className="h-4 w-4" />
                          </Button>
                          {booking.payment_status !== "failed" && booking.payment_status !== "refunded" && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Cancelar Reserva</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    ¿Estás seguro de cancelar la reserva de {booking.customer_name} para{" "}
                                    {booking.expedition_name}? Esta acción no se puede deshacer.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>No, mantener</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleCancel(booking.id)}
                                    className="bg-red-500 hover:bg-red-600"
                                  >
                                    Sí, cancelar
                                  </AlertDialogAction>
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

            {/* Mobile Cards */}
            <div className="lg:hidden divide-y divide-gray-100">
              {bookingsList.map((booking) => (
                <div key={booking.id} className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-medium text-[#0f0200]">{booking.customer_name}</p>
                      <p className="text-sm text-[#4c4c4c]">{booking.expedition_name}</p>
                    </div>
                    <Badge className={statusConfig[booking.payment_status].className}>
                      {statusConfig[booking.payment_status].label}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm mb-3">
                    <span className="text-[#4c4c4c]">{booking.departure_date}</span>
                    <span className="font-semibold text-[#0f0200]">${booking.total_amount}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleWhatsApp(booking.customer_phone, booking.customer_name, booking.expedition_name)
                      }
                      className="flex-1 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                    >
                      <MessageCircle className="h-4 w-4 mr-2" />
                      WhatsApp
                    </Button>
                    {booking.payment_status !== "failed" && booking.payment_status !== "refunded" && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-500 border-red-200 hover:bg-red-50"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Cancelar Reserva</AlertDialogTitle>
                            <AlertDialogDescription>
                              ¿Estás seguro de cancelar la reserva de {booking.customer_name}? Esta acción no se puede deshacer.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>No, mantener</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleCancel(booking.id)}
                              className="bg-red-500 hover:bg-red-600"
                            >
                              Sí, cancelar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
