🌐 DOCUMENTO MAESTRO: VISIÓN Y ESTADO DEL SISTEMA "PEGASO EXPEDICIONES"
Contexto del Proyecto:
Pegaso Expediciones (https://pegasoexpediciones.com) es una empresa de turismo de aventura en La Paz, BCS, México (Tiburón Ballena, Buceo, Espíritu Santo). Actualmente, su web es informativa. Estamos construyendo un motor de reservas personalizado y un Dashboard Administrativo (SaaS interno).

Stack Tecnológico (Arquitectura Élite v2):

Frontend Público & Dashboard: Next.js (App Router), React, Tailwind CSS v4, shadcn/ui.

Backend / API: PHP 8+ (PDO), RESTful APIs estrictas.

Base de Datos: MySQL (Relacional con uso de columnas JSON para datos dinámicos).

Pagos: PayPal Checkout SDK (Fase 1: Creación de orden en backend, Fase 2: Captura en frontend/backend).

Lo que YA TENEMOS funcionando:

Catálogo de expediciones conectado a BD.

Calendario con "Disponibilidad Dinámica" (Calcula cupos restantes restando las reservas de la capacidad diaria de la expedición).

Regla de negocio 24hrs: Reservas para "hoy o mañana" ocultan el pago online y muestran un botón de WhatsApp para contactar al Admin.

Flujo de pago Fase 1 completado y CORS estabilizado.

Lo que VAMOS A CONSTRUIR (El Reto para las IAs):

DASHBOARD ADMIN:

Login Seguro (JWT o Session base).

Panel de Configuración (system_settings en BD): Interfaz para cambiar llaves de PayPal, números de WhatsApp y mensajes automáticos sin tocar el código fuente.

Creador de Expediciones Dinámico: Capacidad de agregar expediciones y sumarles "condiciones dinámicas" (edad, restricciones médicas, qué llevar) usando JSON.

Gestión Operativa: Vista de calendario para bloquear días y exportación de manifiestos (Excel) para los capitanes de las lanchas.

MEJORAS DE EXPERIENCIA (UX/UI):

Requerimos ideas innovadoras para el cliente (ej. widgets de clima, interfaces sin fricción) y para el Admin (ej. gestión de turnos mañana/tarde, control de "sobreventa").

Instrucción para la IA (Claude / ChatGPT):
Lee este documento. Basado en esta arquitectura, actúa como mi Consultor de Producto y Experiencia de Usuario. Dame 3 ideas de alto impacto para mejorar el Frontend del cliente y 3 ideas para hacer el Dashboard del Admin la herramienta más poderosa de su negocio. Luego, dime cómo estructurarías la tabla system_settings en MySQL para hacer el panel de configuración seguro.