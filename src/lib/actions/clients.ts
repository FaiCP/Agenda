"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/get-org";
import type { ActionState } from "./appointments";
import type { Json } from "@/lib/supabase/database.types";

export async function upsertClient(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { organization } = await getOrgContext();
  const supabase = await createClient();

  const id = String(formData.get("id") ?? "") || null;
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const documentId = String(formData.get("document_id") ?? "").trim() || null;
  const birthDate = String(formData.get("birth_date") ?? "") || null;
  const address = String(formData.get("address") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (fullName.length < 2) return { error: "Ingresa el nombre completo." };

  const payload = {
    organization_id: organization.id,
    full_name: fullName,
    email: email?.toLowerCase() ?? null,
    phone,
    document_id: documentId,
    birth_date: birthDate,
    address,
    notes,
  };

  let newId: string | null = null;
  if (id) {
    const { error } = await supabase
      .from("clients")
      .update(payload)
      .eq("id", id)
      .eq("organization_id", organization.id);
    if (error) return { error: "No se pudo guardar." };
  } else {
    const { data, error } = await supabase
      .from("clients")
      .insert(payload)
      .select("id")
      .single();
    if (error || !data) return { error: "No se pudo crear." };
    newId = data.id;
  }

  revalidatePath("/app/clientes");
  if (newId) redirect(`/app/clientes/${newId}`);
  return { error: null, success: true };
}

export async function addRecordEntry(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { organization, userId } = await getOrgContext();
  const supabase = await createClient();

  const clientId = String(formData.get("client_id") ?? "");
  const templateId = String(formData.get("template_id") ?? "") || null;
  const title = String(formData.get("title") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!clientId) return { error: "Cliente no válido." };

  // Campos dinámicos: prefijo field__
  const data: Record<string, Json> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("field__") && typeof value === "string" && value !== "") {
      data[key.slice(7)] = value;
    }
  }

  // Expediente del cliente: crear si no existe
  let { data: record } = await supabase
    .from("records")
    .select("id")
    .eq("client_id", clientId)
    .eq("organization_id", organization.id)
    .maybeSingle();

  if (!record) {
    const { data: created, error: recordError } = await supabase
      .from("records")
      .insert({
        organization_id: organization.id,
        client_id: clientId,
        template_id: templateId,
      })
      .select("id")
      .single();
    if (recordError || !created)
      return { error: "No se pudo crear el expediente." };
    record = created;
  }

  const { error } = await supabase.from("record_entries").insert({
    record_id: record.id,
    organization_id: organization.id,
    author_id: userId,
    title,
    data,
    notes,
  });

  if (error) return { error: "No se pudo guardar la entrada." };

  revalidatePath(`/app/clientes/${clientId}`);
  return { error: null, success: true };
}
