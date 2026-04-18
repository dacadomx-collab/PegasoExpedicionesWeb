"use client"

import { useState } from "react"
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
  Users
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

type ReservationStatus = "pagado" | "interesado" | "cancelado"

interface Reservation {
  id: number
  client: string
  phone: string
  email: string
  tour: string
  date: string
  status: ReservationStatus
  amount: number
  guests: number
}

const reservations: Reservation[] = [
  { id: 1, client: "Maria Garcia", phone: "+54 9 2944 123456", email: "maria@email.com", tour: "Cabalgata por la Montana", date: "2024-03-15", status: "pagado", amount: 170, guests: 2 },
  { id: 2, client: "Juan Rodriguez", phone: "+54 9 2944 234567", email: "juan@email.com", tour: "Kayak en el Lago", date: "2024-03-16", status: "interesado", amount: 130, guests: 2 },
  { id: 3, client: "Ana Martinez", phone: "+54 9 2944 345678", email: "ana@email.com", tour: "Trekking al Glaciar", date: "2024-03-17", status: "pagado", amount: 360, guests: 3 },
  { id: 4, client: "Carlos Lopez", phone: "+54 9 2944 456789", email: "carlos@email.com", tour: "Avistamiento de Fauna", date: "2024-03-18", status: "cancelado", amount: 190, guests: 2 },
  { id: 5, client: "Laura Fernandez", phone: "+54 9 2944 567890", email: "laura@email.com", tour: "Cabalgata por la Montana", date: "2024-03-19", status: "pagado", amount: 255, guests: 3 },
  { id: 6, client: "Pedro Sanchez", phone: "+54 9 2944 678901", email: "pedro@email.com", tour: "Kayak en el Lago", date: "2024-03-20", status: "interesado", amount: 195, guests: 3 },
  { id: 7, client: "Sofia Romero", phone: "+54 9 2944 789012", email: "sofia@email.com", tour: "Trekking al Glaciar", date: "2024-03-21", status: "pagado", amount: 240, guests: 2 },
  { id: 8, client: "Diego Morales", phone: "+54 9 2944 890123", email: "diego@email.com", tour: "Avistamiento de Fauna", date: "2024-03-22", status: "interesado", amount: 95, guests: 1 },
]

const sidebarItems = [
  { icon: LayoutDashboard, label: "Dashboard", active: true },
  { icon: Calendar, label: "Calendario", active: false },
  { icon: MapPin, label: "Gestion de Tours", active: false },
  { icon: ClipboardList, label: "Reservas", active: false },
]

const statusConfig: Record<ReservationStatus, { label: string; className: string }> = {
  pagado: { label: "Pagado", className: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" },
  interesado: { label: "Interesado", className: "bg-amber-100 text-amber-700 hover:bg-amber-100" },
  cancelado: { label: "Cancelado", className: "bg-red-100 text-red-700 hover:bg-red-100" },
}

export function AdminDashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [reservationsList, setReservationsList] = useState(reservations)

  const handleCancel = (id: number) => {
    setReservationsList(prev => 
      prev.map(res => 
        res.id === id ? { ...res, status: "cancelado" as ReservationStatus } : res
      )
    )
  }

  const handleWhatsApp = (phone: string, client: string, tour: string) => {
    const message = encodeURIComponent(`Hola ${client}! Te contactamos de Pegaso Expediciones respecto a tu reserva de ${tour}.`)
    window.open(`https://wa.me/${phone.replace(/\s/g, '')}?text=${message}`, '_blank')
  }

  const stats = [
    { label: "Reservas Hoy", value: "12", change: "+3 desde ayer" },
    { label: "Ingresos Semana", value: "$4,250", change: "+15% vs semana anterior" },
    { label: "Tasa Conversion", value: "68%", change: "+5% este mes" },
  ]

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
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-64 bg-white border-r border-gray-100 
        transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex flex-col h-full">
          {/* Logo */}
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

          {/* Navigation */}
          <nav className="flex-1 p-4">
            <ul className="flex flex-col gap-1">
              {sidebarItems.map((item) => (
                <li key={item.label}>
                  <button className={`
                    w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors
                    ${item.active 
                      ? 'bg-[#fcfaf5] text-[#f26d52] font-medium' 
                      : 'text-[#4c4c4c] hover:bg-[#fcfaf5] hover:text-[#0f0200]'
                    }
                  `}>
                    <item.icon className="h-5 w-5" />
                    <span>{item.label}</span>
                    {item.active && <ChevronRight className="h-4 w-4 ml-auto" />}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {/* User */}
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
        {/* Header */}
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
                <p className="text-sm text-[#4c4c4c] hidden sm:block">Gestion de reservas y tours</p>
              </div>
            </div>
            <div className="flex items-center gap-2 lg:gap-4">
              <button className="p-2 hover:bg-gray-100 rounded-lg relative">
                <Search className="h-5 w-5 text-[#4c4c4c]" />
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-lg relative">
                <Bell className="h-5 w-5 text-[#4c4c4c]" />
                <span className="absolute top-1 right-1 h-2 w-2 bg-[#f26d52] rounded-full" />
              </button>
            </div>
          </div>
        </header>

        {/* Content */}
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
                  <p className="text-sm text-[#4c4c4c]">{reservationsList.length} reservas en total</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                    <Users className="h-3 w-3 mr-1" />
                    {reservationsList.filter(r => r.status === 'pagado').length} pagadas
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
                    <TableHead className="font-semibold text-[#0f0200]">Tour</TableHead>
                    <TableHead className="font-semibold text-[#0f0200]">Fecha</TableHead>
                    <TableHead className="font-semibold text-[#0f0200]">Estado</TableHead>
                    <TableHead className="font-semibold text-[#0f0200] text-right">Monto</TableHead>
                    <TableHead className="font-semibold text-[#0f0200] text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reservationsList.map((reservation) => (
                    <TableRow key={reservation.id} className="hover:bg-[#fcfaf5]/50">
                      <TableCell>
                        <div>
                          <p className="font-medium text-[#0f0200]">{reservation.client}</p>
                          <p className="text-sm text-[#4c4c4c]">{reservation.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-[#0f0200]">{reservation.tour}</p>
                          <p className="text-sm text-[#4c4c4c]">{reservation.guests} persona(s)</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-[#4c4c4c]">{reservation.date}</TableCell>
                      <TableCell>
                        <Badge className={statusConfig[reservation.status].className}>
                          {statusConfig[reservation.status].label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-[#0f0200]">
                        ${reservation.amount}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleWhatsApp(reservation.phone, reservation.client, reservation.tour)}
                            className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                          >
                            <MessageCircle className="h-4 w-4" />
                          </Button>
                          {reservation.status !== 'cancelado' && (
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
                                    Estas seguro de cancelar la reserva de {reservation.client} para {reservation.tour}? Esta accion no se puede deshacer.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>No, mantener</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleCancel(reservation.id)}
                                    className="bg-red-500 hover:bg-red-600"
                                  >
                                    Si, cancelar
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
              {reservationsList.map((reservation) => (
                <div key={reservation.id} className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-medium text-[#0f0200]">{reservation.client}</p>
                      <p className="text-sm text-[#4c4c4c]">{reservation.tour}</p>
                    </div>
                    <Badge className={statusConfig[reservation.status].className}>
                      {statusConfig[reservation.status].label}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm mb-3">
                    <span className="text-[#4c4c4c]">{reservation.date}</span>
                    <span className="font-semibold text-[#0f0200]">${reservation.amount}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleWhatsApp(reservation.phone, reservation.client, reservation.tour)}
                      className="flex-1 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                    >
                      <MessageCircle className="h-4 w-4 mr-2" />
                      WhatsApp
                    </Button>
                    {reservation.status !== 'cancelado' && (
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
                              Estas seguro de cancelar la reserva de {reservation.client}? Esta accion no se puede deshacer.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>No, mantener</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleCancel(reservation.id)}
                              className="bg-red-500 hover:bg-red-600"
                            >
                              Si, cancelar
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
