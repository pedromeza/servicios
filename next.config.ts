import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El botón "Aplicar migraciones ahora" lee los .sql en tiempo de ejecución: hay que incluirlos en el paquete del servidor.
  outputFileTracingIncludes: {
    "/*": ["supabase/migrations/**/*.sql", "scripts/migrate-core.mjs"],
  },
  turbopack: {
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
