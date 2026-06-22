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
  en: (serviceName) => `Hello Daniel, I'm coming from the printed catalog. I am interested in the ${serviceName} tour and would like more info.`,
  es: (serviceName) => `Hola Daniel, vengo del catálogo impreso. Me interesa el tour de ${serviceName} y quiero más información.`
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
      en: "Daily departures 9:00 & 4:00 PM · 2 hours · Gear and bilingual guide included.",
      es: "Salidas diarias 9:00 y 16:00 hrs · 2 horas · Incluye equipo y guía bilingüe."
    },
    image: "Horseback_BG.jpg"
  },
  {
    id: "tiburon-ballena",
    title: { en: "Whale Shark Swimming", es: "Nado con Tiburón Ballena" },
    description: {
      en: "Season Nov–Mar · Departure 8:00 AM · 3 hours · Life vest and snorkel included.",
      es: "Temporada Nov–Mar · Salida 8:00 hrs · 3 horas · Chaleco y snorkel incluidos."
    },
    image: "explore-image2.jpg"
  },
  {
    id: "isla-espiritu-santo",
    title: { en: "Espíritu Santo Island", es: "Isla Espíritu Santo" },
    description: {
      en: "Departure 8:00 AM · Full day · Snorkel with sea lions · Lunch included.",
      es: "Salida 8:00 hrs · Día completo · Snorkel con lobos marinos · Comida incluida."
    },
    image: "espiritu_santo_1.jpg"
  },
  {
    id: "kayak-mar-cortes",
    title: { en: "Sea of Cortez Kayaking", es: "Kayak en el Mar de Cortés" },
    description: {
      en: "Departures 8:00 AM & 3:00 PM · 2.5 hours · Beginner friendly.",
      es: "Salidas 8:00 y 15:00 hrs · 2.5 horas · Apto para principiantes."
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
      en: "Departures 9:00, 11:00 & 1:00 PM · 3 hours · Balandra beach included.",
      es: "Salidas 9:00, 11:00 y 13:00 hrs · 3 horas · Playa Balandra incluida."
    },
    image: "balandra1.jpg"
  }
];
