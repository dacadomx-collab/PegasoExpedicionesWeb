/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export', // Next.js genere la carpeta "out"
  trailingSlash: true,
  images: {
    unoptimized: true, // Requerido para exportación estática
  },
};

export default nextConfig;