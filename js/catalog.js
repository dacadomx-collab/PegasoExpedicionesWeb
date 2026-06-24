/**
 * Pegaso Expediciones — Catálogo Print-First (i18n EN/ES)
 * Renderiza las tarjetas de servicio y su QR de WhatsApp en el idioma activo.
 * QR generado vía https://api.qrserver.com (format=svg, vector nítido en impresión).
 */

let currentLang = DEFAULT_LANG;

function buildWhatsAppUrl(message) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

function buildQrSrc(targetUrl, sizePx) {
  const size = `${sizePx}x${sizePx}`;
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}&format=svg&data=${encodeURIComponent(targetUrl)}`;
}

// El correo se reconstruye solo en memoria, en tiempo de ejecución: nunca existe
// como string literal "usuario@dominio" en el HTML ni en el JS fuente servido.
function getContactEmail() {
  return CONTACT_EMAIL_REVERSED.split("").reverse().join("");
}

function buildMailtoUrl(lang) {
  const email = getContactEmail();
  const { subject, body } = buildContactEmailContent(lang);
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function createServiceCard(service, lang) {
  const title = service.title[lang];
  const description = service.description[lang];
  const qrCaption = UI_STRINGS[lang].qrCaption;
  const message = buildCatalogMessage(title, lang);
  const whatsappUrl = buildWhatsAppUrl(message);
  const qrSrc = buildQrSrc(whatsappUrl, 220);

  const card = document.createElement("article");
  card.className = "service-card";
  card.id = service.id;

  card.innerHTML = `
    <div class="service-card__image-wrap">
      <img class="service-card__image" src="${IMAGE_BASE_PATH}${service.image}" alt="${title}" loading="lazy">
    </div>
    <div class="service-card__body">
      <h3 class="service-card__title">${title}</h3>
      <p class="service-card__description">${description}</p>
    </div>
    <div class="service-card__qr-wrap">
      <img class="service-card__qr" src="${qrSrc}" alt="WhatsApp QR — ${title}" width="220" height="220">
      <span class="service-card__qr-caption">${qrCaption}</span>
    </div>
  `;

  return card;
}

function renderCatalog(lang) {
  const grid = document.getElementById("catalog-grid");
  if (!grid) return;

  grid.innerHTML = "";
  CATALOG_SERVICES.forEach((service) => {
    grid.appendChild(createServiceCard(service, lang));
  });
}

function renderStaticStrings(lang) {
  const strings = UI_STRINGS[lang];

  document.documentElement.lang = lang;

  const titleEl = document.getElementById("catalog-title");
  if (titleEl) titleEl.textContent = strings.pageTitle;

  const subtitleEl = document.getElementById("catalog-subtitle");
  if (subtitleEl) subtitleEl.textContent = strings.subtitle;

  const printBtn = document.getElementById("print-catalog-btn");
  if (printBtn) printBtn.textContent = strings.printButton;

  const langBtn = document.getElementById("lang-switch-btn");
  if (langBtn) langBtn.textContent = strings.langSwitchLabel;

  const emailBtn = document.getElementById("email-contact-btn");
  if (emailBtn) emailBtn.textContent = strings.emailButton;

  // El email se inyecta como texto en tiempo de ejecución (no vive en el HTML
  // estático) y se muestra completo para que el usuario lo lea o lo copie a mano.
  const emailLine = document.getElementById("catalog-email-line");
  if (emailLine) emailLine.textContent = `${strings.emailIntro} ${getContactEmail()}`;

  document.title = `${strings.pageTitle} | Pegaso Expediciones`;
}

// Bloque exclusivo de impresión: en papel no hay clics ni portapapeles, así que el
// correo debe quedar legible directo en la hoja. La impresión es un espejo exacto
// del estado activo de la app: solo se inyecta el idioma que el usuario tiene
// seleccionado en ese momento (currentLang), nunca ambos a la vez. Oculto en
// pantalla vía CSS (.catalog-header__email-print) y revelado solo en @media print
// — el correo sigue reconstruyéndose en memoria con getContactEmail(), nunca como
// literal en el HTML/JS fuente.
function renderPrintEmail(lang) {
  const printEl = document.getElementById("catalog-email-print");
  if (!printEl) return;

  printEl.textContent = `${UI_STRINGS[lang].emailIntro} ${getContactEmail()}`;
}

function renderAll(lang) {
  renderStaticStrings(lang);
  renderCatalog(lang);
  renderPrintEmail(lang);
}

function bindPrintButton() {
  const printBtn = document.getElementById("print-catalog-btn");
  if (!printBtn) return;
  printBtn.addEventListener("click", () => window.print());
}

function bindLangSwitcher() {
  const langBtn = document.getElementById("lang-switch-btn");
  if (!langBtn) return;
  langBtn.addEventListener("click", () => {
    currentLang = currentLang === "en" ? "es" : "en";
    renderAll(currentLang);
  });
}

let emailFeedbackTimeoutId = null;

function showEmailFeedback(message) {
  const feedbackEl = document.getElementById("email-feedback");
  if (!feedbackEl) return;

  feedbackEl.textContent = message;
  if (emailFeedbackTimeoutId) clearTimeout(emailFeedbackTimeoutId);
  emailFeedbackTimeoutId = setTimeout(() => {
    feedbackEl.textContent = "";
  }, 4000);
}

function bindEmailButton() {
  const emailBtn = document.getElementById("email-contact-btn");
  if (!emailBtn) return;

  emailBtn.addEventListener("click", () => {
    const email = getContactEmail();

    // Resiliencia: si el dispositivo no tiene cliente de correo configurado,
    // el enlace mailto no hará nada visible — por eso copiamos la dirección
    // al portapapeles en paralelo para que la experiencia nunca se rompa.
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(email)
        .then(() => showEmailFeedback(UI_STRINGS[currentLang].emailCopiedFeedback))
        .catch(() => {});
    }

    window.location.href = buildMailtoUrl(currentLang);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  renderAll(currentLang);
  bindPrintButton();
  bindLangSwitcher();
  bindEmailButton();
});
