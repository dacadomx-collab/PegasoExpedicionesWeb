"use client"

/**
 * /academy — Módulo de Infografía Tutorial para Partners.
 *
 * Sección 1: Tus 3 Motores de Inicio
 * Sección 2: Ecosistema de Soluciones AXON DCD
 */

import { useState } from "react"

// ── Data ────────────────────────────────────────────────────────

const MOTORES = [
  {
    id:     "A",
    icon:   "⚡",
    color:  { from: "#0ea5e9", to: "#6366f1" },
    border: "#0ea5e940",
    glow:   "#0ea5e920",
    tag:    "Motor A",
    title:  "Crear desde Cero",
    sub:    "Nuevo Ecosistema Digital",
    que_es:
      "La construcción integral de una identidad digital partiendo de cero. Diseño, dominio, hosting, correo corporativo, sitio web, sistema de pagos y panel de control unificado.",
    que_resuelve:
      "La ausencia total de presencia digital. Sin infraestructura previa, sin procesos, sin cómo encontrarte en línea.",
    que_esperar: [
      "Ecosistema funcional en 4–6 semanas",
      "Dominio + hosting + SSL configurados",
      "Sitio web con identidad visual propia",
      "Correo corporativo @tudominio.com",
      "Panel de control y métricas básicas",
    ],
  },
  {
    id:     "B",
    icon:   "🔬",
    color:  { from: "#8b5cf6", to: "#ec4899" },
    border: "#8b5cf640",
    glow:   "#8b5cf620",
    tag:    "Motor B",
    title:  "Rediseñar y Optimizar",
    sub:    "Reingeniería Digital",
    que_es:
      "La cirugía de un sistema o sitio existente que no convierte, no escala o genera fricciones internas. Auditoría completa, rediseño por capas y optimización de conversión.",
    que_resuelve:
      "Sistemas lentos, confusos o desactualizados que pierden clientes antes de que lleguen a la primera acción crítica.",
    que_esperar: [
      "Diagnóstico de velocidad y UX en 48h",
      "Plan de acción priorizado por impacto",
      "Implementación sin bajar el servicio",
      "Mejora medible en conversión en 30 días",
      "Documentación técnica del nuevo sistema",
    ],
  },
  {
    id:     "C",
    icon:   "🧠",
    color:  { from: "#10b981", to: "#0ea5e9" },
    border: "#10b98140",
    glow:   "#10b98120",
    tag:    "Motor C",
    title:  "Inyectar Inteligencia",
    sub:    "Módulos de IA Autónomos",
    que_es:
      "La integración de componentes de inteligencia artificial en ecosistemas existentes: chatbots de atención, agentes de prospección automática, scoring de leads y análisis predictivo.",
    que_resuelve:
      "La pérdida de leads por falta de atención 24/7, procesos de seguimiento manuales y la incapacidad de escalar sin aumentar el equipo humano.",
    que_esperar: [
      "Agente funcional en 2 semanas",
      "Período de entrenamiento de 30 días",
      "Integración con WhatsApp / correo / CRM",
      "Dashboard de métricas de conversación",
      "Escalamiento gradual sin fricción",
    ],
  },
]

const ECOSISTEMA = [
  {
    id:    "AI",
    icon:  "🤖",
    color: { from: "#0ea5e9", to: "#6366f1" },
    border: "#6366f140",
    name:  "AI OPERATORS",
    sub:   "Tu centro de mando y prospección",
    desc:
      "Panel donde lanzas y supervisas campañas de prospección automatizadas. Los operadores califican leads, envían seguimientos personalizados y reportan conversiones en tiempo real — sin intervención manual.",
    capacidades: [
      "Lanzamiento de campañas de outreach",
      "Calificación automática de prospectos",
      "Secuencias de seguimiento multi-canal",
      "Reporte en tiempo real de conversiones",
    ],
  },
  {
    id:    "SS",
    icon:  "🛡️",
    color: { from: "#f59e0b", to: "#ef4444" },
    border: "#f59e0b40",
    name:  "SECURITY SCANNER",
    sub:   "Auditoría perimetral de confianza",
    desc:
      "Herramienta que escanea el ecosistema digital de un cliente potencial o activo. Identifica vulnerabilidades, fugas de rendimiento y oportunidades de mejora, generando una radiografía técnica completa.",
    capacidades: [
      "Escaneo de velocidad y Core Web Vitals",
      "Detección de vulnerabilidades comunes",
      "Análisis de SEO técnico y accesibilidad",
      "Radiografía exportable en PDF",
    ],
  },
  {
    id:    "TF",
    icon:  "🏭",
    color: { from: "#10b981", to: "#6366f1" },
    border: "#10b98140",
    name:  "THE FOUNDRY",
    sub:   "Tu marketplace de soluciones listas",
    desc:
      "Catálogo de componentes, módulos y sistemas pre-construidos listos para ser desplegados. Como partner, seleccionas, configuras y lanzas soluciones directamente a los proyectos de tus clientes.",
    capacidades: [
      "Módulos de booking, pagos y CRM",
      "Plantillas de sitios por industria",
      "Integraciones pre-configuradas",
      "Despliegue directo desde el panel",
    ],
  },
]

const FLUJO_STEPS = [
  { n: "01", icon: "📂", label: "Ingresa el dominio o proyecto del cliente" },
  { n: "02", icon: "🔍", label: "El sistema lanza un escaneo asíncrono (~5 min)" },
  { n: "03", icon: "📊", label: "Se genera la radiografía digital del ecosistema" },
  { n: "04", icon: "💡", label: "El sistema propone los 3 módulos más relevantes" },
  { n: "05", icon: "✅", label: "Tú revisas, apruebas y presentas al cliente" },
]

// ── Sub-components ──────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-8">
      <div className="h-px flex-1" style={{ background: "linear-gradient(90deg, transparent, #334155)" }} />
      <span className="text-[10px] font-bold tracking-[0.3em] text-slate-500 uppercase">{children}</span>
      <div className="h-px flex-1" style={{ background: "linear-gradient(90deg, #334155, transparent)" }} />
    </div>
  )
}

function MotorCard({ m }: { m: typeof MOTORES[0] }) {
  const [open, setOpen] = useState(false)
  return (
    <div
      className="rounded-2xl overflow-hidden transition-all duration-300 cursor-pointer"
      style={{
        background: "#0f172a",
        border: `1px solid ${open ? m.border : "#1e293b"}`,
        boxShadow: open ? `0 0 32px ${m.glow}` : "none",
      }}
      onClick={() => setOpen(o => !o)}
    >
      {/* Card header */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
              style={{ background: `linear-gradient(135deg, ${m.color.from}20, ${m.color.to}20)`,
                       border: `1px solid ${m.border}` }}
            >
              {m.icon}
            </div>
            <div>
              <span
                className="text-[10px] font-bold tracking-widest uppercase"
                style={{ color: m.color.from }}
              >
                {m.tag}
              </span>
              <h3 className="text-base font-bold text-white leading-tight">{m.title}</h3>
              <p className="text-xs text-slate-500">{m.sub}</p>
            </div>
          </div>
          <span className="text-slate-600 text-sm mt-1 shrink-0">{open ? "▲" : "▼"}</span>
        </div>

        {/* Collapsed preview */}
        {!open && (
          <p className="mt-3 text-xs text-slate-500 leading-relaxed line-clamp-2">{m.que_es}</p>
        )}
      </div>

      {/* Expanded body */}
      {open && (
        <div className="px-5 pb-5 space-y-4 border-t border-slate-800/50 pt-4">
          <InfoBlock label="¿Qué es?" text={m.que_es} color={m.color.from} />
          <InfoBlock label="¿Qué resuelve?" text={m.que_resuelve} color={m.color.from} />
          <div>
            <p className="text-[10px] font-bold tracking-widest uppercase mb-2"
               style={{ color: m.color.from }}>
              ¿Qué debe esperar el Partner?
            </p>
            <ul className="space-y-1.5">
              {m.que_esperar.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                  <span style={{ color: m.color.from }} className="shrink-0 mt-0.5">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

function InfoBlock({ label, text, color }: { label: string; text: string; color: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold tracking-widest uppercase mb-1" style={{ color }}>
        {label}
      </p>
      <p className="text-xs text-slate-400 leading-relaxed">{text}</p>
    </div>
  )
}

function EcosistemaCard({ item }: { item: typeof ECOSISTEMA[0] }) {
  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-4 h-full"
      style={{
        background: "#0f172a",
        border: `1px solid ${item.border}`,
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
          style={{
            background: `linear-gradient(135deg, ${item.color.from}20, ${item.color.to}20)`,
            border: `1px solid ${item.border}`,
          }}
        >
          {item.icon}
        </div>
        <div>
          <h3
            className="text-sm font-bold"
            style={{ color: item.color.from }}
          >
            {item.name}
          </h3>
          <p className="text-[10px] text-slate-500">{item.sub}</p>
        </div>
      </div>

      <p className="text-xs text-slate-400 leading-relaxed flex-1">{item.desc}</p>

      <div className="space-y-1.5">
        {item.capacidades.map((c, i) => (
          <div key={i} className="flex items-center gap-2 text-[11px] text-slate-300">
            <span style={{ color: item.color.from }}>→</span>
            {c}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Page ────────────────────────────────────────────────────────

export default function AcademyPage() {
  return (
    <div
      className="min-h-screen px-4 py-12"
      style={{ background: "#0a0f1e", color: "#e2e8f0" }}
    >
      <div className="max-w-3xl mx-auto space-y-16">

        {/* Hero */}
        <div className="text-center space-y-4">
          <p className="text-[10px] font-mono tracking-[0.35em] text-sky-500 uppercase">
            AXON DCD · PARTNER ACADEMY
          </p>
          <h1 className="text-3xl font-bold text-white leading-tight">
            Tu guía operativa del<br />
            <span
              style={{
                background: "linear-gradient(90deg, #38bdf8, #818cf8, #34d399)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Deep Tech Matrix
            </span>
          </h1>
          <p className="text-slate-400 text-sm max-w-md mx-auto leading-relaxed">
            Como Arquitecta de Confianza Operativa, este portal es tu centro de mando.
            Aquí entiendes cómo opera el sistema y qué puedes construir con él.
          </p>
        </div>

        {/* ── SECCIÓN 1 ────────────────────────────────────── */}
        <section className="space-y-6">
          <SectionLabel>Sección 1 — Tus 3 Motores de Inicio</SectionLabel>

          <div
            className="rounded-2xl p-4 mb-6"
            style={{ background: "#0f172a", border: "1px solid #1e293b" }}
          >
            <p className="text-xs text-slate-400 leading-relaxed">
              Cada proyecto que traes al sistema encaja en uno de estos tres motores.
              Identificar cuál aplica es el primer paso para diseñar la propuesta correcta.
              Haz clic en cada motor para ver los detalles completos.
            </p>
          </div>

          <div className="space-y-4">
            {MOTORES.map(m => <MotorCard key={m.id} m={m} />)}
          </div>
        </section>

        {/* ── SECCIÓN 2 ────────────────────────────────────── */}
        <section className="space-y-6">
          <SectionLabel>Sección 2 — Ecosistema de Soluciones</SectionLabel>

          <div
            className="rounded-2xl p-4 mb-6"
            style={{ background: "#0f172a", border: "1px solid #1e293b" }}
          >
            <p className="text-xs text-slate-400 leading-relaxed">
              El ecosistema AXON DCD está compuesto por tres herramientas independientes
              que se complementan. Cada una tiene un propósito distinto en el ciclo de vida
              de un proyecto.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {ECOSISTEMA.map(item => <EcosistemaCard key={item.id} item={item} />)}
          </div>
        </section>

        {/* ── FLUJO ASÍNCRONO ──────────────────────────────── */}
        <section className="space-y-6">
          <SectionLabel>¿Qué sucede al ingresar mi primer proyecto?</SectionLabel>

          <div
            className="rounded-2xl overflow-hidden"
            style={{ border: "1px solid #1e3a5f" }}
          >
            <div
              className="px-6 py-4"
              style={{
                background: "linear-gradient(135deg, #0ea5e910 0%, #6366f110 100%)",
                borderBottom: "1px solid #1e3a5f",
              }}
            >
              <h3 className="font-bold text-white text-sm">
                Flujo Asíncrono de Diagnóstico
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Desde que registras un proyecto hasta que tienes la propuesta lista
              </p>
            </div>

            <div className="divide-y" style={{ background: "#0f172a", borderColor: "#1e293b" }}>
              {FLUJO_STEPS.map((step, i) => (
                <div key={i} className="flex items-center gap-4 px-6 py-4">
                  <div className="flex flex-col items-center gap-1 shrink-0">
                    <span
                      className="text-[10px] font-mono font-bold"
                      style={{ color: "#6366f1" }}
                    >
                      {step.n}
                    </span>
                    {i < FLUJO_STEPS.length - 1 && (
                      <div className="w-px h-4" style={{ background: "#1e3a5f" }} />
                    )}
                  </div>
                  <span className="text-base">{step.icon}</span>
                  <p className="text-xs text-slate-300 leading-relaxed">{step.label}</p>
                </div>
              ))}
            </div>

            <div
              className="px-6 py-3"
              style={{ background: "#0a0f1e", borderTop: "1px solid #1e3a5f" }}
            >
              <p className="text-[10px] text-slate-500 text-center font-mono tracking-wider">
                El escaneo ocurre en segundo plano — puedes cerrar la ventana y volver cuando esté listo
              </p>
            </div>
          </div>
        </section>

        {/* ── CIERRE ───────────────────────────────────────── */}
        <section>
          <div
            className="rounded-2xl p-8 text-center space-y-4"
            style={{
              background: "linear-gradient(135deg, #0ea5e910, #6366f110, #10b98110)",
              border: "1px solid #1e3a5f",
            }}
          >
            <p className="text-3xl">🌐</p>
            <h2 className="text-lg font-bold text-white">
              Tu rol como Arquitecta de Confianza Operativa
            </h2>
            <p className="text-sm text-slate-400 max-w-sm mx-auto leading-relaxed">
              No eres vendedora de tecnología. Eres la persona que diagnostica,
              diseña y entrega ecosistemas que funcionan. El sistema es tu laboratorio —
              tú eres la estratega.
            </p>
            <div className="flex justify-center gap-3 pt-2 flex-wrap">
              {["Diagnosticar", "Diseñar", "Construir", "Escalar"].map(v => (
                <span
                  key={v}
                  className="rounded-full px-3 py-1 text-xs font-semibold"
                  style={{
                    background: "#1e293b",
                    border: "1px solid #334155",
                    color: "#94a3b8",
                  }}
                >
                  {v}
                </span>
              ))}
            </div>
          </div>
        </section>

        <p className="text-center text-[10px] text-slate-700 font-mono tracking-widest pb-4">
          AXON DCD · GÉNESIS ÉLITE v2 · PARTNER ACADEMY
        </p>
      </div>
    </div>
  )
}
