import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/get-org";
import { ServiciosView } from "./servicios-view";

export const metadata: Metadata = { title: "Servicios" };

export default async function ServiciosPage() {
  const { organization } = await getOrgContext();
  const supabase = await createClient();

  const { data: services } = await supabase
    .from("services")
    .select("*")
    .eq("organization_id", organization.id)
    .order("name");

  return <ServiciosView services={services ?? []} />;
}
