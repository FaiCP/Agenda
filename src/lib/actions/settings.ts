"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/get-org";
import type { ActionState } from "./appointments";

export async function updateOrganization(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { organization, role } = await getOrgContext();
  if (role !== "owner")
    return { error: "Solo el propietario puede editar la organización." };

  const supabase = await createClient();
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const address = String(formData.get("address") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim() || null;
  const bookingEnabled = formData.get("booking_enabled") === "on";

  if (name.length < 3) return { error: "Nombre demasiado corto." };

  const { error } = await supabase
    .from("organizations")
    .update({ name, phone, address, description, booking_enabled: bookingEnabled })
    .eq("id", organization.id);

  if (error) return { error: "No se pudo guardar." };

  revalidatePath("/app/configuracion");
  return { error: null, success: true };
}
