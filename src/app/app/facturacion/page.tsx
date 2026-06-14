import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/get-org";
import { FacturacionView } from "./facturacion-view";

export const metadata: Metadata = { title: "Plan y facturación" };

export default async function FacturacionPage() {
  const { organization, role } = await getOrgContext();
  const supabase = await createClient();

  const [subscription, plans, payments] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("*, plans(*)")
      .eq("organization_id", organization.id)
      .maybeSingle(),
    supabase.from("plans").select("*").eq("active", true).order("price_monthly"),
    supabase
      .from("payments")
      .select("*, plans(name)")
      .eq("organization_id", organization.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return (
    <FacturacionView
      subscription={subscription.data}
      plans={plans.data ?? []}
      payments={payments.data ?? []}
      isOwner={role === "owner"}
    />
  );
}
