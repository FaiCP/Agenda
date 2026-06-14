import { createClient } from "@/lib/supabase/server";

export type PlanFeature = "ai_features" | "email_reminders" | "public_booking";

/**
 * Indica si la suscripción activa de la organización incluye una feature.
 */
export async function orgHasFeature(
  organizationId: string,
  feature: PlanFeature
): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("subscriptions")
    .select("status, plans(features)")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!data || data.status !== "active") return false;
  const features = (data.plans?.features ?? {}) as Record<string, boolean>;
  return features[feature] === true;
}

/**
 * Lee una feature numérica del plan (ej. cuotas mensuales). Devuelve `fallback`
 * si no hay suscripción activa o la clave no es numérica.
 */
export async function orgFeatureNumber(
  organizationId: string,
  key: string,
  fallback = 0
): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("subscriptions")
    .select("status, plans(features)")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!data || data.status !== "active") return 0;
  const features = (data.plans?.features ?? {}) as Record<string, unknown>;
  const value = features[key];
  return typeof value === "number" ? value : fallback;
}
