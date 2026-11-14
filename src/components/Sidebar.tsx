"use client";

import { BellRing, ChevronLeft, ChevronRight, Gift, KeyRound, LayoutDashboard, LogOut, Menu, RefreshCw, ShieldCheck, Ticket, Users, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/lib/actions";
import { cn } from "@/lib/cn";
import { Logo, LogoMark } from "./Logo";

const NAV = [
  { href: "/", label: "Panel", icon: LayoutDashboard },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/cuentas", label: "Cuentas", icon: KeyRound },
  { href: "/suscripciones", label: "Suscripciones", icon: RefreshCw },
  { href: "/licencias", label: "Licencias", icon: Ticket },
  { href: "/renovaciones", label: "Renovaciones", icon: BellRing },
  { href: "/lealtad", label: "Lealtad", icon: Gift },
  { href: "/seguridad", label: "Seguridad", icon: ShieldCheck },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function NavLinks({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className={cn("flex-1 space-y-1", collapsed ? "px-2" : "px-3")}>
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            title={collapsed ? label : undefined}
            aria-label={collapsed ? label : undefined}
            className={cn(
              "flex items-center gap-3 rounded-xl text-sm font-medium transition",
              collapsed ? "justify-center px-0 py-2.5" : "px-3 py-2.5",
              active ? "bg-white/10 text-white shadow-inner" : "text-navy-200 hover:bg-white/5 hover:text-white",
            )}
          >
            <Icon size={18} className={cn("shrink-0", active && "text-brand")} />
            {!collapsed && <span className="truncate">{label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

function LogoutButton({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <form action={logout}>
      <button
        type="submit"
        title={collapsed ? "Cerrar sesión" : undefined}
        aria-label="Cerrar sesión"
        className={cn(
          "flex w-full items-center gap-2 rounded-lg py-1.5 text-sm text-navy-200 transition hover:bg-white/5 hover:text-white",
          collapsed ? "justify-center px-0" : "px-2",
        )}
      >
        <LogOut size={16} /> {!collapsed && "Cerrar sesión"}
      </button>
    </form>
  );
}

/** Barra lateral de escritorio, contraíble a solo iconos. */
export function Sidebar({ email, version, collapsed, onToggle }: { email: string; version: string; collapsed: boolean; onToggle: () => void }) {
  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 hidden flex-col bg-navy-900 text-white transition-[width] duration-200 md:flex",
        collapsed ? "w-16" : "w-64",
      )}
    >
      <div className={cn("flex items-center pb-6 pt-6", collapsed ? "justify-center px-0" : "px-6")}>
        {collapsed ? (
          <Link href="/" aria-label="Panel">
            <LogoMark size={36} />
          </Link>
        ) : (
          <Logo />
        )}
      </div>
      <NavLinks collapsed={collapsed} />
      <div className={cn("border-t border-white/10 py-4", collapsed ? "px-2" : "px-4")}>
        {!collapsed && (
          <p className="truncate text-xs text-navy-200" title={email}>
            {email}
          </p>
        )}
        <div className={cn(!collapsed && "mt-2")}>
          <LogoutButton collapsed={collapsed} />
        </div>
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Expandir menú" : "Contraer menú"}
          title={collapsed ? "Expandir menú" : "Contraer menú"}
          className={cn(
            "mt-2 flex w-full items-center gap-2 rounded-lg py-1.5 text-xs text-navy-200/80 transition hover:bg-white/5 hover:text-white",
            collapsed ? "justify-center px-0" : "px-2",
          )}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          {!collapsed && "Contraer menú"}
        </button>
        {!collapsed && (
          <p className="mt-2 font-mono text-[10px] text-navy-200/60" title="Versión desplegada">
            v. {version}
          </p>
        )}
      </div>
    </aside>
  );
}

/** Barra superior en móvil: logo y botón de menú. */
export function MobileTopBar({ onOpen }: { onOpen: () => void }) {
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between bg-navy-900 px-3 py-2.5 text-white md:hidden">
      <button
        type="button"
        onClick={onOpen}
        aria-label="Abrir menú"
        className="rounded-lg p-2 text-navy-200 transition hover:bg-white/10 hover:text-white"
      >
        <Menu size={22} />
      </button>
      <Link href="/" aria-label="Panel">
        <Logo compact />
      </Link>
      <span className="w-10" aria-hidden="true" />
    </header>
  );
}

/** Menú lateral desplegable en móvil. */
export function MobileDrawer({ open, onClose, email, version }: { open: boolean; onClose: () => void; email: string; version: string }) {
  return (
    <div className={cn("fixed inset-0 z-50 md:hidden", open ? "" : "pointer-events-none")} aria-hidden={!open}>
      <div
        className={cn("absolute inset-0 bg-navy-950/60 backdrop-blur-sm transition-opacity duration-200", open ? "opacity-100" : "opacity-0")}
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Menú"
        className={cn(
          "absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-navy-900 text-white shadow-2xl transition-transform duration-200",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-4 pb-4 pt-4">
          <Logo compact />
          <button type="button" onClick={onClose} aria-label="Cerrar menú" className="rounded-lg p-2 text-navy-200 hover:bg-white/10 hover:text-white">
            <X size={20} />
          </button>
        </div>
        <NavLinks onNavigate={onClose} />
        <div className="border-t border-white/10 px-4 py-4">
          <p className="truncate text-xs text-navy-200" title={email}>
            {email}
          </p>
          <div className="mt-2">
            <LogoutButton />
          </div>
          <p className="mt-2 font-mono text-[10px] text-navy-200/60">v. {version}</p>
        </div>
      </aside>
    </div>
  );
}
