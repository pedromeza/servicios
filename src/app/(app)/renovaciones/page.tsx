import type { Metadata } from "next";
import { RemindersManager } from "@/components/renovaciones/RemindersManager";
import { getReminderSettings, renewalCandidates } from "@/lib/data";

export const metadata: Metadata = { title: "Renovaciones" };

export default async function RenovacionesPage({ searchParams }: PageProps<"/renovaciones">) {
  const sp = await searchParams;
  const settings = await getReminderSettings();
  const days = typeof sp.dias === "string" && Number(sp.dias) > 0 ? Number(sp.dias) : settings.reminder_days;
  const candidates = await renewalCandidates(days);
  const fromEmail = process.env.FROM_EMAIL ?? "PGPM MEX <onboarding@resend.dev>";
  const testTo = process.env.NOTIFY_EMAIL ?? "";
  const origin = process.env.APP_URL?.replace(/\/$/, "") ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "");
  const defaultLogoUrl = origin ? `${origin}/logo-email.png` : "/logo-email.png";
  return (
    <RemindersManager
      settings={settings}
      candidates={candidates}
      days={days}
      fromEmail={fromEmail}
      testTo={testTo}
      resendReady={Boolean(process.env.RESEND_API_KEY)}
      defaultLogoUrl={defaultLogoUrl}
    />
  );
}
