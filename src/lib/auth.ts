import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";

/** Capa de acceso: exige sesión válida y, si está configurado, que el correo esté en la lista permitida. */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const allowed = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length && !allowed.includes((user.email ?? "").toLowerCase())) {
    await supabase.auth.signOut();
    redirect("/login?error=no-autorizado");
  }
  return { user, supabase };
}
