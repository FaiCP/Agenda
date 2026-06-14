import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/get-org";
import { todayInEcuador, ecuadorDayRange } from "@/lib/dates";
import { AgendaView } from "./agenda-view";

export const metadata: Metadata = { title: "Agenda" };

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string }>;
}) {
  const { organization } = await getOrgContext();
  const supabase = await createClient();

  const { fecha } = await searchParams;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(fecha ?? "")
    ? fecha!
    : todayInEcuador();
  const { start, end } = ecuadorDayRange(date);

  const [appointments, clients, services, members] = await Promise.all([
    supabase
      .from("appointments")
      .select(
        "*, clients(id, full_name, phone), services(id, name), profiles:professional_id(id, full_name)"
      )
      .eq("organization_id", organization.id)
      .gte("starts_at", start)
      .lt("starts_at", end)
      .order("starts_at"),
    supabase
      .from("clients")
      .select("id, full_name")
      .eq("organization_id", organization.id)
      .order("full_name"),
    supabase
      .from("services")
      .select("id, name, duration_minutes")
      .eq("organization_id", organization.id)
      .eq("active", true)
      .order("name"),
    supabase
      .from("organization_members")
      .select("profile_id, display_name, profiles(full_name)")
      .eq("organization_id", organization.id)
      .eq("accepts_appointments", true),
  ]);

  return (
    <AgendaView
      date={date}
      clientLabel={organization.client_label}
      appointments={appointments.data ?? []}
      clients={clients.data ?? []}
      services={services.data ?? []}
      professionals={(members.data ?? []).map((m) => ({
        id: m.profile_id,
        name: m.display_name || m.profiles?.full_name || "Profesional",
      }))}
    />
  );
}
