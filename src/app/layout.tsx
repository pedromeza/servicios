import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "PGPM MEX · Admin", template: "%s · PGPM MEX" },
  description: "Administración de cuentas, suscripciones y licencias.",
  robots: { index: false, follow: false },
  applicationName: "PGPM MEX",
  manifest: "/manifest.webmanifest",
  icons: { icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }], apple: "/apple-touch-icon.png" },
  // iPhone: pantalla completa al abrir desde el icono.
  appleWebApp: { capable: true, title: "PGPM MEX", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = { themeColor: "#0b2244", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
