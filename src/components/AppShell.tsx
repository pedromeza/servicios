"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { MobileDrawer, MobileTopBar, Sidebar } from "./Sidebar";

export const SIDEBAR_COOKIE = "pgpm_sidebar";

/**
 * Estructura de la app: barra lateral contraíble en escritorio y menú desplegable en móvil.
 * Vive en el cliente porque el estado (contraído / abierto) cambia el ancho del contenido.
 * La preferencia "contraída" viaja en una cookie para que el servidor la pinte igual desde el primer render.
 */
export function AppShell({ email, version, initialCollapsed, children }: { email: string; version: string; initialCollapsed: boolean; children: ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  // El menú móvil queda "abierto en esta ruta": al navegar a otra, se cierra solo sin efectos.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (v: boolean) => setOpenOn(v ? pathname : null);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((c) => {
      document.cookie = `${SIDEBAR_COOKIE}=${c ? "0" : "1"}; path=/; max-age=31536000; samesite=lax`;
      return !c;
    });
  }, []);

  // Bloquea el scroll del fondo y cierra con Escape mientras el menú móvil está abierto.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenOn(null);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="min-h-screen overflow-x-clip">
      <Sidebar email={email} version={version} collapsed={collapsed} onToggle={toggleCollapsed} />
      <MobileTopBar onOpen={() => setOpen(true)} />
      <MobileDrawer open={open} onClose={() => setOpen(false)} email={email} version={version} />
      <main className={cn("min-w-0 transition-[padding] duration-200", collapsed ? "md:pl-16" : "md:pl-64")}>
        <div className="mx-auto w-full min-w-0 max-w-7xl px-4 py-5 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
