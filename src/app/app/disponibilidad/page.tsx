import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/get-org";
import { DisponibilidadView } from "./disponibilidad-view";

export const metadata: Metadata = { title: "Disponibilidad" };

export default async function DisponibilidadPage() {
  const { organization, userId } = await getOrgContext();
  const supabase = await createClient();

  const [rules, members] = await Promise.all([
    supabase
      .from("availability_rules")
      .select("*")
      .eq("organization_id", organization.id)
      .order("weekday")
      .order("start_time"),
    supabase
      .from("organization_members")
      .select("profile_id, display_name, profiles(full_name)")
      .eq("organization_id", organization.id)
      .eq("accepts_appointments", true),
  ]);

  return (
    <DisponibilidadView
      rules={rules.data ?? []}
      currentUserId={userId}
      professionals={(members.data ?? []).map((m) => ({
        id: m.profile_id,
        name: m.display_name || m.profiles?.full_name || "Profesional",
      }))}
    />
  );
}
