"use client"

import { useState, useCallback } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  MapPin, Plus, Pencil, X, Loader2, AlertCircle,
  RefreshCw, CheckCircle, XCircle, Trash2, Package,
} from "lucide-react"
import { useExpeditions } from "@/hooks/use-expeditions"
import { saveExpedition } from "@/lib/api"
import type { CustomFieldEntry, Expedition } from "@/lib/types"

// ── Zod schema ────────────────────────────────────────────────
const schema = z.object({
  name:           z.string().trim().min(2, "Mínimo 2 caracteres"),
  description:    z.string().trim(),
  price:          z.string().trim().refine(
    (v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0,
    { message: "Debe ser un número positivo" }
  ),
  daily_capacity: z.coerce.number().int().min(1, "Mínimo 1 lugar"),
  image_url:      z.string().trim().refine(
    (v) => v === "" || (() => { try { new URL(v); return true } catch { return false } })(),
    { message: "URL no válida" }
  ),
  status: z.enum(["active", "inactive"]),
})
type FormData = z.infer<typeof schema>

// ── Helpers ───────────────────────────────────────────────────
function customFieldsFromExpedition(exp: Expedition): CustomFieldEntry[] {
  if (!exp.custom_fields || typeof exp.custom_fields !== "object") return []
  return Object.entries(exp.custom_fields).map(([key, value]) => ({
    key,
    value: String(value),
  }))
}

const STATUS_BADGE: Record<"active" | "inactive", string> = {
  active:   "bg-emerald-50 text-emerald-700 border-emerald-200",
  inactive: "bg-gray-100   text-gray-500    border-gray-200",
}

// ── Props ─────────────────────────────────────────────────────
interface ExpeditionsPanelProps {
  token: string
}

// ── Componente ────────────────────────────────────────────────
export function ExpeditionsPanel({ token }: ExpeditionsPanelProps) {
  const { expeditions, isLoading, error, retry } = useExpeditions()

  const [editingId,   setEditingId]   = useState<number | null | "new">(null)
  const [customFields, setCustomFields] = useState<CustomFieldEntry[]>([])
  const [formError,   setFormError]   = useState<string | null>(null)
  const [savedId,     setSavedId]     = useState<number | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { status: "active", daily_capacity: 10, price: "" },
  })

  // ── Abrir form ────────────────────────────────────────────
  const openCreate = useCallback(() => {
    reset({ name: "", description: "", price: "", daily_capacity: 10, image_url: "", status: "active" })
    setCustomFields([])
    setFormError(null)
    setEditingId("new")
  }, [reset])

  const openEdit = useCallback((exp: Expedition) => {
    reset({
      name:           exp.name,
      description:    exp.description ?? "",
      price:          exp.price,
      daily_capacity: exp.daily_capacity,
      image_url:      exp.image_url ?? "",
      status:         exp.status,
    })
    setCustomFields(customFieldsFromExpedition(exp))
    setFormError(null)
    setEditingId(exp.id)
  }, [reset])

  const closeForm = useCallback(() => {
    setEditingId(null)
    setFormError(null)
  }, [])

  // ── Custom fields builder ─────────────────────────────────
  const addField = () => setCustomFields((prev) => [...prev, { key: "", value: "" }])

  const removeField = (idx: number) =>
    setCustomFields((prev) => prev.filter((_, i) => i !== idx))

  const updateField = (idx: number, part: Partial<CustomFieldEntry>) =>
    setCustomFields((prev) =>
      prev.map((f, i) => i === idx ? { ...f, ...part } : f)
    )

  // ── Submit ────────────────────────────────────────────────
  async function onSubmit(data: FormData) {
    setFormError(null)
    try {
      const saved = await saveExpedition(
        {
          ...(editingId !== "new" && editingId !== null ? { id: editingId } : {}),
          ...data,
          custom_fields: customFields.filter((f) => f.key.trim() !== ""),
        },
        token
      )
      setSavedId(saved.id)
      setTimeout(() => setSavedId(null), 2500)
      closeForm()
      retry()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error al guardar.")
    }
  }

  const isFormOpen = editingId !== null

  return (
    <div className="max-w-4xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#0f0200]/5 flex items-center justify-center">
            <MapPin className="h-5 w-5 text-[#0f0200]" />
          </div>
          <div>
            <h3 className="font-serif font-bold text-[#0f0200]">Expediciones</h3>
            <p className="text-xs text-[#4c4c4c]">{expeditions.length} expedición(es) registradas</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={retry} className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-[#4c4c4c]">
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={isFormOpen ? closeForm : openCreate}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              isFormOpen
                ? "bg-gray-100 text-[#4c4c4c]"
                : "bg-[#f26d52] text-white hover:bg-[#e05a40]"
            }`}
          >
            {isFormOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {isFormOpen ? "Cancelar" : "Nueva Expedición"}
          </button>
        </div>
      </div>

      {/* Formulario (crear / editar) */}
      {isFormOpen && (
        <div className="bg-white rounded-2xl border border-[#f26d52]/20 shadow-sm p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-[#f26d52]" />
            <h4 className="font-semibold text-[#0f0200]">
              {editingId === "new" ? "Crear nueva expedición" : "Editar expedición"}
            </h4>
          </div>

          {formError && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" /> {formError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">

            {/* Fila 1: Nombre + Estado */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-[#0f0200] mb-1.5">Nombre de la expedición *</label>
                <input
                  type="text" placeholder="Tiburón Ballena La Paz"
                  className={`w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none focus:border-[#f26d52] focus:ring-2 focus:ring-[#f26d52]/10 ${errors.name ? "border-red-300 bg-red-50" : "border-gray-200"}`}
                  {...register("name")}
                />
                {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0f0200] mb-1.5">Estado</label>
                <select
                  className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm bg-white outline-none focus:border-[#f26d52] focus:ring-2 focus:ring-[#f26d52]/10"
                  {...register("status")}
                >
                  <option value="active">Activa</option>
                  <option value="inactive">Inactiva</option>
                </select>
              </div>
            </div>

            {/* Descripción */}
            <div>
              <label className="block text-xs font-semibold text-[#0f0200] mb-1.5">Descripción</label>
              <textarea
                rows={3} placeholder="Breve descripción de la expedición…"
                className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-[#f26d52] focus:ring-2 focus:ring-[#f26d52]/10 resize-none"
                {...register("description")}
              />
            </div>

            {/* Fila 2: Precio + Cupo + URL imagen */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#0f0200] mb-1.5">Precio por persona (MXN) *</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-[#4c4c4c]">$</span>
                  <input
                    type="number" step="0.01" min="0" placeholder="950.00"
                    className={`w-full rounded-xl border pl-7 pr-3.5 py-2.5 text-sm outline-none focus:border-[#f26d52] focus:ring-2 focus:ring-[#f26d52]/10 ${errors.price ? "border-red-300 bg-red-50" : "border-gray-200"}`}
                    {...register("price")}
                  />
                </div>
                {errors.price && <p className="mt-1 text-xs text-red-600">{errors.price.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0f0200] mb-1.5">Cupo diario (lugares) *</label>
                <input
                  type="number" min="1" placeholder="12"
                  className={`w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none focus:border-[#f26d52] focus:ring-2 focus:ring-[#f26d52]/10 ${errors.daily_capacity ? "border-red-300 bg-red-50" : "border-gray-200"}`}
                  {...register("daily_capacity")}
                />
                {errors.daily_capacity && <p className="mt-1 text-xs text-red-600">{errors.daily_capacity.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0f0200] mb-1.5">URL de imagen de portada</label>
                <input
                  type="url" placeholder="https://…"
                  className={`w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none focus:border-[#f26d52] focus:ring-2 focus:ring-[#f26d52]/10 ${errors.image_url ? "border-red-300 bg-red-50" : "border-gray-200"}`}
                  {...register("image_url")}
                />
                {errors.image_url && <p className="mt-1 text-xs text-red-600">{errors.image_url.message}</p>}
              </div>
            </div>

            {/* ── Constructor de Condiciones Dinámicas ── */}
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-[#fcfaf5] border-b border-gray-200">
                <div>
                  <p className="text-xs font-semibold text-[#0f0200]">Condiciones Dinámicas</p>
                  <p className="text-xs text-[#4c4c4c]">Se guardan en <code className="bg-gray-200 px-1 rounded text-[10px]">custom_fields</code> como JSON</p>
                </div>
                <button
                  type="button"
                  onClick={addField}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#f26d52]/10 text-[#f26d52] text-xs font-semibold hover:bg-[#f26d52]/20 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" /> Agregar condición
                </button>
              </div>

              {customFields.length === 0 ? (
                <p className="px-4 py-5 text-xs text-center text-[#4c4c4c]">
                  Sin condiciones. Ej: "Edad mínima → 12 años", "Nivel → Principiante"
                </p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {customFields.map((field, idx) => (
                    <div key={idx} className="flex items-center gap-2 px-4 py-2.5">
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Clave (ej. Edad mínima)"
                          value={field.key}
                          onChange={(e) => updateField(idx, { key: e.target.value })}
                          className="rounded-lg border border-gray-200 px-3 py-2 text-xs outline-none focus:border-[#f26d52] focus:ring-1 focus:ring-[#f26d52]/20"
                        />
                        <input
                          type="text"
                          placeholder="Valor (ej. 12 años)"
                          value={field.value}
                          onChange={(e) => updateField(idx, { value: e.target.value })}
                          className="rounded-lg border border-gray-200 px-3 py-2 text-xs outline-none focus:border-[#f26d52] focus:ring-1 focus:ring-[#f26d52]/20"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeField(idx)}
                        className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 transition-colors shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Botón submit */}
            <button
              type="submit" disabled={isSubmitting}
              className="w-full py-2.5 rounded-xl bg-[#f26d52] text-white text-sm font-semibold hover:bg-[#e05a40] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting
                ? "Guardando…"
                : editingId === "new"
                ? "Crear expedición"
                : "Guardar cambios"}
            </button>
          </form>
        </div>
      )}

      {/* Estado de carga / error */}
      {isLoading && (
        <div className="flex items-center justify-center py-16 gap-3 text-[#4c4c4c]">
          <Loader2 className="h-5 w-5 animate-spin text-[#f26d52]" />
          <span className="text-sm">Cargando expediciones…</span>
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

      {/* Lista de expediciones */}
      {!isLoading && !error && (
        <div className="space-y-3">
          {expeditions.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-200 py-16 text-center">
              <MapPin className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-[#4c4c4c]">Sin expediciones. Crea la primera.</p>
            </div>
          ) : (
            expeditions.map((exp) => {
              const fieldEntries = customFieldsFromExpedition(exp)
              const isSaved = savedId === exp.id

              return (
                <div
                  key={exp.id}
                  className={`bg-white rounded-2xl border shadow-sm p-5 transition-all ${
                    isSaved ? "border-emerald-300 ring-2 ring-emerald-100" : "border-gray-100"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Imagen / Placeholder */}
                    <div className="h-14 w-14 rounded-xl bg-[#f26d52]/10 flex items-center justify-center shrink-0 overflow-hidden">
                      {exp.image_url ? (
                        <img src={exp.image_url} alt={exp.name} className="h-full w-full object-cover rounded-xl" />
                      ) : (
                        <MapPin className="h-6 w-6 text-[#f26d52]" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="font-serif font-bold text-[#0f0200]">{exp.name}</p>
                        {isSaved && (
                          <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                            <CheckCircle className="h-3.5 w-3.5" /> Guardado
                          </span>
                        )}
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_BADGE[exp.status]}`}>
                          {exp.status === "active"
                            ? <CheckCircle className="h-3 w-3" />
                            : <XCircle className="h-3 w-3" />}
                          {exp.status === "active" ? "Activa" : "Inactiva"}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-[#4c4c4c] flex-wrap">
                        <span className="font-semibold text-[#f26d52]">
                          ${parseFloat(exp.price).toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN/persona
                        </span>
                        <span>{exp.daily_capacity} lugares/día</span>
                        {exp.description && (
                          <span className="truncate max-w-xs">{exp.description}</span>
                        )}
                      </div>

                      {/* Custom fields chips */}
                      {fieldEntries.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {fieldEntries.map(({ key, value }) => (
                            <span
                              key={key}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#fcfaf5] border border-[#ede8df] text-[10px] text-[#4c4c4c]"
                            >
                              <span className="font-semibold text-[#0f0200]">{key}:</span> {value}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => editingId === exp.id ? closeForm() : openEdit(exp)}
                      className={`p-2.5 rounded-xl transition-colors shrink-0 ${
                        editingId === exp.id
                          ? "bg-gray-100 text-[#4c4c4c]"
                          : "hover:bg-[#f26d52]/10 text-[#4c4c4c] hover:text-[#f26d52]"
                      }`}
                      title={editingId === exp.id ? "Cerrar editor" : "Editar expedición"}
                    >
                      {editingId === exp.id ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
