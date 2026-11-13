"use client";

import { Eye, Save, Send } from "lucide-react";
import { useActionState, useMemo, useState } from "react";
import { saveReminderSettings, sendReminderTest, type ActionState } from "@/lib/actions";
import { reminderHtml, REMINDER_VARS, SAMPLE_VARS, type ReminderSettings } from "@/lib/reminders";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, FormError, Input, Textarea } from "@/components/ui/Fields";

export function TemplateEditor({ settings, testTo, resendReady }: { settings: ReminderSettings; testTo: string; resendReady: boolean }) {
  const [form, setForm] = useState<ReminderSettings>(settings);
  const [saveState, saveAction, saving] = useActionState<ActionState, FormData>(saveReminderSettings, null);
  const [testState, testAction, testing] = useActionState<ActionState, FormData>(sendReminderTest, null);
  const e = saveState?.errors ?? testState?.errors ?? {};
  const set = (k: keyof ReminderSettings) => (ev: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: k === "reminder_days" ? Number(ev.target.value) : ev.target.value }));

  // Vista previa en vivo con datos de ejemplo: lo que ves es exactamente lo que recibirá el cliente.
  const preview = useMemo(() => reminderHtml(form, { ...SAMPLE_VARS, whatsapp: form.whatsapp || SAMPLE_VARS.whatsapp }), [form]);

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
          <Field label="Logo (opcional)" error={e.logo_url} hint="Enlace público a una imagen PNG o JPG. Si lo dejas vacío se usa el nombre PGPM MEX.">
            <Input name="logo_url" type="url" value={form.logo_url} onChange={set("logo_url")} placeholder="https://…/logo.png" />
          </Field>
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
