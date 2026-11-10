"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import path from "node:path";
import { z } from "zod";
import { createClient } from "./supabase/server";
import { requireUser } from "./auth";
import { decrypt, encrypt, keyHint } from "./crypto";
import { addYearsISO, todayISO } from "./format";
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
  notes: z.string().max(2000, "Máximo 2000 caracteres"),
});

export async function saveClient(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = clientSchema.safeParse({
    id: orNull(str(fd, "id")),
    name: str(fd, "name"),
    contact: str(fd, "contact"),
    notes: str(fd, "notes"),
  });
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error) };
  const d = parsed.data;
  const { supabase } = await requireUser();
  const payload = { name: d.name, contact_enc: encrypt(d.contact), notes_enc: encrypt(d.notes) };
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
  email: z.email("Correo inválido").max(200).or(z.literal("")),
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
    email: str(fd, "email").toLowerCase(),
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
    email_enc: encrypt(d.email),
    plan: d.plan,
    products: d.products,
    seats: d.seats,
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

export async function deleteSubscription(id: string): Promise<ActionState> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("subscriptions").delete().eq("id", id);
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
// ---------------------------------------------------------------- Migraciones
export type MigrateState = { ok: boolean; lines: string[] } | null;

/** Aplica desde la app las migraciones pendientes usando DATABASE_URL (la misma lógica que el build). */
export async function runMigrationsNow(): Promise<MigrateState> {
  await requireUser();
  const url = process.env.DATABASE_URL;
  if (!url) {
    return {
      ok: false,
      lines: [
        "DATABASE_URL no está configurada en Vercel (Settings → Environment Variables, entorno Production).",
        "Cópiala de Supabase → Connect → Session pooler, con tu contraseña, y vuelve a desplegar.",
      ],
    };
  }
  const { applyMigrations } = await import("../../scripts/migrate-core.mjs");
  const result = await applyMigrations({ url, dir: path.join(process.cwd(), "supabase", "migrations") });
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
