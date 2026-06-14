"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/get-org";
import type { Enums } from "@/lib/supabase/database.types";

export type ActionState = { error: string | null; success?: boolean };

export async function createAppointment(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { organization } = await getOrgContext();
  const supabase = await createClient();

  const clientId = String(formData.get("client_id") ?? "");
  const serviceId = String(formData.get("service_id") ?? "");
  const professionalId = String(formData.get("professional_id") ?? "");
  const date = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "");
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!clientId || !serviceId || !professionalId || !date || !time)
    return { error: "Completa todos los campos obligatorios." };

  const { data: service } = await supabase
    .from("services")
    .select("duration_minutes")
    .eq("id", serviceId)
    .eq("organization_id", organization.id)
    .single();
  if (!service) return { error: "Servicio no válido." };

  // Interpretar fecha/hora en la zona horaria de la organización vía RPC no disponible:
  // guardamos asumiendo hora local de la org usando offset fijo de Ecuador (UTC-5, sin DST).
  const startsAt = new Date(`${date}T${time}:00-05:00`);
  if (isNaN(startsAt.getTime())) return { error: "Fecha u hora inválida." };
  const endsAt = new Date(
    startsAt.getTime() + service.duration_minutes * 60_000
  );

  // Validar solape con citas activas del profesional
  const { data: overlap } = await supabase
    .from("appointments")
    .select("id")
    .eq("professional_id", professionalId)
    .eq("organization_id", organization.id)
    .in("status", ["pending", "confirmed"])
    .lt("starts_at", endsAt.toISOString())
    .gt("ends_at", startsAt.toISOString())
    .limit(1);
  if (overlap && overlap.length > 0)
    return { error: "El profesional ya tiene una cita en ese horario." };

  const { error } = await supabase.from("appointments").insert({
    organization_id: organization.id,
    client_id: clientId,
    service_id: serviceId,
    professional_id: professionalId,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    status: "confirmed",
    origin: "internal",
    notes,
  });

  if (error) return { error: "No se pudo crear la cita." };

  revalidatePath("/app");
  return { error: null, success: true };
}

export async function updateAppointmentStatus(
  appointmentId: string,
  status: Enums<"appointment_status">,
  reason?: string
): Promise<ActionState> {
  const { organization } = await getOrgContext();
  const supabase = await createClient();

  const { error } = await supabase
    .from("appointments")
    .update({
      status,
      cancellation_reason: status === "cancelled" ? (reason ?? null) : null,
    })
    .eq("id", appointmentId)
    .eq("organization_id", organization.id);

  if (error) return { error: "No se pudo actualizar la cita." };

  revalidatePath("/app");
  return { error: null, success: true };
}

export async function rescheduleAppointment(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { organization } = await getOrgContext();
  const supabase = await createClient();

  const appointmentId = String(formData.get("appointment_id") ?? "");
  const date = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "");
  if (!appointmentId || !date || !time)
    return { error: "Completa fecha y hora." };

  const { data: appt } = await supabase
    .from("appointments")
    .select("starts_at, ends_at, professional_id")
    .eq("id", appointmentId)
    .eq("organization_id", organization.id)
    .single();
  if (!appt) return { error: "Cita no encontrada." };

  const durationMs =
    new Date(appt.ends_at).getTime() - new Date(appt.starts_at).getTime();
  const startsAt = new Date(`${date}T${time}:00-05:00`);
  if (isNaN(startsAt.getTime())) return { error: "Fecha u hora inválida." };
  const endsAt = new Date(startsAt.getTime() + durationMs);

  const { data: overlap } = await supabase
    .from("appointments")
    .select("id")
    .eq("professional_id", appt.professional_id)
    .eq("organization_id", organization.id)
    .in("status", ["pending", "confirmed"])
    .neq("id", appointmentId)
    .lt("starts_at", endsAt.toISOString())
    .gt("ends_at", startsAt.toISOString())
    .limit(1);
  if (overlap && overlap.length > 0)
    return { error: "El profesional ya tiene una cita en ese horario." };

  const { error } = await supabase
    .from("appointments")
    .update({
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      status: "confirmed",
    })
    .eq("id", appointmentId)
    .eq("organization_id", organization.id);

  if (error) return { error: "No se pudo reagendar la cita." };

  revalidatePath("/app");
  return { error: null, success: true };
}
