"use client"

import { useState, useMemo } from "react"
import { Calendar, ChevronDown, Minus, Plus, Info, CreditCard } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { format } from "date-fns"
import { es } from "date-fns/locale"

const tours = [
  { 
    id: 1, 
    name: "Cabalgata por la Montaña", 
    price: 85, 
    childPrice: 55,
    minAge: 10, 
    duration: "3 horas",
    requirements: ["Edad minima 10 años", "Sujeto a condiciones climaticas", "No apto para embarazadas"]
  },
  { 
    id: 2, 
    name: "Kayak en el Lago", 
    price: 65, 
    childPrice: 45,
    minAge: 8, 
    duration: "2 horas",
    requirements: ["Edad minima 8 años", "Saber nadar", "Incluye equipo de seguridad"]
  },
  { 
    id: 3, 
    name: "Trekking al Glaciar", 
    price: 120, 
    childPrice: 80,
    minAge: 12, 
    duration: "6 horas",
    requirements: ["Edad minima 12 años", "Buena condicion fisica", "Llevar ropa de abrigo"]
  },
  { 
    id: 4, 
    name: "Avistamiento de Fauna", 
    price: 95, 
    childPrice: 65,
    minAge: 6, 
    duration: "4 horas",
    requirements: ["Edad minima 6 años", "Incluye binoculares", "Guia especializado"]
  },
]

export function BookingWidget() {
  const [selectedTour, setSelectedTour] = useState(tours[0])
  const [date, setDate] = useState<Date | undefined>(undefined)
  const [adults, setAdults] = useState(2)
  const [children, setChildren] = useState(0)
  const [tourDropdownOpen, setTourDropdownOpen] = useState(false)

  const total = useMemo(() => {
    return (adults * selectedTour.price) + (children * selectedTour.childPrice)
  }, [adults, children, selectedTour])

  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-100">
        <h2 className="font-serif text-2xl font-bold text-[#0f0200]">
          Reserva tu Aventura
        </h2>
        <p className="text-[#4c4c4c] mt-1 text-sm">Selecciona tu experiencia y fecha</p>
      </div>

      {/* Form */}
      <div className="p-6 flex flex-col gap-5">
        {/* Tour Selector */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-[#0f0200]">Tour</label>
          <Popover open={tourDropdownOpen} onOpenChange={setTourDropdownOpen}>
            <PopoverTrigger asChild>
              <button className="w-full flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-lg text-left hover:border-[#f26d52] focus:outline-none focus:ring-2 focus:ring-[#f26d52]/20 focus:border-[#f26d52] transition-colors">
                <span className="text-[#0f0200] font-medium">{selectedTour.name}</span>
                <ChevronDown className="h-4 w-4 text-[#4c4c4c]" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
              <div className="flex flex-col">
                {tours.map((tour) => (
                  <button
                    key={tour.id}
                    onClick={() => {
                      setSelectedTour(tour)
                      setTourDropdownOpen(false)
                    }}
                    className={`flex items-center justify-between px-4 py-3 text-left hover:bg-[#fcfaf5] transition-colors ${
                      selectedTour.id === tour.id ? "bg-[#fcfaf5]" : ""
                    }`}
                  >
                    <div>
                      <p className="font-medium text-[#0f0200]">{tour.name}</p>
                      <p className="text-sm text-[#4c4c4c]">{tour.duration}</p>
                    </div>
                    <span className="text-[#f26d52] font-semibold">${tour.price}</span>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Date Picker */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-[#0f0200]">Fecha</label>
          <Popover>
            <PopoverTrigger asChild>
              <button className="w-full flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-lg text-left hover:border-[#f26d52] focus:outline-none focus:ring-2 focus:ring-[#f26d52]/20 focus:border-[#f26d52] transition-colors">
                <span className={date ? "text-[#0f0200] font-medium" : "text-[#4c4c4c]"}>
                  {date ? format(date, "PPP", { locale: es }) : "Selecciona una fecha"}
                </span>
                <Calendar className="h-4 w-4 text-[#4c4c4c]" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={date}
                onSelect={setDate}
                disabled={(date) => date < new Date()}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Counters */}
        <div className="flex flex-col gap-4">
          {/* Adults Counter */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-[#0f0200]">Adultos</p>
              <p className="text-sm text-[#4c4c4c]">${selectedTour.price} por persona</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setAdults(Math.max(1, adults - 1))}
                disabled={adults <= 1}
                className="h-9 w-9 rounded-full border border-gray-300 flex items-center justify-center hover:border-[#f26d52] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Minus className="h-4 w-4 text-[#4c4c4c]" />
              </button>
              <span className="w-8 text-center font-semibold text-[#0f0200]">{adults}</span>
              <button
                onClick={() => setAdults(adults + 1)}
                className="h-9 w-9 rounded-full border border-gray-300 flex items-center justify-center hover:border-[#f26d52] transition-colors"
              >
                <Plus className="h-4 w-4 text-[#4c4c4c]" />
              </button>
            </div>
          </div>

          {/* Children Counter */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-[#0f0200]">Ninos</p>
              <p className="text-sm text-[#4c4c4c]">${selectedTour.childPrice} por nino</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setChildren(Math.max(0, children - 1))}
                disabled={children <= 0}
                className="h-9 w-9 rounded-full border border-gray-300 flex items-center justify-center hover:border-[#f26d52] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Minus className="h-4 w-4 text-[#4c4c4c]" />
              </button>
              <span className="w-8 text-center font-semibold text-[#0f0200]">{children}</span>
              <button
                onClick={() => setChildren(children + 1)}
                className="h-9 w-9 rounded-full border border-gray-300 flex items-center justify-center hover:border-[#f26d52] transition-colors"
              >
                <Plus className="h-4 w-4 text-[#4c4c4c]" />
              </button>
            </div>
          </div>
        </div>

        {/* Requirements Info */}
        <div className="bg-[#fcfaf5] rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-[#f26d52] shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-[#0f0200] text-sm mb-2">Requisitos del tour</p>
              <ul className="flex flex-col gap-1">
                {selectedTour.requirements.map((req, index) => (
                  <li key={index} className="text-sm text-[#4c4c4c]">
                    {req}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="border-t border-gray-100 pt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[#4c4c4c]">{adults} adulto(s) x ${selectedTour.price}</span>
            <span className="text-[#0f0200] font-medium">${adults * selectedTour.price}</span>
          </div>
          {children > 0 && (
            <div className="flex items-center justify-between mb-2">
              <span className="text-[#4c4c4c]">{children} nino(s) x ${selectedTour.childPrice}</span>
              <span className="text-[#0f0200] font-medium">${children * selectedTour.childPrice}</span>
            </div>
          )}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <span className="font-semibold text-[#0f0200]">Total</span>
            <span className="text-2xl font-bold text-[#0f0200]">${total}</span>
          </div>
        </div>

        {/* CTA Button */}
        <Button 
          className="w-full h-14 text-lg font-semibold bg-[#f26d52] hover:bg-[#0f0200] text-white rounded-lg transition-colors"
          disabled={!date}
        >
          <CreditCard className="mr-2 h-5 w-5" />
          Reservar y Pagar (PayPal/Zettle)
        </Button>
      </div>
    </div>
  )
}
