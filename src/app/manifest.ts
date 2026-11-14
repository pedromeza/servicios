import type { MetadataRoute } from "next";

/** Manifiesto para instalar la app en el teléfono (Añadir a pantalla de inicio). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PGPM MEX Admin",
    short_name: "PGPM MEX",
    description: "Cuentas, suscripciones, licencias, renovaciones y lealtad de PGPM MEX.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4f6fa",
    theme_color: "#0b2244",
    lang: "es",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
