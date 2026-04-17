# 📜 LOS 10 MANDAMIENTOS DEL GÉNESIS (LEY SUPREMA)

## ⚖️ DECLARACIÓN DE AUTORIDAD
Este documento rige sobre cualquier sugerencia de la IA. La IA es una ejecutora DETERMINÍSTICA, no creativa. 

## ⚖️ LOS MANDAMIENTOS
1. **Mobile-First & Responsivo:** Todo componente nace para celular. Prohibido el uso de anchos fijos (px) en contenedores principales.
2. **Seguridad Nivel Militar:** Sanitización obligatoria de inputs. Uso de Prepared Statements. Blindaje contra Inyección SQL, XSS y CSRF.
3. **Modo Oscuro & Toggle Nativo:** Soporte de tema fluido (Light/Dark). Contraste mínimo 4.5:1 (Estándar WCAG 2.1).
4. **Protocolo Anti-Alucinación:** PROHIBIDO inventar variables. Si no existe en el `02_SYSTEM_CODEX_REGISTRY.md`, la IA debe DETENERSE.
5. **Contrato de API Estricto:** Prohibido alterar nombres de propiedades JSON definidos en `03_CONTRATOS_API_Y_LOGICA.md`.
6. **Ejecución Determinística:** No se permiten "mejoras" o "extensiones" no solicitadas. 
7. **Naming Registry:** `snake_case` para Backend/DB; `camelCase` para Frontend/React.
8. **Detección de Dead Code:** Auditoría obligatoria para eliminar funciones, imports y variables huérfanas antes de cada entrega.
9. **Inmutabilidad del Sistema:** La IA NO puede crear tablas o alterar esquemas de DB sin autorización humana explícita.
10. **Sinónimos Prohibidos:** Solo existe UN nombre válido por concepto. Cero tolerancia a traducciones libres.
11. **Arranque Blindado (Fundación del Proyecto):** NINGÚN proyecto puede iniciar su desarrollo visual o lógico sin antes haber establecido la "Fundación de Seguridad". Esto exige que los primeros 4 archivos en crearse sean: `.env` (credenciales locales/servidor), `.env.example` (plantilla pública), `.htaccess` (blindaje Apache Nivel Militar) y `api/conexion.php` (Conexión PDO centralizada y segura).

## ⚖️ LOS MANDAMIENTOS (INFRAESTRUCTURA v2)
12. **Bóveda de Secretos (.env):** OBLIGATORIO. Absolutamente toda credencial debe vivir en el `.env`. Prohibido quemar (hardcode) llaves en el código.
13. **Aislamiento de Entornos (Anti-Bomba):** PROHIBIDO que el entorno Local apunte a la Base de Datos de Producción. Se usarán 3 entornos: Local (DB con seeders/datos falsos), Staging (espejo) y Producción. Nunca se toca producción desde localhost.
14. **Seguridad de Endpoints (CORS ≠ Auth):** CORS no detiene a Postman. Todo endpoint que modifique datos (POST/PUT/DELETE) DEBE requerir autenticación real (ej. validación de JWT o Tokens de sesión). Sin token = 401 Unauthorized antes de tocar la DB.
15. **Agente Residente (CLAUDE.md):** Ningún proyecto arranca sin su archivo `CLAUDE.md`.