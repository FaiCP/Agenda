import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Tables, Enums } from "@/lib/supabase/database.types";

export interface OrgContext {
  userId: string;
  profile: Tables<"profiles">;
  organization: Tables<"organizations">;
  role: Enums<"member_role">;
}

/**
 * Contexto de la organización activa del usuario autenticado.
 * Redirige a /login sin sesión y a /onboarding sin organización.
 */
export async function getOrgContext(): Promise<OrgContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("organization_members")
      .select("role, organizations(*)")
      .eq("profile_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!profile) redirect("/login");
  if (!membership?.organizations) redirect("/onboarding");

  return {
    userId: user.id,
    profile,
    organization: membership.organizations,
    role: membership.role,
  };
}
