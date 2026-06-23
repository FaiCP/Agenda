import type { NextConfig } from "next";

// Cabeceras de seguridad aplicadas a todas las rutas. No incluimos una CSP
// completa de script-src para no romper el runtime de Next; sí bloqueamos el
// embebido (clickjacking) y forzamos HTTPS y nosniff.
const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(self), geolocation=()",
  },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
];

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  experimental: {
    // El editor de branding sube logo/portada/fondo y fotos de galería en un
    // solo submit (server action). El límite por defecto (1MB) los rechaza;
    // 30mb cubre los flujos reales sin dejar una superficie de DoS tan amplia.
    serverActions: {
      bodySizeLimit: "30mb",
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
