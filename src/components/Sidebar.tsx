"use client";

import { KeyRound, LayoutDashboard, LogOut, RefreshCw, ShieldCheck, Ticket, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/lib/actions";
import { cn } from "@/lib/cn";
import { Logo } from "./Logo";

const NAV = [
  { href: "/", label: "Panel", icon: LayoutDashboard },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/cuentas", label: "Cuentas", icon: KeyRound },
  { href: "/suscripciones", label: "Suscripciones", icon: RefreshCw },
  { href: "/licencias", label: "Licencias", icon: Ticket },
  { href: "/seguridad", label: "Seguridad", icon: ShieldCheck },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function Sidebar({ email }: { email: string }) {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-navy-900 text-white md:flex">
      <div className="px-6 pb-6 pt-7">
        <Logo />
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                active ? "bg-white/10 text-white shadow-inner" : "text-navy-200 hover:bg-white/5 hover:text-white",
              )}
            >
              <Icon size={18} className={active ? "text-brand" : ""} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 px-4 py-4">
        <p className="truncate text-xs text-navy-200" title={email}>
          {email}
        </p>
        <form action={logout} className="mt-2">
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-navy-200 transition hover:bg-white/5 hover:text-white"
          >
            <LogOut size={16} /> Cerrar sesión
          </button>
        </form>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 bg-navy-900 text-white md:hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <Logo compact />
        <form action={logout}>
          <button type="submit" aria-label="Cerrar sesión" className="rounded-lg p-2 text-navy-200 hover:bg-white/10 hover:text-white">
            <LogOut size={18} />
          </button>
        </form>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-3 [scrollbar-width:none]">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium",
                active ? "bg-brand text-white" : "bg-white/10 text-navy-200",
              )}
            >
              <Icon size={14} /> {label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
