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

  document.title = `${strings.pageTitle} | Pegaso Expediciones`;
}

function renderAll(lang) {
  renderStaticStrings(lang);
  renderCatalog(lang);
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

document.addEventListener("DOMContentLoaded", () => {
  renderAll(currentLang);
  bindPrintButton();
  bindLangSwitcher();
});
