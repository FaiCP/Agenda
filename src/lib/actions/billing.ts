"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/get-org";
import type { ActionState } from "./appointments";

const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;

export async function submitBankTransferPayment(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { organization, role } = await getOrgContext();
  if (role !== "owner")
    return { error: "Solo el propietario puede gestionar pagos." };

  const supabase = await createClient();
  const planId = String(formData.get("plan_id") ?? "");
  const receipt = formData.get("receipt");

  const { data: plan } = await supabase
    .from("plans")
    .select("id, price_monthly")
    .eq("id", planId)
    .eq("active", true)
    .single();
  if (!plan) return { error: "Plan no válido." };

  if (!(receipt instanceof File) || receipt.size === 0)
    return { error: "Adjunta el comprobante de la transferencia." };
  if (receipt.size > MAX_RECEIPT_BYTES)
    return { error: "El comprobante no debe superar 5 MB." };
  if (!/^(image\/(png|jpe?g|webp)|application\/pdf)$/.test(receipt.type))
    return { error: "Formato no válido. Usa imagen (JPG/PNG) o PDF." };

  const ext = receipt.name.split(".").pop() || "bin";
  const path = `${organization.id}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("receipts")
    .upload(path, receipt, { contentType: receipt.type });
  if (uploadError) return { error: "No se pudo subir el comprobante." };

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("organization_id", organization.id)
    .maybeSingle();

  const { error } = await supabase.from("payments").insert({
    organization_id: organization.id,
    subscription_id: subscription?.id ?? null,
    plan_id: plan.id,
    amount: plan.price_monthly,
    method: "bank_transfer",
    receipt_path: path,
    status: "pending_review",
  });

  if (error) return { error: "No se pudo registrar el pago." };

  revalidatePath("/app/facturacion");
  return { error: null, success: true };
}
