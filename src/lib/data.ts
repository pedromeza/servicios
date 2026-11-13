import "server-only";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { decrypt } from "./crypto";
import { requireUser } from "./auth";
import { addYearsISO, daysUntil } from "./format";
import { buildCard, type LoyaltyCard, type Reward, type Stamp } from "./loyalty";
import { DEFAULT_REMINDER, type ReminderSettings } from "./reminders";
import { splitEmails } from "./emails";
import type {
  Account,
  AuditEntry,
  Client,
  DashboardData,
  ReminderCandidate,
  License,
  LicenseSeat,
  Option,
  Subscription,
} from "./types";

function matches(q: string, fields: Array<string | null | undefined>) {
  if (!q) return true;
  const needle = q.toLowerCase();
  return fields.some((f) => (f ?? "").toLowerCase().includes(needle));
}

function fail(error: { message: string } | null): asserts error is null {
  if (error) throw new Error(error.message);
}

/** Error de PostgREST/Postgres por tabla o columna inexistente: la base de datos va atrasada respecto al código. */
function isMissingSchema(error: { code?: string; message: string }): boolean {
  return (
    error.code === "42P01" || // undefined_table
    error.code === "42703" || // undefined_column
    error.code === "PGRST204" || // columna no está en el caché de esquema
    error.code === "PGRST205" || // tabla no está en el caché de esquema
    /schema cache|does not exist/i.test(error.message)
  );
}

/**
 * Comprueba qué migraciones de supabase/migrations/ faltan por aplicar, probando la tabla o columna que cada una crea.
 * Devuelve los nombres de archivo pendientes (vacío si la base de datos está al día).
 */
export async function pendingMigrations(): Promise<string[]> {
  const { supabase } = await requireUser();
  const probes: Array<[string, () => PromiseLike<{ error: { code?: string; message: string } | null }>]> = [
    ["0002_subscription_email.sql", () => supabase.from("subscriptions").select("email_enc").limit(1)],
    ["0003_account_term.sql", () => supabase.from("accounts").select("term_years").limit(1)],
    ["0004_subscription_promo.sql", () => supabase.from("subscriptions").select("promo_months").limit(1)],
    ["0005_license_kind_term_seats.sql", () => supabase.from("license_seats").select("id").limit(1)],
    ["0006_loyalty.sql", () => supabase.from("rewards").select("id").limit(1)],
    ["0007_reminders.sql", () => supabase.from("settings").select("user_id").limit(1)],
    ["0008_subscription_trash.sql", () => supabase.from("subscriptions").select("deleted_at").limit(1)],
  ];
  const results = await Promise.all(probes.map(async ([name, run]) => ({ name, res: await run() })));
  return results.filter(({ res }) => res.error && isMissingSchema(res.error)).map(({ name }) => name);
}

// ---------------------------------------------------------------- Clientes
export async function listClients(q = ""): Promise<Client[]> {
  const { supabase } = await requireUser();
  const [clients, accounts, subs, lics] = await Promise.all([
    supabase.from("clients").select("*").order("name"),
    supabase.from("accounts").select("client_id"),
    supabase.from("subscriptions").select("client_id,deleted_at"),
    supabase.from("licenses").select("client_id"),
  ]);
  fail(clients.error);
  const count = (rows: any[] | null, id: string) => (rows ?? []).filter((r) => r.client_id === id && !r.deleted_at).length;

  return (clients.data as any[])
    .map<Client>((r) => ({
      id: r.id,
      name: r.name,
      contact: decrypt(r.contact_enc),
      platform: r.platform ?? null,
      platform_ref: r.platform_ref ?? null,
      notes: decrypt(r.notes_enc),
      created_at: r.created_at,
      accounts_count: count(accounts.data, r.id),
      subscriptions_count: count(subs.data, r.id),
      licenses_count: count(lics.data, r.id),
    }))
    .filter((c) => matches(q, [c.name, c.contact, c.notes, c.platform, c.platform_ref]));
}

export async function clientOptions(): Promise<Option[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("clients").select("id,name").order("name");
  fail(error);
  return (data as any[]).map((c) => ({ value: c.id, label: c.name }));
}

// ---------------------------------------------------------------- Cuentas
async function loadAccounts(): Promise<Account[]> {
  const { supabase } = await requireUser();
  const [accounts, subs] = await Promise.all([
    supabase
      .from("accounts")
      .select("*, client:clients(id,name)")
      .order("provider")
      .order("role")
      .order("label"),
    supabase.from("subscriptions").select("account_id,deleted_at"),
  ]);
  fail(accounts.error);
  const rows = accounts.data as any[];
  const labelById = new Map(rows.map((r) => [r.id, r.label as string]));
  return rows.map<Account>((r) => ({
    id: r.id,
    provider: r.provider,
    label: r.label,
    username: decrypt(r.username_enc) ?? "",
    has_password: Boolean(r.password_enc),
    role: r.role,
    parent_account_id: r.parent_account_id,
    parent_label: r.parent_account_id ? (labelById.get(r.parent_account_id) ?? null) : null,
    client_id: r.client_id,
    client_name: r.client?.name ?? null,
    contracted_at: r.contracted_at ?? null,
    term_years: r.term_years ?? null,
    expires_at: r.contracted_at && r.term_years ? addYearsISO(r.contracted_at, r.term_years) : null,
    notes: decrypt(r.notes_enc),
    created_at: r.created_at,
    subscriptions_count: (subs.data ?? []).filter((s: any) => s.account_id === r.id && !s.deleted_at).length,
    children_count: rows.filter((c) => c.parent_account_id === r.id).length,
  }));
}

export async function listAccounts(filters: { q?: string; provider?: string; role?: string } = {}) {
  const all = await loadAccounts();
  return all.filter(
    (a) =>
      (!filters.provider || a.provider === filters.provider) &&
      (!filters.role || a.role === filters.role) &&
      matches(filters.q ?? "", [a.label, a.username, a.client_name, a.parent_label, a.notes]),
  );
}

export async function getAccount(id: string) {
  const all = await loadAccounts();
  const account = all.find((a) => a.id === id);
  if (!account) return null;
  const children = all.filter((a) => a.parent_account_id === id);
  const subscriptions = (await listSubscriptions()).filter((s) => s.account_id === id);
  return { account, children, subscriptions };
}

export async function accountOptions(): Promise<Option[]> {
  const all = await loadAccounts();
  return all.map((a) => ({
    value: a.id,
    label: `${a.label} · ${a.username}`,
    meta: a.provider,
  }));
}

// ---------------------------------------------------------------- Suscripciones
/** Lista suscripciones. Las eliminadas (papelera) solo aparecen con `status: "deleted"`. */
export async function listSubscriptions(filters: { q?: string; status?: string } = {}): Promise<Subscription[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*, account:accounts(id,label,provider), client:clients(id,name)")
    .order("renews_at", { ascending: true, nullsFirst: false });
  fail(error);
  return (data as any[])
    .map<Subscription>((r) => ({
      id: r.id,
      account_id: r.account_id,
      account_label: r.account?.label ?? "(cuenta eliminada)",
      account_provider: r.account?.provider ?? "",
      client_id: r.client_id,
      client_name: r.client?.name ?? null,
      email: decrypt(r.email_enc),
      emails: splitEmails(decrypt(r.email_enc)),
      plan: r.plan,
      products: r.products ?? [],
      seats: r.seats,
      purchased_at: r.purchased_at,
      cost: Number(r.cost),
      price: Number(r.price),
      currency: r.currency,
      renews_at: r.renews_at,
      promo_months: Number(r.promo_months ?? 0),
      renewals: Number(r.renewals ?? 0),
      status: r.status,
      deleted_at: r.deleted_at ?? null,
      notes: decrypt(r.notes_enc),
      created_at: r.created_at,
    }))
    .filter((s) => (filters.status === "deleted" ? s.deleted_at !== null : s.deleted_at === null))
    .filter(
      (s) =>
        (!filters.status || filters.status === "deleted" || s.status === filters.status) &&
        matches(filters.q ?? "", [s.account_label, s.client_name, s.email, s.products.join(" "), s.notes, s.account_provider]),
    );
}

// ---------------------------------------------------------------- Licencias
export async function listLicenses(filters: { q?: string; status?: string; kind?: string; term?: string } = {}): Promise<License[]> {
  const { supabase } = await requireUser();
  const [lics, seats] = await Promise.all([
    supabase
      .from("licenses")
      .select("*, client:clients(id,name)")
      .order("status")
      .order("product")
      .order("created_at", { ascending: false }),
    supabase.from("license_seats").select("*, client:clients(id,name)").order("position"),
  ]);
  fail(lics.error);
  // Si la tabla de puestos aún no existe (migración 0005 pendiente) la página sigue funcionando sin puestos.
  if (seats.error && !isMissingSchema(seats.error)) fail(seats.error);
  const seatsByLicense = new Map<string, LicenseSeat[]>();
  for (const s of (seats.error ? [] : (seats.data ?? [])) as any[]) {
    const list = seatsByLicense.get(s.license_id) ?? [];
    list.push({ id: s.id, email: decrypt(s.email_enc), client_id: s.client_id, client_name: s.client?.name ?? null });
    seatsByLicense.set(s.license_id, list);
  }
  return (lics.data as any[])
    .map<License>((r) => ({
      id: r.id,
      product: r.product,
      kind: r.kind ?? "key",
      key_hint: r.key_hint ?? "",
      account_email: decrypt(r.account_email_enc),
      has_account_password: Boolean(r.account_password_enc),
      seats: Number(r.seats ?? 1),
      seat_assignments: seatsByLicense.get(r.id) ?? [],
      term: r.term ?? "perpetual",
      purchased_at: r.purchased_at ?? null,
      expires_at: r.expires_at ?? null,
      status: r.status,
      client_id: r.client_id,
      client_name: r.client?.name ?? null,
      used_at: r.used_at,
      notes: decrypt(r.notes_enc),
      created_at: r.created_at,
    }))
    .filter(
      (l) =>
        (!filters.status || l.status === filters.status) &&
        (!filters.kind || l.kind === filters.kind) &&
        (!filters.term || l.term === filters.term) &&
        matches(filters.q ?? "", [
          l.product,
          l.client_name,
          l.key_hint,
          l.account_email,
          l.notes,
          ...l.seat_assignments.flatMap((s) => [s.email, s.client_name]),
        ]),
    );
}

// ---------------------------------------------------------------- Lealtad
export async function loyaltyCards(q = ""): Promise<LoyaltyCard[]> {
  const { supabase } = await requireUser();
  const [clients, subs, lics, seats, rewards] = await Promise.all([
    supabase.from("clients").select("id,name").order("name"),
    supabase.from("subscriptions").select("*"),
    supabase.from("licenses").select("*"),
    supabase.from("license_seats").select("id,client_id,created_at,license:licenses(product)"),
    supabase.from("rewards").select("*").order("granted_at", { ascending: false }),
  ]);
  fail(clients.error);
  fail(subs.error);
  fail(lics.error);
  // Tablas de migraciones aún no aplicadas (0005 puestos, 0006 premios): la página funciona sin ellas.
  if (seats.error && !isMissingSchema(seats.error)) fail(seats.error);
  if (rewards.error && !isMissingSchema(rewards.error)) fail(rewards.error);

  const stampsByClient = new Map<string, Stamp[]>();
  const push = (clientId: string | null, stamp: Stamp) => {
    if (!clientId) return;
    const list = stampsByClient.get(clientId) ?? [];
    list.push(stamp);
    stampsByClient.set(clientId, list);
  };
  for (const s of (subs.data ?? []) as any[]) {
    if (s.deleted_at) continue; // en la papelera
    const label = (s.products ?? []).join(", ") || "Suscripción";
    push(s.client_id, { date: s.purchased_at ?? s.created_at?.slice(0, 10) ?? null, label, kind: "subscription" });
    for (let i = 0; i < Number(s.renewals ?? 0); i++) {
      push(s.client_id, { date: s.renews_at ?? null, label: `Renovación de ${label}`, kind: "renewal" });
    }
  }
  for (const l of (lics.data ?? []) as any[]) {
    push(l.client_id, { date: l.used_at ?? l.purchased_at ?? l.created_at?.slice(0, 10) ?? null, label: l.product, kind: "license" });
  }
  for (const s of (seats.error ? [] : (seats.data ?? [])) as any[]) {
    push(s.client_id, { date: s.created_at?.slice(0, 10) ?? null, label: `Puesto de ${s.license?.product ?? "licencia"}`, kind: "seat" });
  }
  const rewardsByClient = new Map<string, Reward[]>();
  for (const r of (rewards.error ? [] : (rewards.data ?? [])) as any[]) {
    const list = rewardsByClient.get(r.client_id) ?? [];
    list.push({
      id: r.id,
      description: r.description,
      stamps_used: Number(r.stamps_used ?? 0),
      granted_at: r.granted_at,
      expires_at: r.expires_at,
      notes: decrypt(r.notes_enc),
    });
    rewardsByClient.set(r.client_id, list);
  }

  return ((clients.data ?? []) as any[])
    .map((c) => buildCard(c.id, c.name, stampsByClient.get(c.id) ?? [], rewardsByClient.get(c.id) ?? []))
    .filter((card) => matches(q, [card.client_name]))
    .sort((a, b) => b.rewards_available - a.rewards_available || b.total_stamps - a.total_stamps || a.client_name.localeCompare(b.client_name));
}

// ---------------------------------------------------------------- Recordatorios
export async function getReminderSettings(): Promise<ReminderSettings> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("settings").select("*").maybeSingle();
  if (error && !isMissingSchema(error)) fail(error);
  const r = (data ?? {}) as Record<string, unknown>;
  return {
    reminder_subject: (r.reminder_subject as string) || DEFAULT_REMINDER.reminder_subject,
    reminder_body: (r.reminder_body as string) || DEFAULT_REMINDER.reminder_body,
    reminder_button: (r.reminder_button as string) || DEFAULT_REMINDER.reminder_button,
    payment_url: (r.payment_url as string) || "",
    whatsapp: (r.whatsapp as string) || "",
    logo_url: (r.logo_url as string) || "",
    reminder_days: Number(r.reminder_days ?? DEFAULT_REMINDER.reminder_days),
  };
}

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

/** Suscripciones activas que vencen dentro de `days` días (o ya vencidas), con el correo al que avisar. */
export async function renewalCandidates(days: number): Promise<ReminderCandidate[]> {
  const { supabase } = await requireUser();
  const [subs, clients, sent] = await Promise.all([
    listSubscriptions({ status: "active" }),
    supabase.from("clients").select("id,contact_enc,platform"),
    supabase.from("reminders").select("subscription_id,sent_at").eq("kind", "client").order("sent_at", { ascending: false }),
  ]);
  fail(clients.error);
  if (sent.error && !isMissingSchema(sent.error)) fail(sent.error);
  const byClient = new Map((clients.data as any[]).map((c) => [c.id, c]));
  const sentBySub = new Map<string, { last: string; count: number }>();
  for (const r of (sent.error ? [] : (sent.data ?? [])) as any[]) {
    const cur = sentBySub.get(r.subscription_id);
    if (cur) cur.count += 1;
    else sentBySub.set(r.subscription_id, { last: r.sent_at, count: 1 });
  }
  return subs
    .filter((s) => s.renews_at !== null)
    .map<ReminderCandidate>((s) => {
      const c = s.client_id ? byClient.get(s.client_id) : null;
      const contact = c ? decrypt(c.contact_enc) : null;
      const fromContact = contact?.match(EMAIL_RE)?.[0] ?? null;
      const d = daysUntil(s.renews_at);
      const hist = sentBySub.get(s.id);
      return {
        subscription_id: s.id,
        client_id: s.client_id,
        client_name: s.client_name ?? "Sin cliente",
        platform: c?.platform ?? null,
        emails: s.emails.length > 0 ? s.emails : fromContact ? [fromContact] : [],
        products: s.products,
        purchased_at: s.purchased_at,
        renews_at: s.renews_at as string,
        days: d ?? 0,
        price: s.price,
        currency: s.currency,
        last_reminder_at: hist?.last ?? null,
        reminders_sent: hist?.count ?? 0,
      };
    })
    .filter((c) => c.days <= days)
    .sort((a, b) => a.days - b.days);
}

// ---------------------------------------------------------------- Bitácora
export async function listAudit(limit = 50): Promise<AuditEntry[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("audit_log")
    .select("id,action,entity,entity_id,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  fail(error);
  return data as AuditEntry[];
}

// ---------------------------------------------------------------- Panel
export async function dashboardData(): Promise<DashboardData> {
  const [subs, licenses, accounts] = await Promise.all([listSubscriptions(), listLicenses(), listAccounts()]);
  const active = subs.filter((s) => s.status === "active");
  const withDays = active.map((s) => ({ s, d: daysUntil(s.renews_at) }));
  const renewingSoon = withDays.filter((x) => x.d !== null && x.d >= 0 && x.d <= 30).length;
  const overdue = withDays.filter((x) => x.d !== null && x.d < 0).length;
  const upcoming = withDays
    .filter((x) => x.d !== null && x.d <= 60)
    .sort((a, b) => (a.d ?? 0) - (b.d ?? 0))
    .slice(0, 8)
    .map((x) => x.s);

  const revenue = subs.reduce((n, s) => n + s.price, 0);
  const cost = subs.reduce((n, s) => n + s.cost, 0);

  const byProduct = new Map<string, { available: number; used: number }>();
  for (const l of licenses) {
    const e = byProduct.get(l.product) ?? { available: 0, used: 0 };
    e[l.status] += 1;
    byProduct.set(l.product, e);
  }
  const byProvider = new Map<string, number>();
  for (const a of accounts) byProvider.set(a.provider, (byProvider.get(a.provider) ?? 0) + 1);

  return {
    activeSubs: active.length,
    renewingSoon,
    overdue,
    availableLicenses: licenses.filter((l) => l.status === "available").length,
    usedLicenses: licenses.filter((l) => l.status === "used").length,
    revenue,
    cost,
    profit: revenue - cost,
    upcoming,
    licensesByProduct: [...byProduct.entries()]
      .map(([product, v]) => ({ product, ...v }))
      .sort((a, b) => b.available - a.available),
    accountsByProvider: [...byProvider.entries()]
      .map(([provider, count]) => ({ provider, count }))
      .sort((a, b) => b.count - a.count),
  };
}
