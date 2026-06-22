# 🛡️ REPORTE DE AUDITORÍA FORENSE Y HARDENING DEL SERVIDOR
**Proyecto:** Pegaso Expediciones Web  
**Fecha del Incidente:** 12 de Junio de 2026  
**Fecha de Resolución:** 15 de Junio de 2026  
**Estatus Actual:** [CLEAN / ONLINE]  

---

## 1. Anatomía del Ataque (Cómo operó el virus)
* **Tipo de Amenaza:** Phishing Kit industrializado de cosecha de credenciales corporativas (BEC - Business Email Compromise).
* **Objetivo Real:** El atacante no buscaba robar datos de Pegaso Expediciones. Utilizó la excelente reputación del dominio y el certificado SSL válido del servidor para alojar páginas falsas y evadir los filtros de spam de Microsoft.
* **Infraestructura C2 Detectada:** Los archivos maliciosos redirigían de forma oculta a servidores de Comando y Control (C2) alojados en los dominios `businessprotect360.de` (Alemania) y `sekatroo.support`.

## 2. Vectores de Entrada y Persistencia
1. **Inyección CRLF/SMTP en Código Legacy:** El script `contact-form.php` original de la plantilla aceptaba variables globales sin sanitizar (`$_REQUEST['con_email']`). Los atacantes usaron peticiones POST automatizadas mediante bots para inyectar saltos de línea (`%0d%0a`) en las cabeceras del servidor de correo, convirtiendo el hosting en un relay de spam masivo.
2. **Estrategia de Evasión Oculta:** El malware no modificó el index ni los archivos legítimos del sitio. Creó directorios fantasmas con nombres comunes (`/files/`, `/court/`, `/docx/`, `/Prosp_196429/`) para alojar los kits de clonación de identidad de Microsoft 365. El canal de datos viajaba mediante hashes en la URL (`#`), haciéndose invisible en los logs estándar de Apache.

## 3. Acciones de Mitigación y Blindaje Aplicadas (AXON DCD Standard)
* **Aislamiento en Git:** Se creó la regla estricta `BackUp_VIRUS/` en el archivo `.gitignore` para resguardar las muestras en un entorno aislado local para estudio académico, asegurando que jamás se vuelvan a versionar o subir.
* **Refactor Completo de Formulario:** Se reescribió `contact-form.php` desde cero. Se eliminaron parámetros muertos, se implementó `filter_var()` con la bandera `FILTER_VALIDATE_EMAIL`, y se añadió una función dedicada para purgar retornos de carro (`\r\n`), destruyendo el vector de inyección de cabeceras.
* **Limpieza Absoluta de Producción:** Se purgó el directorio `public_html` en el cPanel de GreenGeeks, eliminando de forma permanente todas las carpetas raíz infectadas y residuos temporales en `tmp/`.
* **Rotación de Credenciales:** Se cambiaron de forma total las contraseñas de acceso root de cPanel, usuarios FTP de despliegue y usuarios con privilegios en la base de datos MySQL `pegaso_web_services_DB`.