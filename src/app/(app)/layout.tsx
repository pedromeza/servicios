import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth";
import { MobileNav, Sidebar } from "@/components/Sidebar";
import { SchemaNotice } from "@/components/ui/SchemaNotice";
import { pendingMigrations } from "@/lib/data";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { user } = await requireUser();
  const email = user.email ?? "";
  const pending = await pendingMigrations().catch(() => []);
  return (
    <div className="min-h-screen overflow-x-clip">
      <Sidebar email={email} />
      <MobileNav />
      <main className="min-w-0 md:pl-64">
        <div className="mx-auto w-full min-w-0 max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <SchemaNotice pending={pending} />
          {children}
        </div>
      </main>
    </div>
  );
}
