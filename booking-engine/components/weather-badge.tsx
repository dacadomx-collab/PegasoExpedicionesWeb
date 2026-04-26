"use client"

import { Loader2, Wind } from "lucide-react"
import { useWeather } from "@/hooks/use-weather"

interface WeatherBadgeProps {
  dateStr: string | null   // "YYYY-MM-DD"
  className?: string
}

/**
 * Muestra el pronóstico de Open-Meteo para La Paz, BCS en una fecha dada.
 * Componente no-crítico: si la API falla, simplemente no renderiza.
 */
export function WeatherBadge({ dateStr, className = "" }: WeatherBadgeProps) {
  const { getWeatherForDate, isLoading } = useWeather()

  if (!dateStr) return null

  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 border border-gray-100 text-xs text-gray-400 ${className}`}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span>Cargando clima…</span>
      </div>
    )
  }

  const weather = getWeatherForDate(dateStr)
  if (!weather) return null

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2 rounded-xl border border-transparent ${weather.bg} ${weather.text} ${className}`}
      role="status"
      aria-label={`Pronóstico para La Paz: ${weather.label}, ${weather.tempMax}°C`}
    >
      {/* Emoji + condición */}
      <span className="text-xl leading-none" aria-hidden="true">{weather.emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-xs leading-tight">{weather.label}</p>
        <p className="text-xs opacity-75 leading-tight">
          {weather.tempMax}° / {weather.tempMin}°C · La Paz, BCS
        </p>
      </div>
      {/* Icono de viento decorativo */}
      <Wind className="h-3.5 w-3.5 opacity-40 shrink-0" />
    </div>
  )
}
