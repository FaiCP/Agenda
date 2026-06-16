"use server";

import { revalidatePath } from "next/cache";
import { getOrgContext } from "@/lib/get-org";
import { createAdminClient } from "@/lib/supabase/admin";

export type TeamActionState = { error: string | null; success?: boolean };

/** Cuántos profesionales (miembros que atienden citas) tiene la organización. */
async function professionalCount(orgId: string): Promise<number> {
  const admin = createAdminClient();
  const { count } = await admin
    .from("organization_members")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("accepts_appointments", true);
  return count ?? 0;
}

/** Límite de profesionales del plan activo (free = 1 si no hay suscripción). */
async function professionalLimit(orgId: string): Promise<number> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("subscriptions")
    .select("status, plans(max_professionals)")
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!data || data.status !== "active") return 1;
  return data.plans?.max_professionals ?? 1;
}

/**
 * Agrega un profesional gestionado por el dueño (Caso A): se crea una cuenta
 * sin necesidad de que el profesional inicie sesión. Aparece en la agenda,
 * disponibilidad y página de reservas.
 */
export async function addProfessional(
  _prev: TeamActionState,
  formData: FormData
): Promise<TeamActionState> {
  const { organization, role } = await getOrgContext();
  if (role !== "owner")
    return { error: "Solo el dueño puede gestionar el equipo." };

  const fullName = String(formData.get("full_name") ?? "").trim();
  const displayName = String(formData.get("display_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (fullName.length < 3)
    return { error: "El nombre debe tener al menos 3 caracteres." };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { error: "El correo no es válido." };

  const [used, limit] = await Promise.all([
    professionalCount(organization.id),
    professionalLimit(organization.id),
  ]);
  if (used >= limit)
    return {
      error: `Tu plan permite ${limit} profesional${limit === 1 ? "" : "es"}. Mejora tu plan para agregar más.`,
    };

  const admin = createAdminClient();

  // Correo sintético si el dueño no aporta uno: el profesional no inicia sesión.
  const loginEmail =
    email || `staff.${crypto.randomUUID()}@${organization.slug}.agendapro.local`;

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: loginEmail,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (createErr || !created.user) {
    if (createErr?.message?.toLowerCase().includes("already"))
      return { error: "Ya existe una cuenta con ese correo." };
    return { error: "No se pudo crear el profesional. Intenta de nuevo." };
  }

  // El trigger handle_new_user ya creó la fila en profiles con el full_name.
  const { error: memberErr } = await admin.from("organization_members").insert({
    organization_id: organization.id,
    profile_id: created.user.id,
    display_name: displayName || null,
    role: "professional",
    accepts_appointments: true,
  });

  if (memberErr) {
    // Revierte el usuario huérfano si falla el alta del miembro.
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: "No se pudo agregar el profesional al equipo." };
  }

  revalidatePath("/app/equipo");
  revalidatePath("/app");
  revalidatePath("/app/disponibilidad");
  return { error: null, success: true };
}

/** Edita los datos de un miembro (incluido el dueño): nombre real, nombre
 * visible en agenda/reservas y si atiende citas. */
export async function updateMember(
  _prev: TeamActionState,
  formData: FormData
): Promise<TeamActionState> {
  const { organization, role } = await getOrgContext();
  if (role !== "owner")
    return { error: "Solo el dueño puede gestionar el equipo." };

  const memberId = String(formData.get("member_id") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const displayName = String(formData.get("display_name") ?? "").trim();
  const accepts = formData.get("accepts_appointments") === "on";

  if (fullName.length < 3)
    return { error: "El nombre debe tener al menos 3 caracteres." };

  const admin = createAdminClient();

  const { data: member } = await admin
    .from("organization_members")
    .select("id, profile_id, accepts_appointments")
    .eq("id", memberId)
    .eq("organization_id", organization.id)
    .maybeSingle();
  if (!member) return { error: "Miembro no encontrado." };

  // Si se activa "atiende citas" y antes no lo hacía, valida el límite del plan.
  if (accepts && !member.accepts_appointments) {
    const [used, limit] = await Promise.all([
      professionalCount(organization.id),
      professionalLimit(organization.id),
    ]);
    if (used >= limit)
      return {
        error: `Tu plan permite ${limit} profesional${limit === 1 ? "" : "es"}. Mejora tu plan para activar más.`,
      };
  }

  const { error: profErr } = await admin
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", member.profile_id);
  if (profErr) return { error: "No se pudo actualizar el nombre." };

  const { error: memErr } = await admin
    .from("organization_members")
    .update({
      display_name: displayName || null,
      accepts_appointments: accepts,
    })
    .eq("id", memberId)
    .eq("organization_id", organization.id);
  if (memErr) return { error: "No se pudieron guardar los cambios." };

  revalidatePath("/app/equipo");
  revalidatePath("/app");
  revalidatePath("/app/disponibilidad");
  return { error: null, success: true };
}

/** Quita un profesional del equipo. Conserva su cuenta para no romper el
 * historial de citas; deja de aparecer en la agenda y reservas. */
export async function removeMember(memberId: string): Promise<TeamActionState> {
  const { organization, userId, role } = await getOrgContext();
  if (role !== "owner")
    return { error: "Solo el dueño puede gestionar el equipo." };

  const admin = createAdminClient();

  const { data: member } = await admin
    .from("organization_members")
    .select("id, profile_id, role")
    .eq("id", memberId)
    .eq("organization_id", organization.id)
    .maybeSingle();

  if (!member) return { error: "Profesional no encontrado." };
  if (member.role === "owner")
    return { error: "No puedes quitar al dueño de la organización." };
  if (member.profile_id === userId)
    return { error: "No puedes quitarte a ti mismo." };

  const { error } = await admin
    .from("organization_members")
    .delete()
    .eq("id", memberId)
    .eq("organization_id", organization.id);

  if (error) return { error: "No se pudo quitar al profesional." };

  revalidatePath("/app/equipo");
  revalidatePath("/app");
  revalidatePath("/app/disponibilidad");
  return { error: null, success: true };
}
