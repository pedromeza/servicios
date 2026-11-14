"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import path from "node:path";
import { z } from "zod";
import { createClient } from "./supabase/server";
import { requireUser } from "./auth";
import { decrypt, encrypt, keyHint } from "./crypto";
import { addMonthsISO, addYearsISO, todayISO } from "./format";
import { LOYALTY } from "./loyalty";
import { normalizeName } from "./names";
import { splitEmails } from "./emails";
import { parseMlWorkbook, type MlSale } from "./mercadolibre";
import { sendEmail } from "./email";
import { daysPhrase, DEFAULT_REMINDER, parseAutoDays, reminderHtml, SAMPLE_VARS, type ReminderSettings, type ReminderVars } from "./reminders";
import { fmtDate, fmtMoney } from "./format";
import { getReminderSettings, renewalCandidates } from "./data";
import { MAX_LICENSE_SEATS } from "./types";

export type ActionState = { ok: boolean; error?: string; errors?: Record<string, string> } | null;

const str = (fd: FormData, key: string) => (fd.get(key)?.toString().trim() ?? "");
const orNull = (s: string) => (s === "" ? null : s);
const dateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida")
  .nullable();
const uuidOrNull = z.uuid("Selección inválida").nullable();

function zodErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = String(issue.path[0] ?? "_");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

function refresh() {
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------- Sesión
export async function login(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = str(formData, "email");
  const password = str(formData, "password");
  if (!email || !password) return { ok: false, error: "Escribe tu correo y tu contraseña." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: "Correo o contraseña incorrectos." };
  redirect("/");
}

export async function requestPasswordReset(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = str(formData, "email").toLowerCase();
  if (!email) return { ok: false, error: "Escribe tu correo." };
  const allowed = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  // Respuesta neutra: no revelar si el correo existe o está permitido.
  if (allowed.length && !allowed.includes(email)) return { ok: true };
  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? process.env.APP_URL ?? "";
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/restablecer` });
  return { ok: true };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function changePassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const password = str(formData, "password");
  const confirm = str(formData, "confirm");
  if (password.length < 10) return { ok: false, error: "Usa al menos 10 caracteres." };
  if (password !== confirm) return { ok: false, error: "Las contraseñas no coinciden." };
  const { supabase } = await requireUser();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ---------------------------------------------------------------- Clientes
const clientSchema = z.object({
  id: z.uuid().nullable(),
  name: z.string().min(1, "El nombre es obligatorio").max(120, "Máximo 120 caracteres"),
  contact: z.string().max(500, "Máximo 500 caracteres"),
  platform: z.string().max(60).nullable(),
  platform_ref: z.string().max(120).nullable(),
  notes: z.string().max(2000, "Máximo 2000 caracteres"),
});

export async function saveClient(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = clientSchema.safeParse({
    id: orNull(str(fd, "id")),
    name: str(fd, "name"),
    contact: str(fd, "contact"),
    platform: orNull(str(fd, "platform")),
    platform_ref: orNull(str(fd, "platform_ref")),
    notes: str(fd, "notes"),
  });
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error) };
  const d = parsed.data;
  const { supabase } = await requireUser();
  // No permitir dos clientes con el mismo nombre (ignorando mayúsculas, acentos y espacios).
  const existing = await supabase.from("clients").select("id,name");
  if (existing.error) return { ok: false, error: existing.error.message };
  const dup = (existing.data as { id: string; name: string }[]).find((c) => c.id !== d.id && normalizeName(c.name) === normalizeName(d.name));
  if (dup) return { ok: false, errors: { name: `Ya existe un cliente registrado como “${dup.name}”.` } };
  const payload = { name: d.name, contact_enc: encrypt(d.contact), platform: d.platform, platform_ref: d.platform_ref, notes_enc: encrypt(d.notes) };
  const { error } = d.id
    ? await supabase.from("clients").update(payload).eq("id", d.id)
    : await supabase.from("clients").insert(payload);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

export async function deleteClient(id: string): Promise<ActionState> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------- Cuentas
const accountSchema = z.object({
  id: z.uuid().nullable(),
  provider: z.string().min(1, "Elige el proveedor").max(60),
  label: z.string().min(1, "Ponle un nombre a la cuenta").max(120),
  username: z.string().min(1, "El usuario o correo es obligatorio").max(200),
  password: z.string().max(500),
  role: z.enum(["admin", "user"]),
  parent_account_id: uuidOrNull,
  client_id: uuidOrNull,
  contracted_at: dateField,
  term_years: z.enum(["1", "2", "3"], "Elige 1, 2 o 3 años").nullable(),
  notes: z.string().max(2000),
});

export async function saveAccount(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = accountSchema.safeParse({
    id: orNull(str(fd, "id")),
    provider: str(fd, "provider"),
    label: str(fd, "label"),
    username: str(fd, "username"),
    password: fd.get("password")?.toString() ?? "",
    role: str(fd, "role") || "user",
    parent_account_id: orNull(str(fd, "parent_account_id")),
    client_id: orNull(str(fd, "client_id")),
    contracted_at: orNull(str(fd, "contracted_at")),
    term_years: orNull(str(fd, "term_years")),
    notes: str(fd, "notes"),
  });
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error) };
  const d = parsed.data;
  if (d.id && d.parent_account_id === d.id) {
    return { ok: false, errors: { parent_account_id: "Una cuenta no puede depender de sí misma" } };
  }
  const { supabase } = await requireUser();
  const payload: Record<string, unknown> = {
    provider: d.provider,
    label: d.label,
    username_enc: encrypt(d.username),
    role: d.role,
    parent_account_id: d.role === "admin" ? null : d.parent_account_id,
    client_id: d.client_id,
    // La vigencia solo aplica a cuentas propias (sin cliente asignado).
    contracted_at: d.client_id ? null : d.contracted_at,
    term_years: d.client_id ? null : d.term_years ? Number(d.term_years) : null,
    notes_enc: encrypt(d.notes),
  };
  // Al editar, dejar la contraseña vacía conserva la actual.
  if (d.password !== "" || !d.id) payload.password_enc = encrypt(d.password);

  const { error } = d.id
    ? await supabase.from("accounts").update(payload).eq("id", d.id)
    : await supabase.from("accounts").insert(payload);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

export async function deleteAccount(id: string): Promise<ActionState> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("accounts").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------- Suscripciones
const subscriptionSchema = z.object({
  id: z.uuid().nullable(),
  account_id: z.uuid("Elige la cuenta"),
  client_id: uuidOrNull,
  emails: z.array(z.email("Hay un correo inválido").max(200)).max(50, "Máximo 50 correos"),
  plan: z.enum(["individual", "suite"]),
  products: z.array(z.string().min(1).max(80)).min(1, "Marca al menos un programa"),
  seats: z.coerce.number().int("Debe ser entero").min(1, "Mínimo 1"),
  purchased_at: dateField,
  cost: z.coerce.number().min(0, "No puede ser negativo"),
  price: z.coerce.number().min(0, "No puede ser negativo"),
  currency: z.enum(["MXN", "USD"]),
  renews_at: dateField,
  promo_months: z.coerce.number().int("Debe ser entero").min(0, "No puede ser negativo").max(24, "Máximo 24 meses"),
  status: z.enum(["active", "expired", "cancelled"]),
  notes: z.string().max(2000),
});

export async function saveSubscription(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const extra = str(fd, "products_extra")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const products = Array.from(
    new Set([...fd.getAll("products").map((p) => p.toString().trim()).filter(Boolean), ...extra]),
  );
  const parsed = subscriptionSchema.safeParse({
    id: orNull(str(fd, "id")),
    account_id: str(fd, "account_id"),
    client_id: orNull(str(fd, "client_id")),
    emails: splitEmails(str(fd, "email")),
    plan: str(fd, "plan") || "individual",
    products,
    seats: str(fd, "seats") || "1",
    purchased_at: orNull(str(fd, "purchased_at")),
    cost: str(fd, "cost") || "0",
    price: str(fd, "price") || "0",
    currency: str(fd, "currency") || "MXN",
    renews_at: orNull(str(fd, "renews_at")),
    promo_months: str(fd, "promo_months") || "0",
    status: str(fd, "status") || "active",
    notes: str(fd, "notes"),
  });
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error) };
  const d = parsed.data;
  const { supabase } = await requireUser();
  const payload = {
    account_id: d.account_id,
    client_id: d.client_id,
    email_enc: encrypt(d.emails.join(", ")),
    plan: d.plan,
    products: d.products,
    // Si hay más correos que puestos, los puestos crecen para cubrirlos.
    seats: Math.max(d.seats, d.emails.length),
    purchased_at: d.purchased_at,
    cost: d.cost,
    price: d.price,
    currency: d.currency,
    renews_at: d.renews_at,
    promo_months: d.promo_months,
    status: d.status,
    notes_enc: encrypt(d.notes),
  };
  const { error } = d.id
    ? await supabase.from("subscriptions").update(payload).eq("id", d.id)
    : await supabase.from("subscriptions").insert(payload);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

/**
 * Renueva una suscripción: corre la fecha de renovación un periodo más (la vigencia detectada entre
 * compra y renovación, o 1 año) y suma una renovación, que cuenta como sello en la tarjeta del cliente.
 */
const renewSchema = z.object({
  id: z.uuid("Identificador inválido"),
  amount: z.coerce.number().min(0, "No puede ser negativo"),
  cost: z.coerce.number().min(0, "No puede ser negativo"),
  renewed_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  years: z.coerce.number().int().min(1).max(3),
  only_payment: z.boolean(), // solo anotar el cobro de una renovación ya hecha, sin mover fechas
});

export async function renewSubscription(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = renewSchema.safeParse({
    id: str(fd, "id"),
    amount: str(fd, "amount") || "0",
    cost: str(fd, "cost") || "0",
    renewed_at: str(fd, "renewed_at") || todayISO(),
    years: str(fd, "years") || "1",
    only_payment: fd.get("only_payment") === "on",
  });
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error) };
  const d = parsed.data;
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("subscriptions").select("renews_at,renewals,currency").eq("id", d.id).maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "La suscripción no existe." };
  // El nuevo periodo empieza donde terminaba el anterior; si ya venció hace tiempo, desde el día del cobro.
  const previous: string | null = data.renews_at ?? null;
  let from_date = previous;
  let to_date = previous;
  if (!d.only_payment) {
    const base = previous && previous >= d.renewed_at ? previous : d.renewed_at;
    to_date = addYearsISO(base, d.years);
    const upd = await supabase
      .from("subscriptions")
      .update({ renews_at: to_date, renewals: Number(data.renewals ?? 0) + 1, status: "active" })
      .eq("id", d.id);
    if (upd.error) return { ok: false, error: upd.error.message };
  } else {
    // La fecha ya está corrida: el cobro cubre hasta la renovación vigente.
    from_date = previous ? addYearsISO(previous, -d.years) : null;
  }
  const ev = await supabase.from("renewal_events").insert({
    subscription_id: d.id,
    renewed_at: d.renewed_at,
    amount: d.amount,
    cost: d.cost,
    currency: data.currency ?? "MXN",
    from_date,
    to_date,
  });
  if (ev.error) {
    if (/renewal_events|schema cache/i.test(ev.error.message)) {
      return { ok: false, error: "Falta aplicar la migración 0009 (tabla renewal_events): el cobro no se pudo guardar. Revisa el aviso amarillo del panel." };
    }
    return { ok: false, error: ev.error.message };
  }
  refresh();
  return { ok: true };
}

/** Manda la suscripción a la papelera (se oculta; se puede restaurar desde el filtro "Eliminadas"). */
export async function deleteSubscription(id: string): Promise<ActionState> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("subscriptions").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) {
    // Migración 0008 pendiente (no existe deleted_at): se borra como antes.
    if (/deleted_at|schema cache/i.test(error.message)) {
      const hard = await supabase.from("subscriptions").delete().eq("id", id);
      if (hard.error) return { ok: false, error: hard.error.message };
    } else {
      return { ok: false, error: error.message };
    }
  }
  refresh();
  return { ok: true };
}

export async function restoreSubscription(id: string): Promise<ActionState> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("subscriptions").update({ deleted_at: null }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

/** Borrado definitivo, solo desde la papelera. */
export async function purgeSubscription(id: string): Promise<ActionState> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("subscriptions").delete().eq("id", id).not("deleted_at", "is", null);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

export async function setSubscriptionStatus(id: string, status: "active" | "expired" | "cancelled"): Promise<ActionState> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("subscriptions").update({ status }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------- Licencias
const seatSchema = z.object({
  email: z.email("Correo inválido").max(200).or(z.literal("")),
  client_id: uuidOrNull,
});

const licenseSchema = z.object({
  id: z.uuid().nullable(),
  product: z.string().min(1, "Indica el producto").max(120),
  kind: z.enum(["key", "account"]),
  key: z.string().max(500),
  account_email: z.email("Correo inválido").max(200).or(z.literal("")),
  account_password: z.string().max(500),
  seats: z.coerce.number().int("Debe ser entero").min(1, "Mínimo 1").max(MAX_LICENSE_SEATS, `Máximo ${MAX_LICENSE_SEATS}`),
  seat_assignments: z.array(seatSchema).max(MAX_LICENSE_SEATS),
  term: z.enum(["perpetual", "annual"]),
  purchased_at: dateField,
  expires_at: dateField,
  status: z.enum(["available", "used"]),
  client_id: uuidOrNull,
  used_at: dateField,
  notes: z.string().max(2000),
});

export async function saveLicense(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const seatEmails = fd.getAll("seat_email").map((v) => v.toString().trim().toLowerCase());
  const seatClients = fd.getAll("seat_client").map((v) => v.toString().trim());
  const seat_assignments = seatEmails
    .map((email, i) => ({ email, client_id: orNull(seatClients[i] ?? "") }))
    .filter((s) => s.email !== "" || s.client_id !== null);

  const parsed = licenseSchema.safeParse({
    id: orNull(str(fd, "id")),
    product: str(fd, "product"),
    kind: str(fd, "kind") || "key",
    key: str(fd, "key"),
    account_email: str(fd, "account_email").toLowerCase(),
    account_password: fd.get("account_password")?.toString() ?? "",
    seats: str(fd, "seats") || "1",
    seat_assignments,
    term: str(fd, "term") || "perpetual",
    purchased_at: orNull(str(fd, "purchased_at")),
    expires_at: orNull(str(fd, "expires_at")),
    status: str(fd, "status") || "available",
    client_id: orNull(str(fd, "client_id")),
    used_at: orNull(str(fd, "used_at")),
    notes: str(fd, "notes"),
  });
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error) };
  const d = parsed.data;
  if (d.kind === "key" && !d.id && !d.key) return { ok: false, errors: { key: "La clave es obligatoria" } };
  if (d.kind === "account" && !d.id && !d.account_email) {
    return { ok: false, errors: { account_email: "El correo de la cuenta principal es obligatorio" } };
  }
  if (d.kind === "account" && d.seat_assignments.length > d.seats) {
    return { ok: false, errors: { seats: `Hay ${d.seat_assignments.length} puestos asignados; sube el número de puestos o quita alguno` } };
  }

  const { supabase } = await requireUser();
  const isAnnual = d.term === "annual";
  const payload: Record<string, unknown> = {
    product: d.product,
    kind: d.kind,
    seats: d.kind === "account" ? d.seats : 1,
    term: d.term,
    purchased_at: d.purchased_at,
    expires_at: isAnnual ? (d.expires_at ?? (d.purchased_at ? addYearsISO(d.purchased_at, 1) : null)) : null,
    status: d.status,
    client_id: d.client_id,
    used_at: d.status === "used" ? (d.used_at ?? todayISO()) : null,
    notes_enc: encrypt(d.notes),
  };
  if (d.kind === "key") {
    if (d.key) {
      payload.key_enc = encrypt(d.key);
      payload.key_hint = keyHint(d.key);
    }
    payload.account_email_enc = null;
    payload.account_password_enc = null;
  } else {
    if (d.account_email) payload.account_email_enc = encrypt(d.account_email);
    // Al editar, dejar la contraseña vacía conserva la actual.
    if (d.account_password !== "" || !d.id) payload.account_password_enc = encrypt(d.account_password);
    payload.key_enc = null;
    payload.key_hint = "";
  }

  let licenseId = d.id;
  if (licenseId) {
    const { error } = await supabase.from("licenses").update(payload).eq("id", licenseId);
    if (error) return { ok: false, error: error.message };
  } else {
    const { data, error } = await supabase.from("licenses").insert(payload).select("id").single();
    if (error) return { ok: false, error: error.message };
    licenseId = (data as { id: string }).id;
  }

  // Los puestos se reemplazan completos: es la forma más simple de reflejar lo que quedó en el formulario.
  const del = await supabase.from("license_seats").delete().eq("license_id", licenseId);
  if (del.error) return { ok: false, error: del.error.message };
  if (d.kind === "account" && d.seat_assignments.length > 0) {
    const rows = d.seat_assignments.map((s, i) => ({
      license_id: licenseId,
      email_enc: encrypt(s.email),
      client_id: s.client_id,
      position: i + 1,
    }));
    const ins = await supabase.from("license_seats").insert(rows);
    if (ins.error) return { ok: false, error: ins.error.message };
  }
  refresh();
  return { ok: true };
}

export async function toggleLicenseUsed(id: string, used: boolean): Promise<ActionState> {
  const { supabase } = await requireUser();
  const payload = used ? { status: "used", used_at: todayISO() } : { status: "available", used_at: null, client_id: null };
  const { error } = await supabase.from("licenses").update(payload).eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

export async function deleteLicense(id: string): Promise<ActionState> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("licenses").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------- Secretos (solo bajo demanda, con bitácora)
// ---------------------------------------------------------------- Lealtad
const rewardSchema = z.object({
  client_id: z.uuid("Cliente inválido"),
  description: z.string().min(1, "Describe el premio").max(200),
  granted_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  months: z.coerce.number().int("Debe ser entero").min(0, "No puede ser negativo").max(36, "Máximo 36 meses"),
  stamps_used: z.coerce.number().int().min(1).max(100),
  notes: z.string().max(2000),
});

export async function grantReward(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = rewardSchema.safeParse({
    client_id: str(fd, "client_id"),
    description: str(fd, "description"),
    granted_at: str(fd, "granted_at") || todayISO(),
    months: str(fd, "months") || "0",
    stamps_used: str(fd, "stamps_used") || String(LOYALTY.stampsPerReward),
    notes: str(fd, "notes"),
  });
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error) };
  const d = parsed.data;
  const { supabase } = await requireUser();
  const { error } = await supabase.from("rewards").insert({
    client_id: d.client_id,
    description: d.description,
    stamps_used: d.stamps_used,
    granted_at: d.granted_at,
    expires_at: d.months > 0 ? addMonthsISO(d.granted_at, d.months) : null,
    notes_enc: encrypt(d.notes),
  });
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

export async function deleteReward(id: string): Promise<ActionState> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("rewards").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------- Recordatorios de renovación
const settingsSchema = z.object({
  reminder_subject: z.string().min(1, "Escribe el asunto").max(200),
  reminder_body: z.string().min(1, "Escribe el mensaje").max(5000),
  reminder_button: z.string().min(1, "Escribe el texto del botón").max(80),
  payment_url: z.url("Debe ser un enlace completo, con https://").or(z.literal("")),
  whatsapp: z.string().max(40),
  logo_url: z.url("Debe ser un enlace completo, con https://").or(z.literal("")),
  reminder_days: z.coerce.number().int().min(1, "Mínimo 1 día").max(365, "Máximo 365 días"),
  auto_remind: z.boolean(),
  auto_days: z.string().max(60).refine((v) => parseAutoDays(v).length > 0, "Indica al menos un número de días, p. ej. 30,15,3"),
  whatsapp_body: z.string().min(1, "Escribe el mensaje de WhatsApp").max(2000),
});

function settingsFromForm(fd: FormData) {
  return settingsSchema.safeParse({
    reminder_subject: str(fd, "reminder_subject"),
    reminder_body: fd.get("reminder_body")?.toString().replace(/\r\n/g, "\n").trim() ?? "",
    reminder_button: str(fd, "reminder_button"),
    payment_url: str(fd, "payment_url"),
    whatsapp: str(fd, "whatsapp"),
    logo_url: str(fd, "logo_url"),
    reminder_days: str(fd, "reminder_days") || String(DEFAULT_REMINDER.reminder_days),
    auto_remind: fd.get("auto_remind") === "on",
    auto_days: str(fd, "auto_days") || DEFAULT_REMINDER.auto_days,
    whatsapp_body: fd.get("whatsapp_body")?.toString().replace(/\r\n/g, "\n").trim() || DEFAULT_REMINDER.whatsapp_body,
  });
}

/** URL pública de la app (para imágenes del correo): APP_URL, el dominio de producción de Vercel o el origen de la petición. */
async function appOrigin(): Promise<string> {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return (await headers()).get("origin") ?? "";
}

/** Logo por defecto del correo: el PNG de PGPM MEX que se publica con la app. */
async function defaultLogoUrl(): Promise<string> {
  const origin = await appOrigin();
  return origin ? `${origin}/logo-email.png` : "";
}

export async function saveReminderSettings(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = settingsFromForm(fd);
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error) };
  const { supabase, user } = await requireUser();
  const row = { ...parsed.data, auto_days: parseAutoDays(parsed.data.auto_days).join(",") };
  const { error } = await supabase.from("settings").upsert({ user_id: user.id, ...row, updated_at: new Date().toISOString() });
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

/** Envía la plantilla (tal como está en el formulario, sin guardar) a tu propio correo con datos de ejemplo. */
export async function sendReminderTest(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = settingsFromForm(fd);
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error) };
  const { user } = await requireUser();
  const to = process.env.NOTIFY_EMAIL || process.env.GMAIL_USER || user.email;
  if (!to) return { ok: false, error: "No sé a qué correo enviarte la prueba: define NOTIFY_EMAIL." };
  const vars: ReminderVars = { ...SAMPLE_VARS, whatsapp: parsed.data.whatsapp || SAMPLE_VARS.whatsapp };
  const mail = reminderHtml({ ...parsed.data, logo_url: parsed.data.logo_url || (await defaultLogoUrl()) }, vars);
  const res = await sendEmail(to, `[PRUEBA] ${mail.subject}`, mail.html, mail.text);
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, error: undefined, errors: { _sent_to: to } };
}

export type SendResult = { subscription_id: string; client: string; email: string | null; ok: boolean; error?: string };

/** Envía el recordatorio guardado a los clientes de las suscripciones indicadas y lo registra. */
export async function sendReminders(subscriptionIds: string[]): Promise<{ results: SendResult[] }> {
  const ids = subscriptionIds.filter((id) => z.uuid().safeParse(id).success);
  const { supabase } = await requireUser();
  const saved = await getReminderSettings();
  const settings: ReminderSettings = { ...saved, logo_url: saved.logo_url || (await defaultLogoUrl()) };
  const candidates = await renewalCandidates(3650);
  const results: SendResult[] = [];
  for (const id of ids) {
    const c = candidates.find((x) => x.subscription_id === id);
    if (!c) {
      results.push({ subscription_id: id, client: "?", email: null, ok: false, error: "No es una suscripción activa con fecha de renovación." });
      continue;
    }
    if (c.emails.length === 0) {
      results.push({ subscription_id: id, client: c.client_name, email: null, ok: false, error: "Sin correo: agrégalo en la suscripción o en el contacto del cliente." });
      continue;
    }
    const vars: ReminderVars = {
      cliente: c.client_name,
      programas: c.products.join(", ") || "tu programa",
      fecha_compra: fmtDate(c.purchased_at),
      fecha_renovacion: fmtDate(c.renews_at),
      dias: daysPhrase(c.days),
      precio: fmtMoney(c.price, c.currency),
      plataforma: c.platform ?? "nuestra tienda",
      whatsapp: settings.whatsapp || "nuestro WhatsApp",
    };
    const mail = reminderHtml(settings, vars);
    const res = await sendEmail(c.emails, mail.subject, mail.html, mail.text);
    if (res.ok) {
      await supabase.from("reminders").insert({ subscription_id: id, to_email_enc: encrypt(c.emails.join(", ")), kind: "client" });
    }
    results.push({ subscription_id: id, client: c.client_name, email: c.emails.join(", "), ok: res.ok, error: res.ok ? undefined : res.error });
  }
  refresh();
  return { results };
}

// ---------------------------------------------------------------- Importar Mercado Libre
export type MlPreviewRow = MlSale & { imported: boolean; client_exists: boolean };
export type MlPreviewState =
  | { ok: true; rows: MlPreviewRow[]; sheet: string; accounts: { value: string; label: string }[]; migrationPending: boolean }
  | { ok: false; error: string }
  | null;

async function readUpload(fd: FormData): Promise<ArrayBuffer> {
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("Selecciona el archivo .xlsx del reporte de ventas.");
  if (file.size > 8 * 1024 * 1024) throw new Error("El archivo es demasiado grande (máximo 8 MB).");
  return file.arrayBuffer();
}

export async function previewMlImport(_prev: MlPreviewState, fd: FormData): Promise<MlPreviewState> {
  try {
    const { supabase } = await requireUser();
    const buf = await readUpload(fd);
    const { sales, sheet } = await parseMlWorkbook(buf);
    const [existing, clients, accounts] = await Promise.all([
      supabase.from("subscriptions").select("ml_sale_id").not("ml_sale_id", "is", null),
      supabase.from("clients").select("name"),
      supabase.from("accounts").select("id,label,provider,username_enc").order("provider").order("label"),
    ]);
    const migrationPending = Boolean(existing.error && /ml_sale_id|schema cache/i.test(existing.error.message));
    const imported = new Set(((existing.data ?? []) as { ml_sale_id: string }[]).map((r) => r.ml_sale_id));
    const names = new Set(((clients.data ?? []) as { name: string }[]).map((c) => normalizeName(c.name)));
    const rows: MlPreviewRow[] = sales.map((s) => ({ ...s, imported: imported.has(s.sale_id), client_exists: names.has(normalizeName(s.buyer)) }));
    return {
      ok: true,
      rows,
      sheet,
      migrationPending,
      accounts: ((accounts.data ?? []) as { id: string; provider: string; label: string; username_enc: string | null }[]).map((a) => ({
        value: a.id,
        label: `[${a.provider}] ${a.label} · ${decrypt(a.username_enc) ?? ""}`,
      })),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export type MlImportResult = { ok: boolean; error?: string; created: number; clients_created: number; skipped_imported: number; skipped_invalid: number; account_label?: string };

const mlRowSchema = z.object({
  sale_id: z.string().regex(/^\d{6,}$/),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  ok: z.boolean(),
  buyer: z.string().min(1).max(200),
  title: z.string().max(300),
  products: z.array(z.string().min(1).max(80)).min(1),
  years: z.number().int().min(1).max(3).nullable(),
  units: z.number().int().min(1).max(100),
  unit_price: z.number().min(0),
  gross: z.number(),
  fee: z.number(),
  net: z.number(),
  city: z.string().max(200),
});

export async function commitMlImport(_prev: MlImportResult | null, fd: FormData): Promise<MlImportResult> {
  const base: MlImportResult = { ok: false, created: 0, clients_created: 0, skipped_imported: 0, skipped_invalid: 0 };
  let rows: z.infer<typeof mlRowSchema>[];
  try {
    rows = z.array(mlRowSchema).max(5000).parse(JSON.parse(str(fd, "rows") || "[]"));
  } catch {
    return { ...base, error: "No pude leer las ventas de la vista previa. Vuelve a analizar el archivo." };
  }
  const accountChoice = str(fd, "account_id");
  const { supabase } = await requireUser();

  // Cuenta destino: una existente o la cuenta "Ventas Mercado Libre" (se crea si no existe).
  let accountId = accountChoice;
  let accountLabel = "";
  if (!accountChoice || accountChoice === "__new__") {
    const found = await supabase.from("accounts").select("id,label").eq("label", "Ventas Mercado Libre").maybeSingle();
    if (found.data) {
      accountId = found.data.id;
      accountLabel = found.data.label;
    } else {
      const ins = await supabase
        .from("accounts")
        .insert({ provider: "Autodesk", label: "Ventas Mercado Libre", username_enc: encrypt("mercadolibre"), role: "admin", notes_enc: encrypt("Cuenta genérica para ventas importadas de Mercado Libre. Reasigna cada suscripción a su cuenta real al editarla.") })
        .select("id,label")
        .single();
      if (ins.error) return { ...base, error: `No pude crear la cuenta destino: ${ins.error.message}` };
      accountId = ins.data.id;
      accountLabel = ins.data.label;
    }
  } else {
    const acc = await supabase.from("accounts").select("id,label").eq("id", accountChoice).maybeSingle();
    if (!acc.data) return { ...base, error: "La cuenta elegida no existe." };
    accountLabel = acc.data.label;
  }

  const [existing, clientsRes] = await Promise.all([
    supabase.from("subscriptions").select("ml_sale_id").not("ml_sale_id", "is", null),
    supabase.from("clients").select("id,name"),
  ]);
  if (existing.error) {
    if (/ml_sale_id|schema cache/i.test(existing.error.message)) return { ...base, error: "Falta aplicar la migración 0010 (columna ml_sale_id). Revisa el aviso amarillo del panel." };
    return { ...base, error: existing.error.message };
  }
  const imported = new Set(((existing.data ?? []) as { ml_sale_id: string }[]).map((r) => r.ml_sale_id));
  const clientByName = new Map(((clientsRes.data ?? []) as { id: string; name: string }[]).map((c) => [normalizeName(c.name), c.id]));

  const result = { ...base, ok: true, account_label: accountLabel };
  const today = todayISO();
  for (const r of rows) {
    if (!r.ok) {
      result.skipped_invalid += 1;
      continue;
    }
    if (imported.has(r.sale_id)) {
      result.skipped_imported += 1;
      continue;
    }
    // Cliente: existente por nombre, o nuevo con plataforma Mercado Libre.
    let clientId = clientByName.get(normalizeName(r.buyer));
    if (!clientId) {
      const ins = await supabase
        .from("clients")
        .insert({ name: r.buyer, platform: "Mercado Libre", contact_enc: encrypt(r.city), notes_enc: null })
        .select("id")
        .single();
      if (ins.error) return { ...result, ok: false, error: `Cliente “${r.buyer}”: ${ins.error.message}` };
      clientId = ins.data.id;
      clientByName.set(normalizeName(r.buyer), clientId!);
      result.clients_created += 1;
    }
    const years = r.years ?? 1;
    const purchased = r.date ?? today;
    const renews = addYearsISO(purchased, years);
    const notes = [
      `Mercado Libre #${r.sale_id}`,
      r.title,
      `Cobrado ${r.gross.toFixed(2)} · comisión ML ${r.fee.toFixed(2)} · neto ${r.net.toFixed(2)}`,
      r.years ? "" : "Vigencia no indicada en el título: se asumió 1 año.",
    ]
      .filter(Boolean)
      .join("\n");
    const ins = await supabase.from("subscriptions").insert({
      account_id: accountId,
      client_id: clientId,
      plan: "individual",
      products: r.products,
      seats: r.units,
      purchased_at: purchased,
      cost: 0,
      price: Math.round(r.unit_price * r.units * 100) / 100,
      currency: "MXN",
      renews_at: renews,
      status: renews >= today ? "active" : "expired",
      notes_enc: encrypt(notes),
      ml_sale_id: r.sale_id,
    });
    if (ins.error) return { ...result, ok: false, error: `Venta #${r.sale_id}: ${ins.error.message}` };
    imported.add(r.sale_id);
    result.created += 1;
  }
  refresh();
  return result;
}

// ---------------------------------------------------------------- Migraciones
export type MigrateState = { ok: boolean; lines: string[] } | null;

/** Aplica desde la app las migraciones pendientes usando DATABASE_URL (la misma lógica que el build). */
export async function runMigrationsNow(): Promise<MigrateState> {
  await requireUser();
  const { applyMigrations, candidateUrls } = await import("../../scripts/migrate-core.mjs");
  const urls = candidateUrls(process.env);
  if (urls.length === 0) {
    return {
      ok: false,
      lines: [
        "No hay conexión a la base de datos configurada en Vercel (Settings → Environment Variables, entorno Production).",
        "Lo más sencillo: agrega SUPABASE_DB_PASSWORD con la contraseña de la base de datos de Supabase y vuelve a desplegar.",
        "Alternativa: DATABASE_URL con la URI del Session pooler de Supabase.",
      ],
    };
  }
  const result = await applyMigrations({ urls, dir: path.join(process.cwd(), "supabase", "migrations") });
  refresh();
  return { ok: result.ok, lines: result.lines };
}

export type SecretEntity = "account_password" | "license_key" | "license_password";

export async function revealSecret(
  entity: SecretEntity,
  id: string,
): Promise<{ ok: true; value: string } | { ok: false; error: string }> {
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Identificador inválido." };
  const { supabase } = await requireUser();

  const table = entity === "account_password" ? "accounts" : "licenses";
  const column = entity === "account_password" ? "password_enc" : entity === "license_password" ? "account_password_enc" : "key_enc";
  const { data, error } = await supabase.from(table).select(column).eq("id", id).maybeSingle();
  if (error) return { ok: false, error: error.message };
  const enc = (data as Record<string, string | null> | null)?.[column];
  if (!enc) return { ok: false, error: "No hay dato guardado." };

  await supabase.from("audit_log").insert({ action: "reveal", entity, entity_id: id });
  return { ok: true, value: decrypt(enc) ?? "" };
}
