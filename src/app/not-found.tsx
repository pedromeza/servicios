import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-navy-50 p-6 text-center">
      <Logo variant="dark" />
      <div>
        <p className="text-6xl font-black text-navy-900">404</p>
        <p className="mt-2 text-slate-500">Esta página no existe.</p>
      </div>
      <Link href="/" className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
        Ir al panel
      </Link>
    </main>
  );
}
