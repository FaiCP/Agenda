import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/get-org";
import { Card, CardContent } from "@/components/ui/card";
import { EquipoView } from "./equipo-view";

export const metadata: Metadata = { title: "Equipo" };

export default async function EquipoPage() {
  const { organization, role, userId } = await getOrgContext();

  if (role !== "owner") {
    return (
      <div className="mx-auto max-w-lg pt-12">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <ShieldAlert className="size-8 text-muted-foreground" />
            <p className="font-heading text-lg font-semibold">
              Acceso restringido
            </p>
            <p className="text-sm text-muted-foreground">
              Solo el dueño de la organización puede gestionar el equipo.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const supabase = await createClient();

  const [membersRes, subRes] = await Promise.all([
    supabase
      .from("organization_members")
      .select(
        "id, role, display_name, accepts_appointments, created_at, profile_id, profiles(full_name, avatar_url)"
      )
      .eq("organization_id", organization.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("subscriptions")
      .select("status, plans(name, max_professionals)")
      .eq("organization_id", organization.id)
      .maybeSingle(),
  ]);

  const active = subRes.data?.status === "active";
  const limit = active ? subRes.data?.plans?.max_professionals ?? 1 : 1;
  const planName = active ? subRes.data?.plans?.name ?? "Gratis" : "Gratis";

  const members = (membersRes.data ?? []).map((m) => ({
    id: m.id,
    role: m.role,
    name: m.display_name || m.profiles?.full_name || "Sin nombre",
    fullName: m.profiles?.full_name || "",
    displayName: m.display_name || "",
    acceptsAppointments: m.accepts_appointments,
    isSelf: m.profile_id === userId,
  }));

  const used = members.filter((m) => m.acceptsAppointments).length;

  return (
    <EquipoView
      members={members}
      used={used}
      limit={limit}
      planName={planName}
    />
  );
}
