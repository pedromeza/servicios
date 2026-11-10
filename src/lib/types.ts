export const PROVIDERS = ["Autodesk", "Microsoft", "Adobe", "Google", "Otro"] as const;
export type Provider = (typeof PROVIDERS)[number];

export const PRODUCTS_BY_PROVIDER: Record<Provider, string[]> = {
  Autodesk: [
    "AutoCAD",
    "AutoCAD LT",
    "Revit",
    "Civil 3D",
    "Inventor",
    "3ds Max",
    "Maya",
    "Navisworks Manage",
    "Fusion",
    "Colección AEC",
    "Colección PD&M",
    "Colección M&E",
  ],
  Microsoft: [
    "Windows 11 Pro",
    "Windows 11 Home",
    "Windows 10 Pro",
    "Windows Server 2022",
    "Office 2021 Professional Plus",
    "Office 2024 Professional Plus",
    "Microsoft 365 Personal",
    "Microsoft 365 Familia",
    "Microsoft 365 Empresa",
  ],
  Adobe: ["Creative Cloud (todas las apps)", "Photoshop", "Illustrator", "Acrobat Pro", "Premiere Pro"],
  Google: ["Google Workspace", "Google One"],
  Otro: [],
};

export const LICENSE_PRODUCTS = [
  "Windows 11 Pro",
  "Windows 11 Home",
  "Windows 10 Pro",
  "Windows 10 Home",
  "Windows Server 2022",
  "Office 2021 Professional Plus",
  "Office 2024 Professional Plus",
  "Office 2019 Professional Plus",
  "Visio Professional",
  "Project Professional",
];

export const ACCOUNT_ROLES = { admin: "Administrador", user: "Usuario" } as const;
export type AccountRole = keyof typeof ACCOUNT_ROLES;

export const SUB_PLANS = { individual: "Producto individual", suite: "Suite / colección completa" } as const;
export type SubPlan = keyof typeof SUB_PLANS;

export const SUB_STATUS = { active: "Activa", expired: "Vencida", cancelled: "Cancelada" } as const;
export type SubStatus = keyof typeof SUB_STATUS;

export const LICENSE_STATUS = { available: "Disponible", used: "Utilizada" } as const;
export type LicenseStatus = keyof typeof LICENSE_STATUS;

export const LICENSE_KINDS = { key: "Clave de producto (serial)", account: "Cuenta (correo y contraseña)" } as const;
export type LicenseKind = keyof typeof LICENSE_KINDS;

export const LICENSE_TERMS = { perpetual: "Permanente", annual: "Anual" } as const;
export type LicenseTerm = keyof typeof LICENSE_TERMS;

export const MAX_LICENSE_SEATS = 50;

export const CURRENCIES = ["MXN", "USD"] as const;

export const ACCOUNT_TERMS = { 1: "1 año", 2: "2 años", 3: "3 años" } as const;
export type AccountTerm = keyof typeof ACCOUNT_TERMS;

export type Option = { value: string; label: string; meta?: string };

export type Client = {
  id: string;
  name: string;
  contact: string | null;
  notes: string | null;
  created_at: string;
  accounts_count: number;
  subscriptions_count: number;
  licenses_count: number;
};

export type Account = {
  id: string;
  provider: string;
  label: string;
  username: string;
  has_password: boolean;
  role: AccountRole;
  parent_account_id: string | null;
  parent_label: string | null;
  client_id: string | null;
  client_name: string | null;
  contracted_at: string | null;
  term_years: AccountTerm | null;
  expires_at: string | null;
  notes: string | null;
  created_at: string;
  subscriptions_count: number;
  children_count: number;
};

export type Subscription = {
  id: string;
  account_id: string;
  account_label: string;
  account_provider: string;
  client_id: string | null;
  client_name: string | null;
  email: string | null;
  plan: SubPlan;
  products: string[];
  seats: number;
  purchased_at: string | null;
  cost: number;
  price: number;
  currency: string;
  renews_at: string | null;
  promo_months: number;
  status: SubStatus;
  notes: string | null;
  created_at: string;
};

export type LicenseSeat = {
  id: string;
  email: string | null;
  client_id: string | null;
  client_name: string | null;
};

export type License = {
  id: string;
  product: string;
  kind: LicenseKind;
  key_hint: string;
  account_email: string | null;
  has_account_password: boolean;
  seats: number;
  seat_assignments: LicenseSeat[];
  term: LicenseTerm;
  purchased_at: string | null;
  expires_at: string | null;
  status: LicenseStatus;
  client_id: string | null;
  client_name: string | null;
  used_at: string | null;
  notes: string | null;
  created_at: string;
};

export type AuditEntry = {
  id: number;
  action: string;
  entity: string;
  entity_id: string | null;
  created_at: string;
};

export type DashboardData = {
  activeSubs: number;
  renewingSoon: number;
  overdue: number;
  availableLicenses: number;
  usedLicenses: number;
  revenue: number;
  cost: number;
  profit: number;
  upcoming: Subscription[];
  licensesByProduct: { product: string; available: number; used: number }[];
  accountsByProvider: { provider: string; count: number }[];
};
