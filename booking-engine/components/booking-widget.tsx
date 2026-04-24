"use client"

import { useState, useMemo } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import {
  ChevronDown,
  Minus,
  Plus,
  Info,
  CreditCard,
  AlertCircle,
  Loader2,
  CalendarIcon,
  CheckCircle2,
  ArrowLeft,
  User,
  Mail,
  Phone,
  MessageCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { useExpeditions } from "@/hooks/use-expeditions"
import { createPaypalOrder } from "@/lib/api"
import type { Expedition } from "@/lib/types"

// ── Constante de contacto ─────────────────────────────────────
// ⚠️ ARQUITECTO: configurar NEXT_PUBLIC_CONTACT_PHONE en .env.local
// con el número real de Daniel (formato E.164 sin "+": 521XXXXXXXXXX).
// Registrado en Codex §02 — Constantes de Contacto.
const DANIEL_WHATSAPP =
  process.env.NEXT_PUBLIC_CONTACT_PHONE ?? "521XXXXXXXXXX"

// ── Zod Schema ────────────────────────────────────────────────
const customerSchema = z.object({
  customerName: z.string().trim().min(3, "Mínimo 3 caracteres"),
  customerEmail: z.string().trim().email("Correo electrónico inválido"),
  customerPhone: z.string().trim().refine(
    (val) => val.replace(/\D/g, "").length >= 7,
    "Mínimo 7 dígitos numéricos (WhatsApp)"
  ),
})

type CustomerFields = z.infer<typeof customerSchema>

type Step = "select" | "customer" | "processing" | "success"

// ── Utilidades de fecha ───────────────────────────────────────

/**
 * True si la fecha (YYYY-MM-DD) es hoy o mañana.
 * Dispara el flujo de contacto directo por WhatsApp en lugar del pago online.
 * Regla registrada en Codex §02 — Constantes de Contacto.
 */
function isUrgentDate(dateStr: string): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  return (
    dateStr === format(today, "yyyy-MM-dd") ||
    dateStr === format(tomorrow, "yyyy-MM-dd")
  )
}

/** Construye la URL wa.me con mensaje pre-llenado para Daniel. */
function buildWhatsAppUrl(
  expedition: Expedition,
  departureDate: string,
  numSpots: number
): string {
  const dateLabel = format(new Date(departureDate + "T12:00:00"), "PPP", { locale: es })
  const text = encodeURIComponent(
    `Hola Daniel, quiero reservar ${numSpots} lugar${numSpots > 1 ? "es" : ""} ` +
      `en la expedición "${expedition.name}" el ${dateLabel}. ` +
      `¿Tienen disponibilidad?`
  )
  return `https://wa.me/${DANIEL_WHATSAPP}?text=${text}`
}

// ── Componente principal ──────────────────────────────────────

export function BookingWidget() {
  const { expeditions, isLoading, error, retry } = useExpeditions()

  // ── Step state ─────────────────────────────────────────────
  const [step, setStep] = useState<Step>("select")

  // ── Selection state ────────────────────────────────────────
  const [selectedExpedition, setSelectedExpedition] = useState<Expedition | null>(null)
  // calendarPickedDate: Date | undefined — objeto Date para el Calendar
  const [calendarPickedDate, setCalendarPickedDate] = useState<Date | undefined>(undefined)
  // selectedDepartureDate: "YYYY-MM-DD" | null — string para el payload y lógica
  const [selectedDepartureDate, setSelectedDepartureDate] = useState<string | null>(null)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [tourDropdownOpen, setTourDropdownOpen] = useState(false)
  const [numSpots, setNumSpots] = useState(1)

  // ── Payment state ──────────────────────────────────────────
  const [paypalOrderId, setPaypalOrderId] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // ── Form ───────────────────────────────────────────────────
  const form = useForm<CustomerFields>({
    resolver: zodResolver(customerSchema),
    defaultValues: { customerName: "", customerEmail: "", customerPhone: "" },
  })

  // ── Derived values ─────────────────────────────────────────

  // Set de strings "YYYY-MM-DD" para lookup O(1) en isDateDisabled
  const blockedDateStrings = useMemo(
    () => new Set(selectedExpedition?.blocked_dates?.map((b) => b.date) ?? []),
    [selectedExpedition]
  )

  const maxSpots = selectedExpedition?.daily_capacity ?? 20

  // Total estimado — solo visual; el total vinculante lo calcula el backend
  const estimatedTotal = useMemo(() => {
    if (!selectedExpedition || !selectedDepartureDate) return null
    return (parseFloat(selectedExpedition.price) * numSpots).toFixed(2)
  }, [selectedExpedition, selectedDepartureDate, numSpots])

  // ¿La fecha elegida requiere contacto urgente?
  const urgent = selectedDepartureDate ? isUrgentDate(selectedDepartureDate) : false

  // ── Calendar: reglas de deshabilitado ──────────────────────
  /**
   * Deshabilita:
   *   1. Días anteriores a hoy.
   *   2. Días en blocked_dates de la expedición seleccionada.
   * Si no hay expedición seleccionada, solo bloquea el pasado.
   * El Calendar se renderiza siempre (sin esperar datos de fechas).
   */
  function isDateDisabled(day: Date): boolean {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (day < today) return true
    return blockedDateStrings.has(format(day, "yyyy-MM-dd"))
  }

  // ── Handlers ───────────────────────────────────────────────
  function handleExpeditionSelect(expedition: Expedition) {
    setSelectedExpedition(expedition)
    setCalendarPickedDate(undefined)
    setSelectedDepartureDate(null)
    setNumSpots(1)
    setTourDropdownOpen(false)
  }

  function handleCalendarSelect(day: Date | undefined) {
    if (!day) return
    setCalendarPickedDate(day)
    setSelectedDepartureDate(format(day, "yyyy-MM-dd"))
    setCalendarOpen(false)
  }

  /** Fase 1: crea la orden en el backend PHP. */
  async function onCustomerSubmit(data: CustomerFields) {
    if (!selectedExpedition || !selectedDepartureDate) return
    setSubmitError(null)
    setStep("processing")

    try {
      const result = await createPaypalOrder({
        expedition_id: selectedExpedition.id,
        departure_date: selectedDepartureDate,
        num_spots: numSpots,
        customer_name: data.customerName,
        customer_email: data.customerEmail.toLowerCase(),
        customer_phone: data.customerPhone,
      })
      setPaypalOrderId(result.paypal_order_id)
      setStep("success")
    } catch (err) {
      // 422 → mensaje de validación del backend. 500/red → fallback genérico.
      setSubmitError(
        err instanceof Error
          ? err.message
          : "No se pudo crear la orden de pago. Intenta de nuevo."
      )
      setStep("customer")
    }
  }

  function resetWidget() {
    setStep("select")
    setSelectedExpedition(null)
    setCalendarPickedDate(undefined)
    setSelectedDepartureDate(null)
    setNumSpots(1)
    setPaypalOrderId(null)
    setSubmitError(null)
    form.reset()
  }

  // ── Loading ────────────────────────────────────────────────
  if (isLoading) {
    return (
      <WidgetShell>
        <div className="p-6 flex flex-col items-center gap-4 text-[#4c4c4c]">
          <Loader2 className="h-8 w-8 animate-spin text-[#f26d52]" />
          <p className="text-sm">Cargando expediciones…</p>
        </div>
      </WidgetShell>
    )
  }

  // ── Error de carga ─────────────────────────────────────────
  if (error) {
    return (
      <WidgetShell>
        <div className="p-6 flex flex-col items-center gap-4">
          <AlertCircle className="h-8 w-8 text-red-500" />
          <p className="text-sm text-[#4c4c4c] text-center">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={retry}
            className="border-[#f26d52] text-[#f26d52] hover:bg-[#f26d52]/10"
          >
            Reintentar
          </Button>
        </div>
      </WidgetShell>
    )
  }

  // ── Processing ─────────────────────────────────────────────
  if (step === "processing") {
    return (
      <WidgetShell>
        <div className="p-8 flex flex-col items-center gap-4 text-[#4c4c4c]">
          <Loader2 className="h-10 w-10 animate-spin text-[#f26d52]" />
          <p className="text-sm font-medium">Creando tu reserva…</p>
          <p className="text-xs text-center">
            Verificando disponibilidad y creando la orden de pago.
          </p>
        </div>
      </WidgetShell>
    )
  }

  // ── Success ────────────────────────────────────────────────
  if (step === "success" && paypalOrderId) {
    return (
      <WidgetShell>
        <div className="p-6 flex flex-col items-center gap-5 text-center">
          <CheckCircle2 className="h-12 w-12 text-green-500" />
          <div>
            <p className="font-serif text-xl font-bold text-[#0f0200]">
              ¡Orden creada!
            </p>
            <p className="text-sm text-[#4c4c4c] mt-1">
              Tu reserva está pendiente de pago.
            </p>
          </div>

          <div className="w-full bg-[#fcfaf5] rounded-xl p-4 text-left space-y-1">
            <p className="text-xs text-[#4c4c4c]">Expedición</p>
            <p className="font-medium text-[#0f0200]">{selectedExpedition?.name}</p>
            <p className="text-xs text-[#4c4c4c] mt-2">Fecha</p>
            <p className="font-medium text-[#0f0200]">
              {calendarPickedDate
                ? format(calendarPickedDate, "PPP", { locale: es })
                : selectedDepartureDate}
            </p>
            <p className="text-xs text-[#4c4c4c] mt-2">Personas</p>
            <p className="font-medium text-[#0f0200]">{numSpots}</p>
          </div>

          {/* Fase 2: botón PayPal JS SDK — pendiente de integración */}
          <div className="w-full border border-dashed border-[#f26d52]/40 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-[#f26d52]">
              <CreditCard className="h-5 w-5 shrink-0" />
              <span className="text-sm font-semibold">Aprobación PayPal (Fase 2)</span>
            </div>
            <p className="text-xs text-[#4c4c4c]">
              ID de orden:{" "}
              <span className="font-mono text-[#0f0200]">{paypalOrderId}</span>
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={resetWidget}
            className="border-[#4c4c4c]/30 text-[#4c4c4c] hover:bg-gray-50"
          >
            Nueva reserva
          </Button>
        </div>
      </WidgetShell>
    )
  }

  // ── Customer Form (Step 2) ─────────────────────────────────
  if (step === "customer") {
    return (
      <WidgetShell>
        <div className="p-6 flex flex-col gap-5">
          <button
            onClick={() => setStep("select")}
            className="flex items-center gap-1 text-sm text-[#4c4c4c] hover:text-[#0f0200] transition-colors w-fit"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </button>

          <div className="bg-[#fcfaf5] rounded-xl p-4 space-y-1">
            <p className="font-semibold text-[#0f0200]">{selectedExpedition?.name}</p>
            <p className="text-sm text-[#4c4c4c]">
              {calendarPickedDate
                ? format(calendarPickedDate, "PPP", { locale: es })
                : selectedDepartureDate}
              {" · "}{numSpots} persona(s)
            </p>
            <p className="text-sm font-medium text-[#f26d52]">
              Total estimado: ${estimatedTotal ?? "—"}
            </p>
            <p className="text-xs text-[#4c4c4c]">
              El servidor confirma el total definitivo al procesar el pago.
            </p>
          </div>

          {submitError && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
              <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{submitError}</p>
            </div>
          )}

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onCustomerSubmit)}
              className="flex flex-col gap-4"
            >
              <FormField
                control={form.control}
                name="customerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5 text-sm font-medium text-[#0f0200]">
                      <User className="h-4 w-4 text-[#4c4c4c]" />
                      Nombre completo
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ana García López"
                        autoComplete="name"
                        className="border-gray-200 focus:border-[#f26d52] focus:ring-[#f26d52]/20"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="customerEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5 text-sm font-medium text-[#0f0200]">
                      <Mail className="h-4 w-4 text-[#4c4c4c]" />
                      Correo electrónico
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="ana@ejemplo.com"
                        autoComplete="email"
                        inputMode="email"
                        className="border-gray-200 focus:border-[#f26d52] focus:ring-[#f26d52]/20"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="customerPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5 text-sm font-medium text-[#0f0200]">
                      <Phone className="h-4 w-4 text-[#4c4c4c]" />
                      WhatsApp / Teléfono
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="tel"
                        placeholder="+52 664 123 4567"
                        autoComplete="tel"
                        inputMode="tel"
                        className="border-gray-200 focus:border-[#f26d52] focus:ring-[#f26d52]/20"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full h-14 text-lg font-semibold bg-[#f26d52] hover:bg-[#0f0200] text-white rounded-lg transition-colors mt-2"
              >
                <CreditCard className="mr-2 h-5 w-5" />
                Crear Orden y Pagar con PayPal
              </Button>
            </form>
          </Form>
        </div>
      </WidgetShell>
    )
  }

  // ── Step 1: Selección de expedición / fecha / personas ────────
  return (
    <WidgetShell>
      <div className="p-6 flex flex-col gap-5">

        {/* ── Selector de Expedición ── */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-[#0f0200]">Expedición</label>
          <Popover open={tourDropdownOpen} onOpenChange={setTourDropdownOpen}>
            <PopoverTrigger asChild>
              <button className="w-full flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-lg text-left hover:border-[#f26d52] focus:outline-none focus:ring-2 focus:ring-[#f26d52]/20 focus:border-[#f26d52] transition-colors">
                <span className="text-[#0f0200] font-medium">
                  {selectedExpedition?.name ?? "Elige una expedición"}
                </span>
                <ChevronDown className="h-4 w-4 text-[#4c4c4c]" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="w-[var(--radix-popover-trigger-width)] p-0"
              align="start"
            >
              <div className="flex flex-col">
                {expeditions.map((exp) => (
                  <button
                    key={exp.id}
                    onClick={() => handleExpeditionSelect(exp)}
                    className={`flex items-center justify-between px-4 py-3 text-left hover:bg-[#fcfaf5] transition-colors ${
                      selectedExpedition?.id === exp.id ? "bg-[#fcfaf5]" : ""
                    }`}
                  >
                    <div>
                      <p className="font-medium text-[#0f0200]">{exp.name}</p>
                      <p className="text-sm text-[#4c4c4c]">
                        Hasta {exp.daily_capacity} personas/día
                      </p>
                    </div>
                    <span className="text-[#f26d52] font-semibold">
                      ${exp.price}
                    </span>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* ── Calendar siempre visible ──
             Solo bloquea pasado + blocked_dates de la expedición.
             No depende de un array de fechas predefinidas. */}
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-1.5 text-sm font-medium text-[#0f0200]">
            <CalendarIcon className="h-4 w-4 text-[#4c4c4c]" />
            Fecha de salida
          </label>
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <button className="w-full flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-lg text-left hover:border-[#f26d52] focus:outline-none focus:ring-2 focus:ring-[#f26d52]/20 focus:border-[#f26d52] transition-colors">
                <span className="text-[#0f0200]">
                  {calendarPickedDate
                    ? format(calendarPickedDate, "PPP", { locale: es })
                    : "Selecciona una fecha"}
                </span>
                <CalendarIcon className="h-4 w-4 text-[#4c4c4c]" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={calendarPickedDate}
                onSelect={handleCalendarSelect}
                disabled={isDateDisabled}
                locale={es}
                initialFocus
              />
              {/* Aviso contextual cuando hay días bloqueados */}
              {selectedExpedition && (selectedExpedition.blocked_dates?.length ?? 0) > 0 && (
                <p className="text-xs text-[#4c4c4c] px-3 pb-3">
                  Días en gris: sin disponibilidad para esta expedición.
                </p>
              )}
            </PopoverContent>
          </Popover>
        </div>

        {/* ── Contador de Personas ── */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-[#0f0200]">Personas</p>
            <p className="text-sm text-[#4c4c4c]">
              {selectedExpedition
                ? `$${selectedExpedition.price} por persona · máx. ${maxSpots}/día`
                : "—"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setNumSpots(Math.max(1, numSpots - 1))}
              disabled={numSpots <= 1}
              className="h-9 w-9 rounded-full border border-gray-300 flex items-center justify-center hover:border-[#f26d52] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Minus className="h-4 w-4 text-[#4c4c4c]" />
            </button>
            <span className="w-8 text-center font-semibold text-[#0f0200]">
              {numSpots}
            </span>
            <button
              onClick={() => setNumSpots(Math.min(maxSpots, numSpots + 1))}
              disabled={numSpots >= maxSpots}
              className="h-9 w-9 rounded-full border border-gray-300 flex items-center justify-center hover:border-[#f26d52] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Plus className="h-4 w-4 text-[#4c4c4c]" />
            </button>
          </div>
        </div>

        {/* ── Descripción ── */}
        {selectedExpedition?.description && (
          <div className="bg-[#fcfaf5] rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-[#f26d52] shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-[#0f0200] text-sm mb-1">Descripción</p>
                <p className="text-sm text-[#4c4c4c]">
                  {selectedExpedition.description}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Resumen de precio ── */}
        {selectedDepartureDate && selectedExpedition && (
          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[#4c4c4c]">
                {numSpots} persona(s) × ${selectedExpedition.price}
              </span>
              <span className="text-[#0f0200] font-medium">
                ${estimatedTotal}
              </span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <span className="font-semibold text-[#0f0200]">Total estimado</span>
              <span className="text-2xl font-bold text-[#0f0200]">
                ${estimatedTotal}
              </span>
            </div>
            <p className="text-xs text-[#4c4c4c] mt-1 text-right">
              El total definitivo lo confirma el servidor al crear la orden PayPal.
            </p>
          </div>
        )}

        {/* ── CTA: WhatsApp (urgente hoy/mañana) o Continuar ── */}
        {urgent && selectedDepartureDate && selectedExpedition ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
              <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
                Las salidas de <strong>hoy y mañana</strong> requieren confirmación
                directa. Contáctanos por WhatsApp para asegurar tu lugar.
              </p>
            </div>
            <a
              href={buildWhatsAppUrl(selectedExpedition, selectedDepartureDate, numSpots)}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full h-14 text-lg font-semibold bg-[#25D366] hover:bg-[#1ebe5d] text-white rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <MessageCircle className="h-5 w-5" />
              Contactar a Daniel por WhatsApp
            </a>
          </div>
        ) : (
          <Button
            className="w-full h-14 text-lg font-semibold bg-[#f26d52] hover:bg-[#0f0200] text-white rounded-lg transition-colors"
            disabled={!selectedExpedition || !selectedDepartureDate}
            onClick={() => setStep("customer")}
          >
            <CreditCard className="mr-2 h-5 w-5" />
            Continuar con mis datos
          </Button>
        )}
      </div>
    </WidgetShell>
  )
}

// ── Shell reutilizable ─────────────────────────────────────────
function WidgetShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
      <div className="p-6 border-b border-gray-100">
        <h2 className="font-serif text-2xl font-bold text-[#0f0200]">
          Reserva tu Aventura
        </h2>
        <p className="text-[#4c4c4c] mt-1 text-sm">
          Selecciona tu experiencia y fecha
        </p>
      </div>
      {children}
    </div>
  )
}
