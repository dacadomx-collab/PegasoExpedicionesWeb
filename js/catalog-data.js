/**
 * Pegaso Expediciones — Catálogo Print-First (i18n EN/ES)
 * Fuente de verdad de servicios. Ver knowledge/02_SYSTEM_CODEX_REGISTRY.md
 * → módulo `catalog_services` para el contrato de cada campo.
 */

const IMAGE_BASE_PATH = "assets/images/";
const DEFAULT_LANG = "en";

// Número real de Daniel (WhatsApp), confirmado por el Arquitecto 2026-06-22.
// Formato: 52 + clave de área + número, sin "+", sin espacios, sin guiones.
const WHATSAPP_NUMBER = "526121480200";

const CATALOG_MESSAGE_TEMPLATES = {
  en: (serviceName) => `Hello Pegaso, I'm interested in ${serviceName} and I would like to receive more info.`,
  es: (serviceName) => `Hola Pegaso, me interesa ${serviceName} y quiero recibir más información.`
};

function buildCatalogMessage(serviceName, lang) {
  const template = CATALOG_MESSAGE_TEMPLATES[lang] || CATALOG_MESSAGE_TEMPLATES[DEFAULT_LANG];
  return template(serviceName);
}

// Textos de interfaz estáticos (header, botones, leyenda del QR).
const UI_STRINGS = {
  en: {
    pageTitle: "Expedition Catalog",
    subtitle: "Scan the QR code of your favorite tour and book directly via WhatsApp",
    printButton: "🖨️ Print Catalog",
    qrCaption: "Scan & book via WhatsApp",
    langSwitchLabel: "🇲🇽 Cambiar a Español"
  },
  es: {
    pageTitle: "Catálogo de Expediciones",
    subtitle: "Escanea el código QR de tu tour favorito y reserva directo por WhatsApp",
    printButton: "🖨️ Imprimir Catálogo",
    qrCaption: "Escanea y reserva por WhatsApp",
    langSwitchLabel: "🇺🇸 Switch to English"
  }
};

// Imágenes seleccionadas tras auditoría visual real de assets/images/
// (ver knowledge/02_SYSTEM_CODEX_REGISTRY.md → módulo catalog_services para el detalle de cada elección).
const CATALOG_SERVICES = [
  {
    id: "cabalgata",
    title: { en: "Sunset Horseback Riding", es: "Cabalgata al Atardecer" },
    description: {
      en: "Daily departures at 9:30 AM & 4:30 PM · Duration: 1 hour 20 min approx.",
      es: "Salidas diarias a las 9:30 AM y 4:30 PM · Duración: 1 hora 20 min aprox."
    },
    image: "Horseback_BG.jpg"
  },
  {
    id: "tiburon-ballena",
    title: { en: "Whale Shark Swimming", es: "Nado con Tiburón Ballena" },
    description: {
      en: "Season: Nov–Mar · Departure: 11:00 AM · Duration: 3 hours · Wetsuits and snorkel gear included.",
      es: "Temporada: Nov–Mar · Salida: 11:00 AM · Duración: 3 horas · Trajes de neopreno y equipo de snorkel incluidos."
    },
    image: "explore-image2.jpg"
  },
  {
    id: "isla-espiritu-santo",
    title: { en: "Espíritu Santo Island", es: "Isla Espíritu Santo" },
    description: {
      en: "Departure: 9:30 AM (Private) & 11:00 AM (Collective) · Snorkeling, marine safari, and beach day · Lunch and drinks included.",
      es: "Salida: 9:00 AM (Privado) y 11:00 AM (Colectivo) · Snorkel, safari marino y día de playa · Almuerzo y bebidas incluidos."
    },
    image: "espiritu_santo_1.jpg"
  },
  {
    id: "kayak-mar-cortes",
    title: { en: "Sea of Cortez Kayaking", es: "Kayak en el Mar de Cortés" },
    description: {
      en: "Departures: 8:00 AM & 4:00 PM · Duration: 3 hours approx · Beginner friendly.",
      es: "Salidas: 8:00 AM y 4:00 PM · Duración: 3 horas aprox · Ideal para principiantes."
    },
    image: "kayak3.jpg"
  },
  {
    id: "hiking-sierra-laguna",
    title: { en: "Sierra de la Laguna Hiking", es: "Hiking Sierra de la Laguna" },
    description: {
      en: "Departure 7:00 AM · Full day · Moderate level · Transportation included.",
      es: "Salida 7:00 hrs · Día completo · Nivel moderado · Incluye transporte."
    },
    image: "hiking3.jpeg"
  },
  {
    id: "lancha-balandra",
    title: { en: "Balandra Boat Tour", es: "Tour en Lancha a Balandra" },
    description: {
      en: "Departure: 9:30 AM (Private) · Duration: 5 hours approx · Snorkeling, marine safari, beach day, and paddleboarding · Lunch and drinks included.",
      es: "Salida: 9:30 AM (Privado) · Duración: 5 horas aprox · Snorkel, safari marino, día de playa y paddleboard · Almuerzo y bebidas incluidos."
    },
    image: "balandra1.jpg"
  }
];
