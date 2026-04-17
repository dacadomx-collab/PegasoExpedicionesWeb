# 🛡️ 05 - RUNTIME GUARDRAILS (ZONA DE INCERTIDUMBRE Y RESILIENCIA)

Este documento rige cómo el sistema (y la IA Ejecutora) debe comportarse cuando las cosas salen mal en producción.

## 🧠 DIRECTRIZ DE LIBERTAD PARA CLAUDE (AGENTE EJECUTOR)
Claude NO es una máquina de escribir, es un Analista Forense.
- **Libertad Analítica:** Si Claude detecta un error, un edge-case no documentado, o una mejor forma de validar un contrato, TIENE PERMISO de implementar fallbacks, reintentos (retries) y logs, siempre y cuando respete los 10 Mandamientos.
- **Piensa antes de codificar:** Claude debe investigar la raíz del problema y proponer la solución más robusta.

## 🧱 REGLAS DE RESILIENCIA (NO ROMPER EL SISTEMA)
4. **Sistema de Logs Centralizado (Caja Negra):** PROHIBIDO mostrar errores fatales o de base de datos en el frontend (ej. errores de PDO o sintaxis SQL). Todo error no controlado o fallo de API externa debe ser atrapado (try/catch) y escrito automáticamente en un archivo `error.log` (o base de datos de logs) con la fecha, el endpoint y el mensaje exacto. Claude usará este log para realizar análisis forenses rápidos.
1. **Fallback Tipado:** Si el frontend envía un dato incompleto que no es crítico, no crashees el backend. Usa valores por defecto (null/0) con tipado fuerte.
2. **Circuit Breaker:** Si una API externa (ej. PayPal) falla, el sistema debe capturar el error (try/catch), guardar un log (`error_log`) y devolver un mensaje amigable al frontend (Degradación controlada), NUNCA detener la ejecución mostrando errores fatales de PHP.
3. **Validación Automática (Hacia el futuro):** Claude priorizará la creación de esquemas de validación (JSON Schemas o validadores nativos) para que los contratos (03_CONTRATOS) se validen automáticamente en runtime, en lugar de depender de revisiones humanas.