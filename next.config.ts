import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  experimental: {
    // El editor de branding sube logo/portada/fondo y hasta 8 fotos de galería
    // en un solo submit (server action). El límite por defecto (1MB) los rechaza.
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
