# 🧪 PROTOCOLOS DE VUELO (CHECKLISTS DE CALIDAD)

## 🤖 DIRECTRIZ DE AGENTE AUTÓNOMO (VS CODE)
La IA (Claude) actúa como un Agente Integrado con permisos de lectura/escritura en el sistema de archivos.
- **PROHIBIDO:** Entregar bloques de código largos para que el humano los copie y pegue manualmente.
- **OBLIGATORIO:** La IA debe buscar, abrir, editar, guardar y verificar los archivos directamente usando sus herramientas de entorno.
- **FLUJO DE TRABAJO:** El Arquitecto (Humano + Gemini) define la estrategia y la arquitectura. La IA ejecuta el código directamente en los archivos, hace las pruebas locales necesarias y reporta un "Informe de Operación" detallado al terminar.

## 🛫 PRE-CODE CHECKLIST (OBLIGATORIO)
Antes de generar código, la IA debe confirmar:
- [ ] ¿Las variables están registradas en el Codex?
- [ ] ¿El endpoint respeta el Contrato de API?
- [ ] ¿El diseño propuesto es Mobile-First?
- [ ] ¿Existe una Regla de Piedra que afecte esta lógica?

## 🛡️ FOUNDATION CHECK (ARRANQUE DE PROYECTO)
Al iniciar un proyecto desde cero, la IA debe preguntar y confirmar:
- [ ] ¿Están creados los archivos de Fundación (`.env`, `.env.example`, `.htaccess`, `conexion.php`)?
- [ ] ¿El `.htaccess` tiene las reglas de bloqueo de carpetas ocultas y enrutamiento limpio?
- [ ] ¿El `.gitignore` está configurado para proteger el `.env` real?

## 🔒 SYSTEM IMMUTABILITY CHECK
- [ ] ¿Estoy intentando crear una tabla o campo nuevo sin permiso? (DETENERSE SI ES SÍ).
- [ ] ¿Estoy intentando "optimizar" algo que altera el Codex? (DETENERSE SI ES SÍ).

## 🛬 POST-CODE VALIDATION (AUTO-AUDITORÍA Y LINTERS)
Antes de entregar el código al usuario:
- [ ] **Linters y Formateo:** ¿El código pasó por un formateador estándar (Prettier para JS/HTML, PHP_CodeSniffer para PHP)? Cero tiempo perdido en tabulaciones manuales.
- [ ] **Limpieza:** ¿Eliminé variables e imports no usados? (Dead Code).
- [ ] **Seguridad:** ¿Sanitice inputs y protegí contra tipos erróneos (NaN/Null)?

## 🚀 PROTOCOLO DE DESPLIEGUE (CI/CD Y TESTING)
Antes de hacer PUSH a producción, el sistema debe superar estas 3 capas de verdad:
- [ ] **Smoke Tests:** ¿El login y el flujo principal (ej. proceso de pago) funcionan de inicio a fin en el entorno de Staging?
- [ ] **Contract Testing:** ¿El frontend envía exactamente lo que el backend espera y viceversa?
- [ ] **Aislamiento:** ¿Confirmé que el `.env` local no se subirá a GitHub?

## 🛡️ AUDITORÍA FINAL DE SEGURIDAD (AXON DCD)
NINGÚN proyecto se da por terminado sin pasar por el motor de inteligencia perimetral AXON DCD (`/AXON_DCD/index.php`). El Arquitecto debe confirmar:
- [ ] **Permisos Seguros:** ¿AXON DCD validó que los directorios tienen permisos `755` y los archivos `644`?
- [ ] **Cero Fugas:** ¿AXON DCD confirmó que no hay archivos críticos expuestos (`.env`, `config.php`, `.sql`)?
- [ ] **Aprobación de Radares:** ¿Se pasaron los radares de Cabeceras de Seguridad, OSINT, SSL y Escáner de Puertos?

## ✅ POST-IMPLEMENTACIÓN (DOCUMENTACIÓN VIVA)
Después de que el usuario confirme que un componente (Frontend o Backend) funciona sin errores, la IA debe proponer la actualización obligatoria del Codex y los registros del proyecto.
- [ ] **Codex Actualizado:** ¿Se registró la nueva tabla, variable o componente en el `02_SYSTEM_CODEX_REGISTRY.md`?
- [ ] **Contrato Verificado:** ¿El endpoint documentado en `03_CONTRATOS_API_Y_LOGICA.md` coincide 100% con el código final?
- [ ] **Cierre de Hito:** ¿Se informó al Arquitecto sobre el estado final y los archivos tocados?

## 🚀 PROTOCOLO DE DESPLIEGUE (CI/CD GITHUB)
Antes de hacer PUSH a la rama principal en GitHub Desktop, el Agente y el Arquitecto deben confirmar:
- [ ] ¿El código funciona perfectamente en local (`C:\xampp\htdocs\PROYECTO`) conectado a la DB remota?
- [ ] ¿Los cambios en BD se aplicaron directamente en el servidor remoto?
- [ ] ¿El `.gitignore` está ocultando el `.env` para que no se suba a GitHub?
- [ ] ¿Se verificó que el `deploy.yml` (GitHub Actions) ejecutará el pase a producción sin romper la versión actual?