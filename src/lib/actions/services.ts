"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/get-org";
import type { ActionState } from "./appointments";

export async function upsertService(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { organization } = await getOrgContext();
  const supabase = await createClient();

  const id = String(formData.get("id") ?? "") || null;
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const duration = parseInt(String(formData.get("duration_minutes") ?? ""), 10);
  const price = parseFloat(String(formData.get("price") ?? "0"));
  const allowPublic = formData.get("allow_public_booking") === "on";

  if (name.length < 2) return { error: "Ingresa un nombre para el servicio." };
  if (!Number.isFinite(duration) || duration <= 0)
    return { error: "La duración debe ser mayor a 0 minutos." };
  if (!Number.isFinite(price) || price < 0)
    return { error: "El precio no es válido." };

  const payload = {
    organization_id: organization.id,
    name,
    description,
    duration_minutes: duration,
    price,
    allow_public_booking: allowPublic,
  };

  const { error } = id
    ? await supabase
        .from("services")
        .update(payload)
        .eq("id", id)
        .eq("organization_id", organization.id)
    : await supabase.from("services").insert(payload);

  if (error) return { error: "No se pudo guardar el servicio." };

  revalidatePath("/app/servicios");
  return { error: null, success: true };
}

export async function toggleServiceActive(
  serviceId: string,
  active: boolean
): Promise<ActionState> {
  const { organization } = await getOrgContext();
  const supabase = await createClient();

  const { error } = await supabase
    .from("services")
    .update({ active })
    .eq("id", serviceId)
    .eq("organization_id", organization.id);

  if (error) return { error: "No se pudo actualizar el servicio." };

  revalidatePath("/app/servicios");
  return { error: null, success: true };
}
