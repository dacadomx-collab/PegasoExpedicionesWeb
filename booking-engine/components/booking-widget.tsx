"use client"

import { useState, useMemo, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import {
  ChevronDown, Minus, Plus, Info, CreditCard, AlertCircle,
  Loader2, CalendarIcon, CheckCircle2, ArrowLeft, User, Mail,
  Phone, MessageCircle, ShieldOff,
} from "lucide-react"
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js"
import { Button }   from "@/components/ui/button"
import { Input }    from "@/components/ui/input"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form"
import { useExpeditions }     from "@/hooks/use-expeditions"
import { useSalesPause }      from "@/hooks/use-sales-pause"
import { usePublicSettings }  from "@/hooks/use-public-settings"
import { WeatherBadge }       from "@/components/weather-badge"
import { createPaypalOrder, confirmBooking } from "@/lib/api"
import type { Expedition, BookingConfirmation } from "@/lib/types"

// ── Constantes ────────────────────────────────────────────────
// PayPal client ID y WhatsApp se leen de la BD vía usePublicSettings.
// Los valores de .env.local actúan como fallback si la BD no responde.
const CUSTOMER_STORAGE = "pegaso_customer"

// ── Zod Schema ────────────────────────────────────────────────
const customerSchema = z.object({
  customerName:  z.string().trim().min(3, "Mínimo 3 caracteres"),
  customerEmail: z.string().trim().email("Correo electrónico inválido"),
  customerPhone: z.string().trim().refine(
    (v) => v.replace(/\D/g, "").length >= 7,
    "Mínimo 7 dígitos (WhatsApp)"
  ),
})
type CustomerFields = z.infer<typeof customerSchema>

type Step = "select" | "customer" | "processing" | "payment" | "confirming" | "confirmed"

// ── Utilidades ────────────────────────────────────────────────
function isUrgentDate(dateStr: string): boolean {
  const today    = new Date(); today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
  return dateStr === format(today, "yyyy-MM-dd") || dateStr === format(tomorrow, "yyyy-MM-dd")
}

function buildWhatsAppUrl(exp: Expedition, date: string, spots: number, phone: string): string {
  const label = format(new Date(date + "T12:00:00"), "PPP", { locale: es })
  return `https://wa.me/${phone}?text=${encodeURIComponent(
    `Hola Daniel, quiero reservar ${spots} lugar${spots > 1 ? "es" : ""} en "${exp.name}" el ${label}. ¿Tienen disponibilidad?`
  )}`
}

// ── Componente ────────────────────────────────────────────────
export function BookingWidget() {
  const { expeditions, isLoading, error, retry } = useExpeditions()
  const { isPaused, isReady: pauseReady }        = useSalesPause()
  const { settings: pubSettings }                = usePublicSettings()

  // Credenciales resueltas: BD primero, .env como fallback (ya en defaults del hook)
  const paypalClientId = pubSettings?.paypal_client_id ?? ""
  const whatsappPhone  = pubSettings?.whatsapp_phone   ?? ""

  const [step, setStep]     = useState<Step>("select")
  const [selectedExpedition, setSelectedExpedition] = useState<Expedition | null>(null)
  const [calendarPickedDate, setCalendarPickedDate] = useState<Date | undefined>()
  const [selectedDepartureDate, setSelectedDepartureDate] = useState<string | null>(null)
  const [calendarOpen, setCalendarOpen]   = useState(false)
  const [tourDropdownOpen, setTourDropdownOpen] = useState(false)
  const [numSpots, setNumSpots]           = useState(1)
  const [paypalOrderId, setPaypalOrderId] = useState<string | null>(null)
  const [confirmation, setConfirmation]   = useState<BookingConfirmation | null>(null)
  const [submitError, setSubmitError]     = useState<string | null>(null)
  const [paymentError, setPaymentError]   = useState<string | null>(null)

  const form = useForm<CustomerFields>({
    resolver: zodResolver(customerSchema),
    defaultValues: { customerName: "", customerEmail: "", customerPhone: "" },
  })

  // ── Autofill Mágico: recuperar datos del cliente desde localStorage ──
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CUSTOMER_STORAGE)
      if (!saved) return
      const { customerName, customerEmail, customerPhone } = JSON.parse(saved) as Partial<CustomerFields>
      if (customerName)  form.setValue("customerName",  customerName)
      if (customerEmail) form.setValue("customerEmail", customerEmail)
      if (customerPhone) form.setValue("customerPhone", customerPhone)
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Solo en mount — form es estable

  // ── Derivados ─────────────────────────────────────────────
  const blockedDateStrings = useMemo(
    () => new Set(selectedExpedition?.blocked_dates?.map((b) => b.date) ?? []),
    [selectedExpedition]
  )
  const maxSpots    = selectedExpedition?.daily_capacity ?? 20
  const urgent      = selectedDepartureDate ? isUrgentDate(selectedDepartureDate) : false
  const estimatedTotal = useMemo(() => {
    if (!selectedExpedition || !selectedDepartureDate) return null
    return (parseFloat(selectedExpedition.price) * numSpots).toFixed(2)
  }, [selectedExpedition, selectedDepartureDate, numSpots])

  function isDateDisabled(day: Date): boolean {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    if (day < today) return true
    return blockedDateStrings.has(format(day, "yyyy-MM-dd"))
  }

  function handleExpeditionSelect(exp: Expedition) {
    setSelectedExpedition(exp)
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

  // Fase 1: crear orden PayPal
  async function onCustomerSubmit(data: CustomerFields) {
    if (!selectedExpedition || !selectedDepartureDate) return

    // Autofill Mágico: persiste para futuras compras
    try {
      localStorage.setItem(CUSTOMER_STORAGE, JSON.stringify({
        customerName:  data.customerName,
        customerEmail: data.customerEmail,
        customerPhone: data.customerPhone,
      }))
    } catch {}

    setSubmitError(null)
    setStep("processing")
    try {
      const result = await createPaypalOrder({
        expedition_id:  selectedExpedition.id,
        departure_date: selectedDepartureDate,
        num_spots:      numSpots,
        customer_name:  data.customerName,
        customer_email: data.customerEmail.toLowerCase(),
        customer_phone: data.customerPhone,
      })
      setPaypalOrderId(result.paypal_order_id)
      setStep("payment")
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "No se pudo crear la orden. Intenta de nuevo.")
      setStep("customer")
    }
  }

  // Fase 2: confirmar captura PayPal
  async function handlePaypalApprove() {
    if (!paypalOrderId) return
    setPaymentError(null)
    setStep("confirming")
    try {
      const data = await confirmBooking(paypalOrderId)
      setConfirmation(data)
      setStep("confirmed")
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : "Error al confirmar. Contacta a soporte.")
      setStep("payment")
    }
  }

  function resetWidget() {
    setStep("select")
    setSelectedExpedition(null)
    setCalendarPickedDate(undefined)
    setSelectedDepartureDate(null)
    setNumSpots(1)
    setPaypalOrderId(null)
    setConfirmation(null)
    setSubmitError(null)
    setPaymentError(null)
    form.reset()
  }

  // ── Estados de carga / error ─────────────────────────────
  if (isLoading) return (
    <WidgetShell isPaused={false}>
      <div className="p-6 flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-[#f26d52]" />
        <p className="text-sm text-[#4c4c4c]">Cargando expediciones…</p>
      </div>
    </WidgetShell>
  )

  if (error) return (
    <WidgetShell isPaused={false}>
      <div className="p-6 flex flex-col items-center gap-4">
        <AlertCircle className="h-8 w-8 text-red-500" />
        <p className="text-sm text-[#4c4c4c] text-center">{error}</p>
        <Button variant="outline" size="sm" onClick={retry}
          className="border-[#f26d52] text-[#f26d52] hover:bg-[#f26d52]/10">
          Reintentar
        </Button>
      </div>
    </WidgetShell>
  )

  if (step === "processing") return (
    <WidgetShell isPaused={false}>
      <div className="p-8 flex flex-col items-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-[#f26d52]" />
        <p className="text-sm font-medium text-[#4c4c4c]">Preparando tu orden de pago…</p>
      </div>
    </WidgetShell>
  )

  if (step === "confirming") return (
    <WidgetShell isPaused={false}>
      <div className="p-8 flex flex-col items-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-[#f26d52]" />
        <p className="text-sm font-medium text-[#4c4c4c]">Confirmando tu pago con PayPal…</p>
        <p className="text-xs text-[#4c4c4c]">No cierres esta ventana.</p>
      </div>
    </WidgetShell>
  )

  // ── Paso: Payment (botones PayPal reales) ────────────────
  if (step === "payment" && paypalOrderId) return (
    <WidgetShell isPaused={false}>
      <div className="p-6 flex flex-col gap-5">
        <div className="bg-[#fcfaf5] rounded-xl p-4 space-y-1">
          <p className="font-semibold text-[#0f0200]">{selectedExpedition?.name}</p>
          <p className="text-sm text-[#4c4c4c]">
            {calendarPickedDate ? format(calendarPickedDate, "PPP", { locale: es }) : selectedDepartureDate}
            {" · "}{numSpots} persona(s)
          </p>
          <p className="text-xl font-bold text-[#f26d52]">${estimatedTotal} MXN</p>
        </div>

        {paymentError && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-3">
            <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{paymentError}</p>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-xs text-center font-medium text-[#4c4c4c]">
            Selecciona cómo deseas pagar
          </p>

          {paypalClientId ? (
            <PayPalScriptProvider options={{
              clientId:       paypalClientId,
              currency:       "MXN",
              intent:         "capture",
              components:     "buttons",
              // Habilita tarjetas, Google Pay y otros métodos disponibles por región
              enableFunding:  "card,venmo,paylater",
            }}>
              <PayPalButtons
                style={{ layout: "vertical", shape: "rect", color: "gold", label: "pay" }}
                // Al no fijar fundingSource, el SDK muestra todos los métodos habilitados:
                // PayPal, Tarjeta de crédito/débito, Google Pay (si está disponible)
                createOrder={() => Promise.resolve(paypalOrderId)}
                onApprove={handlePaypalApprove}
                onError={() =>
                  setPaymentError("PayPal reportó un error. Intenta de nuevo o usa otro método.")
                }
              />
            </PayPalScriptProvider>
          ) : (
            <div className="border border-dashed border-amber-300 rounded-xl p-4 bg-amber-50 text-center">
              <p className="text-sm font-medium text-amber-700">PayPal no configurado</p>
              <p className="text-xs text-amber-600 mt-1">
                Añade <code className="bg-amber-100 px-1 rounded">NEXT_PUBLIC_PAYPAL_CLIENT_ID</code> a .env.local
              </p>
            </div>
          )}
        </div>

        <button onClick={() => setStep("customer")}
          className="flex items-center justify-center gap-1 text-xs text-[#4c4c4c] hover:text-[#0f0200] transition-colors">
          <ArrowLeft className="h-3 w-3" /> Volver a mis datos
        </button>
      </div>
    </WidgetShell>
  )

  // ── Confirmación final ────────────────────────────────────
  if (step === "confirmed" && confirmation) return (
    <WidgetShell isPaused={false}>
      <div className="p-6 flex flex-col items-center gap-5 text-center">
        <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center">
          <CheckCircle2 className="h-9 w-9 text-emerald-500" />
        </div>
        <div>
          <p className="font-serif text-xl font-bold text-[#0f0200]">¡Reserva Confirmada!</p>
          <p className="text-sm text-[#4c4c4c] mt-1">Pago procesado exitosamente.</p>
        </div>

        <div className="w-full bg-[#fcfaf5] rounded-xl p-4 text-left space-y-3">
          {(
            [
              { label: "Expedición",    value: confirmation.expedition_name },
              { label: "Cliente",       value: confirmation.customer_name },
              { label: "Fecha",         value: format(new Date(confirmation.departure_date + "T12:00:00"), "PPP", { locale: es }) },
              { label: "Personas",      value: String(confirmation.num_spots) },
              { label: "Total pagado",  value: `$${confirmation.total_amount} MXN` },
              { label: "ID transacción",value: confirmation.paypal_transaction_id, mono: true },
            ] as { label: string; value: string; mono?: boolean }[]
          ).map(({ label, value, mono }) => (
            <div key={label} className="flex justify-between items-baseline gap-2">
              <span className="text-xs text-[#4c4c4c] shrink-0">{label}</span>
              <span className={`text-sm font-medium text-[#0f0200] text-right truncate max-w-[180px] ${mono ? "font-mono text-xs" : ""}`}>
                {value}
              </span>
            </div>
          ))}
        </div>

        <p className="text-xs text-[#4c4c4c]">
          Conserva tu ID de transacción. Recibirás confirmación por correo.
        </p>
        <Button variant="outline" size="sm" onClick={resetWidget}
          className="border-[#4c4c4c]/30 text-[#4c4c4c] hover:bg-gray-50">
          Nueva reserva
        </Button>
      </div>
    </WidgetShell>
  )

  // ── Formulario del cliente (Paso 2) ──────────────────────
  if (step === "customer") return (
    <WidgetShell isPaused={false}>
      <div className="p-6 flex flex-col gap-5">
        <button onClick={() => setStep("select")}
          className="flex items-center gap-1 text-sm text-[#4c4c4c] hover:text-[#0f0200] w-fit">
          <ArrowLeft className="h-4 w-4" /> Volver
        </button>

        <div className="bg-[#fcfaf5] rounded-xl p-4 space-y-1">
          <p className="font-semibold text-[#0f0200]">{selectedExpedition?.name}</p>
          <p className="text-sm text-[#4c4c4c]">
            {calendarPickedDate ? format(calendarPickedDate, "PPP", { locale: es }) : selectedDepartureDate}
            {" · "}{numSpots} persona(s)
          </p>
          <p className="text-sm font-medium text-[#f26d52]">Total estimado: ${estimatedTotal ?? "—"}</p>
          <p className="text-xs text-[#4c4c4c]">El servidor confirma el total definitivo al procesar.</p>
        </div>

        {submitError && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
            <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{submitError}</p>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onCustomerSubmit)} className="flex flex-col gap-4">
            {(["customerName", "customerEmail", "customerPhone"] as const).map((name) => {
              const cfg = {
                customerName:  { label: "Nombre completo",    icon: User,  type: "text",  placeholder: "Ana García López", autocomplete: "name",  inputMode: "text"  as const },
                customerEmail: { label: "Correo electrónico", icon: Mail,  type: "email", placeholder: "ana@ejemplo.com",  autocomplete: "email", inputMode: "email" as const },
                customerPhone: { label: "WhatsApp / Teléfono",icon: Phone, type: "tel",   placeholder: "+52 664 123 4567", autocomplete: "tel",   inputMode: "tel"   as const },
              }[name]
              const Icon = cfg.icon
              return (
                <FormField key={name} control={form.control} name={name}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1.5 text-sm font-medium text-[#0f0200]">
                        <Icon className="h-4 w-4 text-[#4c4c4c]" />{cfg.label}
                      </FormLabel>
                      <FormControl>
                        <Input type={cfg.type} placeholder={cfg.placeholder}
                          autoComplete={cfg.autocomplete} inputMode={cfg.inputMode}
                          className="border-gray-200 focus:border-[#f26d52] focus:ring-[#f26d52]/20"
                          {...field} />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />
              )
            })}
            <Button type="submit"
              className="w-full h-14 text-lg font-semibold bg-[#f26d52] hover:bg-[#0f0200] text-white rounded-lg mt-2">
              <CreditCard className="mr-2 h-5 w-5" /> Continuar al pago
            </Button>
          </form>
        </Form>
      </div>
    </WidgetShell>
  )

  // ── Paso 1: Selección de expedición / fecha / personas ────
  return (
    <WidgetShell isPaused={pauseReady && isPaused}>
      <div className="p-6 flex flex-col gap-5">
        {/* Expedición */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-[#0f0200]">Expedición</label>
          <Popover open={tourDropdownOpen} onOpenChange={setTourDropdownOpen}>
            <PopoverTrigger asChild>
              <button className="w-full flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-lg text-left hover:border-[#f26d52] focus:outline-none focus:ring-2 focus:ring-[#f26d52]/20 transition-colors">
                <span className="text-[#0f0200] font-medium">
                  {selectedExpedition?.name ?? "Elige una expedición"}
                </span>
                <ChevronDown className="h-4 w-4 text-[#4c4c4c]" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
              <div className="flex flex-col">
                {expeditions.map((exp) => (
                  <button key={exp.id} onClick={() => handleExpeditionSelect(exp)}
                    className={`flex items-center justify-between px-4 py-3 text-left hover:bg-[#fcfaf5] transition-colors ${selectedExpedition?.id === exp.id ? "bg-[#fcfaf5]" : ""}`}>
                    <div>
                      <p className="font-medium text-[#0f0200]">{exp.name}</p>
                      <p className="text-sm text-[#4c4c4c]">Hasta {exp.daily_capacity} personas/día</p>
                    </div>
                    <span className="text-[#f26d52] font-semibold">${exp.price}</span>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Fecha + Clima */}
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-1.5 text-sm font-medium text-[#0f0200]">
            <CalendarIcon className="h-4 w-4 text-[#4c4c4c]" /> Fecha de salida
          </label>
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <button className="w-full flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-lg text-left hover:border-[#f26d52] focus:outline-none focus:ring-2 focus:ring-[#f26d52]/20 transition-colors">
                <span className="text-[#0f0200]">
                  {calendarPickedDate ? format(calendarPickedDate, "PPP", { locale: es }) : "Selecciona una fecha"}
                </span>
                <CalendarIcon className="h-4 w-4 text-[#4c4c4c]" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={calendarPickedDate}
                onSelect={handleCalendarSelect} disabled={isDateDisabled}
                locale={es} initialFocus />
              {selectedExpedition && (selectedExpedition.blocked_dates?.length ?? 0) > 0 && (
                <p className="text-xs text-[#4c4c4c] px-3 pb-3">
                  Días en gris: sin disponibilidad para esta expedición.
                </p>
              )}
            </PopoverContent>
          </Popover>

          {/* Badge de Clima en Tiempo Real */}
          {selectedDepartureDate && (
            <WeatherBadge dateStr={selectedDepartureDate} />
          )}
        </div>

        {/* Personas */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-[#0f0200]">Personas</p>
            <p className="text-sm text-[#4c4c4c]">
              {selectedExpedition ? `$${selectedExpedition.price} / persona · máx. ${maxSpots}/día` : "—"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setNumSpots(Math.max(1, numSpots - 1))} disabled={numSpots <= 1}
              className="h-9 w-9 rounded-full border border-gray-300 flex items-center justify-center hover:border-[#f26d52] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <Minus className="h-4 w-4 text-[#4c4c4c]" />
            </button>
            <span className="w-8 text-center font-semibold text-[#0f0200]">{numSpots}</span>
            <button onClick={() => setNumSpots(Math.min(maxSpots, numSpots + 1))} disabled={numSpots >= maxSpots}
              className="h-9 w-9 rounded-full border border-gray-300 flex items-center justify-center hover:border-[#f26d52] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <Plus className="h-4 w-4 text-[#4c4c4c]" />
            </button>
          </div>
        </div>

        {/* Descripción */}
        {selectedExpedition?.description && (
          <div className="bg-[#fcfaf5] rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-[#f26d52] shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-[#0f0200] text-sm mb-1">Descripción</p>
                <p className="text-sm text-[#4c4c4c]">{selectedExpedition.description}</p>
              </div>
            </div>
          </div>
        )}

        {/* Resumen precio */}
        {selectedDepartureDate && selectedExpedition && (
          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[#4c4c4c]">{numSpots} persona(s) × ${selectedExpedition.price}</span>
              <span className="text-[#0f0200] font-medium">${estimatedTotal}</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <span className="font-semibold text-[#0f0200]">Total estimado</span>
              <span className="text-2xl font-bold text-[#0f0200]">${estimatedTotal}</span>
            </div>
            <p className="text-xs text-[#4c4c4c] mt-1 text-right">
              El total definitivo lo confirma el servidor.
            </p>
          </div>
        )}

        {/* CTA (oculto si ventas están pausadas) */}
        {urgent && selectedDepartureDate && selectedExpedition ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
              <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
                Las salidas de <strong>hoy y mañana</strong> requieren confirmación directa.
              </p>
            </div>
            <a href={buildWhatsAppUrl(selectedExpedition, selectedDepartureDate, numSpots, whatsappPhone)}
              target="_blank" rel="noopener noreferrer"
              className="w-full h-14 text-lg font-semibold bg-[#25D366] hover:bg-[#1ebe5d] text-white rounded-lg transition-colors flex items-center justify-center gap-2">
              <MessageCircle className="h-5 w-5" /> Contactar a Daniel por WhatsApp
            </a>
          </div>
        ) : (
          <Button
            className="w-full h-14 text-lg font-semibold bg-[#f26d52] hover:bg-[#0f0200] text-white rounded-lg transition-colors"
            disabled={!selectedExpedition || !selectedDepartureDate || (pauseReady && isPaused)}
            onClick={() => setStep("customer")}>
            <CreditCard className="mr-2 h-5 w-5" /> Continuar con mis datos
          </Button>
        )}
      </div>
    </WidgetShell>
  )
}

// ── Shell ─────────────────────────────────────────────────────
function WidgetShell({ children, isPaused }: { children: React.ReactNode; isPaused: boolean }) {
  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
      {/* Banner de Pánico (Módulo 4) */}
      {isPaused && (
        <div className="bg-red-600 text-white px-4 py-3 flex items-center gap-3">
          <ShieldOff className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold text-sm leading-tight">Ventas temporalmente pausadas</p>
            <p className="text-xs opacity-85">Por clima o mantenimiento. Escríbenos para más info.</p>
          </div>
        </div>
      )}
      <div className="p-6 border-b border-gray-100">
        <h2 className="font-serif text-2xl font-bold text-[#0f0200]">Reserva tu Aventura</h2>
        <p className="text-[#4c4c4c] mt-1 text-sm">Selecciona tu experiencia y fecha</p>
      </div>
      {children}
    </div>
  )
}
