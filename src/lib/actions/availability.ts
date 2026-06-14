"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/get-org";
import type { ActionState } from "./appointments";

export async function addAvailabilityRule(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { organization, userId } = await getOrgContext();
  const supabase = await createClient();

  const professionalId =
    String(formData.get("professional_id") ?? "") || userId;
  const weekday = parseInt(String(formData.get("weekday") ?? ""), 10);
  const startTime = String(formData.get("start_time") ?? "");
  const endTime = String(formData.get("end_time") ?? "");

  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6)
    return { error: "Día inválido." };
  if (!startTime || !endTime || startTime >= endTime)
    return { error: "La hora de inicio debe ser menor a la de fin." };

  const { error } = await supabase.from("availability_rules").insert({
    organization_id: organization.id,
    professional_id: professionalId,
    weekday,
    start_time: startTime,
    end_time: endTime,
  });

  if (error) return { error: "No se pudo guardar el horario." };

  revalidatePath("/app/disponibilidad");
  return { error: null, success: true };
}

export async function deleteAvailabilityRule(
  ruleId: string
): Promise<ActionState> {
  const { organization } = await getOrgContext();
  const supabase = await createClient();

  const { error } = await supabase
    .from("availability_rules")
    .delete()
    .eq("id", ruleId)
    .eq("organization_id", organization.id);

  if (error) return { error: "No se pudo eliminar el horario." };

  revalidatePath("/app/disponibilidad");
  return { error: null, success: true };
}
