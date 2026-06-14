"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { VERTICALS, type Vertical } from "@/lib/verticals";

export type OnboardingState = { error: string | null };

export async function createOrganization(
  _prev: OnboardingState,
  formData: FormData
): Promise<OnboardingState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const name = String(formData.get("name") ?? "").trim();
  const vertical = String(formData.get("vertical") ?? "generic") as Vertical;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const createExamples = formData.get("create_examples") === "on";

  if (name.length < 3)
    return { error: "El nombre debe tener al menos 3 caracteres." };
  if (!(vertical in VERTICALS))
    return { error: "Selecciona un tipo de práctica válido." };

  const config = VERTICALS[vertical];

  const { error: orgError } = await supabase.rpc("create_organization", {
    p_name: name,
    p_vertical: vertical,
    p_phone: phone ?? "",
    p_client_label: config.clientLabel,
    p_create_examples: createExamples,
    p_example_services: config.exampleServices,
  });

  if (orgError)
    return { error: "No se pudo crear la organización. Intenta de nuevo." };

  redirect("/app");
}
