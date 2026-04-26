/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',        // Genera la carpeta "out" para despliegue estático
  trailingSlash: true,     // /admin/login → /admin/login/ (compatibilidad Apache)
  basePath: '/portal',     // Subpath donde vive la app en producción
  assetPrefix: '/portal',  // Hace que /_next/... se sirva desde /portal/_next/...
  images: {
    unoptimized: true,     // Requerido para exportación estática
  },
};

export default nextConfig;