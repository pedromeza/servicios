import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "./supabase/server";

export type Role = "owner" | "helper";

/**
 * Capa de acceso: exige sesión válida y determina el rol.
 * - owner: el usuario es dueño de sus datos.
 * - helper: ayudante dado de alta por un dueño (tabla members); trabaja sobre los datos del dueño,
 *   no puede ver contraseñas ni borrar. Entra aunque no esté en ALLOWED_EMAILS.
 * Se cachea por petición para no repetir la consulta en cada acción.
 */
export const requireUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let role: Role = "owner";
  let ownerId = user.id;
  let ownerEmail: string | null = null;
  const membership = await supabase.from("members").select("owner_id").eq("member_id", user.id).maybeSingle();
  if (!membership.error && membership.data) {
    role = "helper";
    ownerId = membership.data.owner_id as string;
    ownerEmail = process.env.NOTIFY_EMAIL ?? null;
  }

  const allowed = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (role === "owner" && allowed.length && !allowed.includes((user.email ?? "").toLowerCase())) {
    await supabase.auth.signOut();
    redirect("/login?error=no-autorizado");
  }
  return { user, supabase, role, ownerId, ownerEmail, isOwner: role === "owner" };
});
