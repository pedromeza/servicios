import "server-only";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { decrypt } from "./crypto";
import { requireUser } from "./auth";
import { addYearsISO, daysUntil } from "./format";
import type {
  Account,
  AuditEntry,
  Client,
  DashboardData,
  License,
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

// ---------------------------------------------------------------- Clientes
export async function listClients(q = ""): Promise<Client[]> {
  const { supabase } = await requireUser();
  const [clients, accounts, subs, lics] = await Promise.all([
    supabase.from("clients").select("*").order("name"),
    supabase.from("accounts").select("client_id"),
    supabase.from("subscriptions").select("client_id"),
    supabase.from("licenses").select("client_id"),
  ]);
  fail(clients.error);
  const count = (rows: any[] | null, id: string) => (rows ?? []).filter((r) => r.client_id === id).length;

  return (clients.data as any[])
    .map<Client>((r) => ({
      id: r.id,
      name: r.name,
      contact: decrypt(r.contact_enc),
      notes: decrypt(r.notes_enc),
      created_at: r.created_at,
      accounts_count: count(accounts.data, r.id),
      subscriptions_count: count(subs.data, r.id),
      licenses_count: count(lics.data, r.id),
    }))
    .filter((c) => matches(q, [c.name, c.contact, c.notes]));
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
    supabase.from("subscriptions").select("account_id"),
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
    subscriptions_count: (subs.data ?? []).filter((s: any) => s.account_id === r.id).length,
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
      plan: r.plan,
      products: r.products ?? [],
      seats: r.seats,
      purchased_at: r.purchased_at,
      cost: Number(r.cost),
      price: Number(r.price),
      currency: r.currency,
      renews_at: r.renews_at,
      status: r.status,
      notes: decrypt(r.notes_enc),
      created_at: r.created_at,
    }))
    .filter(
      (s) =>
        (!filters.status || s.status === filters.status) &&
        matches(filters.q ?? "", [s.account_label, s.client_name, s.email, s.products.join(" "), s.notes, s.account_provider]),
    );
}

// ---------------------------------------------------------------- Licencias
export async function listLicenses(filters: { q?: string; status?: string } = {}): Promise<License[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("licenses")
    .select("*, client:clients(id,name)")
    .order("status")
    .order("product")
    .order("created_at", { ascending: false });
  fail(error);
  return (data as any[])
    .map<License>((r) => ({
      id: r.id,
      product: r.product,
      key_hint: r.key_hint,
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
        matches(filters.q ?? "", [l.product, l.client_name, l.key_hint, l.notes]),
    );
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
