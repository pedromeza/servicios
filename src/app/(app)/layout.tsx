import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth";
import { AppShell, SIDEBAR_COOKIE } from "@/components/AppShell";
import { SchemaNotice } from "@/components/ui/SchemaNotice";
import { pendingMigrations } from "@/lib/data";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { user } = await requireUser();
  const email = user.email ?? "";
  const pending = await pendingMigrations().catch(() => []);
  // Vercel define VERCEL_GIT_COMMIT_SHA al compilar; sirve para saber qué versión está desplegada.
  const version = (process.env.VERCEL_GIT_COMMIT_SHA ?? "local").slice(0, 7);
  const initialCollapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === "1";
  return (
    <AppShell email={email} version={version} initialCollapsed={initialCollapsed}>
      <SchemaNotice pending={pending} hasDatabaseUrl={Boolean(process.env.DATABASE_URL || process.env.SUPABASE_DB_PASSWORD)} />
      {children}
    </AppShell>
  );
}
