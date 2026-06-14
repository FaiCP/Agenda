"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "./appointments";

async function requireSuperadmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_superadmin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_superadmin) redirect("/app");

  return { supabase, userId: user.id };
}

export async function reviewPayment(
  paymentId: string,
  decision: "approved" | "rejected",
  notes?: string
): Promise<ActionState> {
  const { supabase, userId } = await requireSuperadmin();

  const { data: payment } = await supabase
    .from("payments")
    .select("id, organization_id, plan_id, status")
    .eq("id", paymentId)
    .single();
  if (!payment) return { error: "Pago no encontrado." };
  if (payment.status !== "pending_review")
    return { error: "Este pago ya fue revisado." };

  const { error } = await supabase
    .from("payments")
    .update({
      status: decision,
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      review_notes: notes ?? null,
    })
    .eq("id", paymentId);
  if (error) return { error: "No se pudo actualizar el pago." };

  if (decision === "approved" && payment.plan_id) {
    // Activar/renovar suscripción por 1 mes
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const { data: existing } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("organization_id", payment.organization_id)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("subscriptions")
        .update({
          plan_id: payment.plan_id,
          status: "active",
          current_period_start: new Date().toISOString(),
          current_period_end: periodEnd.toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("subscriptions").insert({
        organization_id: payment.organization_id,
        plan_id: payment.plan_id,
        status: "active",
        current_period_end: periodEnd.toISOString(),
      });
    }
  }

  revalidatePath("/admin");
  return { error: null, success: true };
}
