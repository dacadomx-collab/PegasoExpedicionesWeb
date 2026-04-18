/**
 * Pegaso Lightbox — Vanilla JS, zero dependencies.
 * Activates on any <img> inside a <figure class="expedition-card">.
 */
(function () {
    'use strict';

    let overlay, imgEl, captionEl;

    function buildOverlay() {
        overlay = document.createElement('div');
        overlay.id = 'pegaso-lightbox';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', 'Imagen ampliada');

        const inner = document.createElement('div');
        inner.className = 'lb-inner';

        const closeBtn = document.createElement('button');
        closeBtn.className = 'lb-close';
        closeBtn.innerHTML = '&times;';
        closeBtn.setAttribute('aria-label', 'Cerrar');
        closeBtn.addEventListener('click', closeLightbox);

        imgEl = document.createElement('img');
        imgEl.alt = '';

        captionEl = document.createElement('p');
        captionEl.className = 'lb-caption';

        inner.appendChild(closeBtn);
        inner.appendChild(imgEl);
        inner.appendChild(captionEl);
        overlay.appendChild(inner);
        document.body.appendChild(overlay);

        /* Close on backdrop click (outside .lb-inner) */
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) closeLightbox();
        });
    }

    function openLightbox(src, alt) {
        if (!overlay) buildOverlay();

        imgEl.src = src;
        imgEl.alt = alt || '';
        captionEl.textContent = alt || '';

        overlay.classList.add('lb-open');
        document.body.style.overflow = 'hidden';
        overlay.querySelector('.lb-close').focus();
    }

    function closeLightbox() {
        if (!overlay) return;
        overlay.classList.remove('lb-open');
        document.body.style.overflow = '';
        imgEl.src = '';
    }

    /* Keyboard: Escape closes */
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeLightbox();
    });

    /* Bind to all expedition-card images (handles dynamic content too) */
    function bindImages() {
        document.querySelectorAll('figure.expedition-card img').forEach(function (img) {
            if (img.dataset.lightboxBound) return;
            img.dataset.lightboxBound = '1';
            img.style.cursor = 'zoom-in';

            img.addEventListener('click', function () {
                const src = img.dataset.full || img.src;
                const alt = img.alt || img.closest('figure')
                    .nextElementSibling?.querySelector('h4')?.textContent || '';
                openLightbox(src, alt);
            });

            /* Keyboard accessibility: Enter/Space on focused img */
            img.setAttribute('tabindex', '0');
            img.setAttribute('role', 'button');
            img.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    img.click();
                }
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindImages);
    } else {
        bindImages();
    }
}());
