"use client";

import { Eye, MessageCircle, Save, Send } from "lucide-react";
import { useActionState, useMemo, useState } from "react";
import { saveReminderSettings, sendReminderTest, type ActionState } from "@/lib/actions";
import { fillTemplate, parseAutoDays, reminderHtml, REMINDER_VARS, SAMPLE_VARS, type ReminderSettings } from "@/lib/reminders";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, FormError, Input, Textarea } from "@/components/ui/Fields";

export function TemplateEditor({
  settings,
  testTo,
  resendReady,
  defaultLogoUrl,
}: {
  settings: ReminderSettings;
  testTo: string;
  resendReady: boolean;
  defaultLogoUrl: string;
}) {
  const [form, setForm] = useState<ReminderSettings>(settings);
  const [saveState, saveAction, saving] = useActionState<ActionState, FormData>(saveReminderSettings, null);
  const [testState, testAction, testing] = useActionState<ActionState, FormData>(sendReminderTest, null);
  const e = saveState?.errors ?? testState?.errors ?? {};
  const set = (k: keyof ReminderSettings) => (ev: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({
      ...f,
      [k]: k === "reminder_days" ? Number(ev.target.value) : k === "auto_remind" ? (ev.target as HTMLInputElement).checked : ev.target.value,
    }));
  const autoDays = parseAutoDays(form.auto_days);
  const waPreview = fillTemplate(form.whatsapp_body, { ...SAMPLE_VARS, whatsapp: form.whatsapp || SAMPLE_VARS.whatsapp });

  // Vista previa en vivo con datos de ejemplo: lo que ves es exactamente lo que recibirá el cliente.
  const preview = useMemo(
    () => reminderHtml({ ...form, logo_url: form.logo_url || defaultLogoUrl }, { ...SAMPLE_VARS, whatsapp: form.whatsapp || SAMPLE_VARS.whatsapp }),
    [form, defaultLogoUrl],
  );

  return (
    <Card>
      <CardHeader
        title="Plantilla del correo de renovación"
        description="Edita el texto, mira la vista previa y mándate una prueba antes de enviarla a clientes."
      />
      <div className="grid gap-6 px-5 py-5 lg:grid-cols-2">
        <form id="reminder-template" className="space-y-4">
          <FormError message={saveState?.error ?? testState?.error} />
          <Field label="Asunto" error={e.reminder_subject}>
            <Input name="reminder_subject" value={form.reminder_subject} onChange={set("reminder_subject")} required />
          </Field>
          <Field label="Mensaje" error={e.reminder_body} hint="Deja una línea en blanco entre párrafos.">
            <Textarea name="reminder_body" value={form.reminder_body} onChange={set("reminder_body")} className="min-h-[260px] font-mono text-[13px]" required />
          </Field>
          <div className="rounded-lg border border-navy-100 bg-navy-50 px-3 py-2 text-xs text-slate-600">
            <span className="font-semibold text-navy-900">Variables disponibles:</span>{" "}
            {REMINDER_VARS.map(([k, label]) => (
              <span key={k} className="mr-2 inline-block" title={label}>
                <code className="rounded bg-white px-1 text-navy-800">{`{{${k}}}`}</code>
              </span>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Texto del botón" error={e.reminder_button}>
              <Input name="reminder_button" value={form.reminder_button} onChange={set("reminder_button")} required />
            </Field>
            <Field label="Enlace de pago (Mercado Libre)" error={e.payment_url} hint="A dónde lleva el botón. Vacío = sin botón.">
              <Input name="payment_url" type="url" value={form.payment_url} onChange={set("payment_url")} placeholder="https://articulo.mercadolibre.com.mx/…" />
            </Field>
            <Field label="WhatsApp de atención" error={e.whatsapp} hint="Se muestra al pie del correo.">
              <Input name="whatsapp" value={form.whatsapp} onChange={set("whatsapp")} placeholder="+52 55 1234 5678" />
            </Field>
            <Field label="Avisar con (días de anticipación)" error={e.reminder_days}>
              <Input name="reminder_days" type="number" min={1} max={365} value={form.reminder_days} onChange={set("reminder_days")} />
            </Field>
          </div>
          <Field label="Logo (opcional)" error={e.logo_url} hint="Vacío = logotipo de PGPM MEX incluido en la app. Pon un enlace público a un PNG o JPG si quieres usar otro.">
            <Input name="logo_url" type="url" value={form.logo_url} onChange={set("logo_url")} placeholder="https://…/logo.png" />
          </Field>

          <div className={`rounded-xl border p-4 ${form.auto_remind ? "border-emerald-200 bg-emerald-50/60" : "border-navy-100 bg-navy-50/60"}`}>
            <label className="flex items-start gap-3">
              <input type="checkbox" name="auto_remind" checked={form.auto_remind} onChange={set("auto_remind")} className="mt-1 accent-brand" />
              <span>
                <span className="block font-semibold text-navy-900">Enviar recordatorios automáticamente</span>
                <span className="block text-xs text-slate-600">
                  Cada día, la app manda este correo a los clientes cuya suscripción vence en los días indicados. No repite el aviso a quien ya lo recibió
                  en esa semana. Los envíos quedan en “Último aviso” marcados como automáticos.
                </span>
              </span>
            </label>
            <div className="mt-3">
              <Field label="Días antes del vencimiento" error={e.auto_days} hint={autoDays.length ? `Se avisará ${autoDays.map((d) => (d === 0 ? "el mismo día" : `${d} días antes`)).join(", ")}.` : "Escribe números separados por coma."}>
                <Input name="auto_days" value={form.auto_days} onChange={set("auto_days")} placeholder="30,15,3" disabled={!form.auto_remind} />
              </Field>
            </div>
          </div>

          <Field
            label="Mensaje de WhatsApp"
            error={e.whatsapp_body}
            hint="Lo abre el botón de WhatsApp en Renovaciones y en la ficha del cliente, ya escrito; tú solo pulsas enviar. Mismas variables."
          >
            <Textarea name="whatsapp_body" value={form.whatsapp_body} onChange={set("whatsapp_body")} className="min-h-[110px]" required />
          </Field>
          <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-[#e7ffdb] px-3 py-2 text-sm text-slate-800">
            <MessageCircle size={16} className="mt-0.5 shrink-0 text-emerald-600" />
            <p className="whitespace-pre-wrap">{waPreview}</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            {saveState?.ok && <span className="mr-auto text-xs text-emerald-700">Plantilla guardada. Es la que se usará al enviar a clientes.</span>}
            {testState?.ok && <span className="mr-auto text-xs text-emerald-700">Prueba enviada a {testState.errors?._sent_to}. Revisa tu bandeja.</span>}
            <Button type="submit" variant="secondary" formAction={testAction} disabled={testing || !resendReady} title={resendReady ? undefined : "Falta RESEND_API_KEY"}>
              <Send size={15} /> {testing ? "Enviando…" : `Enviarme una prueba${testTo ? ` a ${testTo}` : ""}`}
            </Button>
            <Button type="submit" formAction={saveAction} disabled={saving}>
              <Save size={15} /> {saving ? "Guardando…" : "Guardar plantilla"}
            </Button>
          </div>
        </form>

        <div className="min-w-0">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <Eye size={13} /> Vista previa con datos de ejemplo
          </p>
          <p className="mb-2 truncate rounded-lg bg-navy-50 px-3 py-2 text-sm text-navy-900">
            <span className="text-slate-500">Asunto:</span> {preview.subject}
          </p>
          <iframe title="Vista previa del correo" srcDoc={preview.html} sandbox="" className="h-[640px] w-full rounded-xl border border-navy-100 bg-white" />
        </div>
      </div>
    </Card>
  );
}
