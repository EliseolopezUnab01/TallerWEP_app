import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    // Se evalúa después de public/: solo atiende archivos subidos tras el build.
    return [{ source: '/uploads/:ruta*', destination: '/api/uploads/:ruta*' }];
  },
  async headers() {
    return [{ source: '/uploads/:ruta*', headers: [{ key: 'X-Content-Type-Options', value: 'nosniff' }] }];
  },
};

export default nextConfig;
