"use client";

import { createBrowserClient } from "@supabase/ssr";

/** Cliente de Supabase para el navegador. Solo se usa en el flujo de recuperación de contraseña. */
export function createClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
