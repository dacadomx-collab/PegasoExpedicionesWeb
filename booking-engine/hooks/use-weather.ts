"use client"

import { useState, useEffect } from "react"

// Open-Meteo — gratuito, sin llave API. La Paz, BCS: 24.1426°N 110.3128°O
const FORECAST_URL =
  "https://api.open-meteo.com/v1/forecast" +
  "?latitude=24.1426&longitude=-110.3128" +
  "&daily=weathercode,temperature_2m_max,temperature_2m_min" +
  "&timezone=America%2FHermosillo&forecast_days=16"

// WMO Weather Interpretation Codes → UI amigable en español
const WMO: Record<number, { emoji: string; label: string; bg: string; text: string }> = {
  0:  { emoji: "☀️",  label: "Despejado",          bg: "bg-amber-50",  text: "text-amber-700" },
  1:  { emoji: "🌤️",  label: "Mayormente claro",   bg: "bg-amber-50",  text: "text-amber-700" },
  2:  { emoji: "⛅",  label: "Parcial. nublado",   bg: "bg-slate-50",  text: "text-slate-600" },
  3:  { emoji: "☁️",  label: "Nublado",             bg: "bg-slate-100", text: "text-slate-600" },
  45: { emoji: "🌫️",  label: "Neblina",             bg: "bg-slate-100", text: "text-slate-500" },
  48: { emoji: "🌫️",  label: "Neblina helada",      bg: "bg-slate-100", text: "text-slate-500" },
  51: { emoji: "🌧️",  label: "Llovizna ligera",     bg: "bg-blue-50",   text: "text-blue-600"  },
  53: { emoji: "🌧️",  label: "Llovizna",            bg: "bg-blue-50",   text: "text-blue-600"  },
  55: { emoji: "🌧️",  label: "Llovizna intensa",    bg: "bg-blue-100",  text: "text-blue-700"  },
  61: { emoji: "🌦️",  label: "Lluvia ligera",       bg: "bg-blue-50",   text: "text-blue-600"  },
  63: { emoji: "🌦️",  label: "Lluvia moderada",     bg: "bg-blue-100",  text: "text-blue-700"  },
  65: { emoji: "🌧️",  label: "Lluvia intensa",      bg: "bg-blue-200",  text: "text-blue-800"  },
  80: { emoji: "🌦️",  label: "Chubascos",           bg: "bg-blue-50",   text: "text-blue-600"  },
  81: { emoji: "🌦️",  label: "Chubascos fuertes",   bg: "bg-blue-100",  text: "text-blue-700"  },
  82: { emoji: "⛈️",  label: "Chubascos violentos", bg: "bg-indigo-100",text: "text-indigo-700"},
  95: { emoji: "⛈️",  label: "Tormenta",            bg: "bg-indigo-100",text: "text-indigo-700"},
  96: { emoji: "⛈️",  label: "Tormenta + granizo",  bg: "bg-indigo-200",text: "text-indigo-800"},
  99: { emoji: "⛈️",  label: "Tormenta severa",     bg: "bg-indigo-200",text: "text-indigo-800"},
}

const DEFAULT_WMO = { emoji: "🌡️", label: "Datos no disponibles", bg: "bg-gray-50", text: "text-gray-500" }

export interface DayWeather {
  date: string
  code: number
  tempMax: number
  tempMin: number
  emoji: string
  label: string
  bg: string    // Tailwind class para fondo del badge
  text: string  // Tailwind class para texto
}

interface UseWeatherReturn {
  getWeatherForDate: (dateStr: string) => DayWeather | null
  isLoading: boolean
}

export function useWeather(): UseWeatherReturn {
  const [forecast, setForecast] = useState<Map<string, DayWeather>>(new Map())
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)

    fetch(FORECAST_URL)
      .then((r) => r.json())
      .then((data: {
        daily: {
          time: string[]
          weathercode: number[]
          temperature_2m_max: number[]
          temperature_2m_min: number[]
        }
      }) => {
        if (cancelled) return
        const map = new Map<string, DayWeather>()
        const { time, weathercode, temperature_2m_max, temperature_2m_min } = data.daily

        time.forEach((date, i) => {
          const code = weathercode[i] ?? 0
          const info = WMO[code] ?? DEFAULT_WMO
          map.set(date, {
            date,
            code,
            tempMax: Math.round(temperature_2m_max[i] ?? 0),
            tempMin: Math.round(temperature_2m_min[i] ?? 0),
            ...info,
          })
        })
        setForecast(map)
      })
      .catch(() => {}) // El clima es no-crítico — falla silenciosamente
      .finally(() => { if (!cancelled) setIsLoading(false) })

    return () => { cancelled = true }
  }, [])

  return {
    getWeatherForDate: (dateStr) => forecast.get(dateStr) ?? null,
    isLoading,
  }
}
