"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgContext } from "@/lib/get-org";
import type { Enums } from "@/lib/supabase/database.types";
import {
  sendWhatsapp,
  formatWhen,
  msgConfirmation,
  msgCancellation,
  msgReschedule,
} from "@/lib/whatsapp/notify";

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
    .select("duration_minutes, name")
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

  // Confirmación por WhatsApp (best-effort, no bloquea la cita)
  const { data: client } = await supabase
    .from("clients")
    .select("full_name, phone")
    .eq("id", clientId)
    .single();
  if (client?.phone) {
    await sendWhatsapp(
      organization.id,
      client.phone,
      msgConfirmation({
        orgName: organization.name,
        clientName: client.full_name,
        serviceName: service.name,
        when: formatWhen(startsAt.toISOString(), organization.timezone),
      })
    );
  }

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

  // Aviso de cancelación por WhatsApp (best-effort)
  if (status === "cancelled") {
    const { data: appt } = await supabase
      .from("appointments")
      .select("starts_at, clients(full_name, phone), services(name)")
      .eq("id", appointmentId)
      .eq("organization_id", organization.id)
      .single();
    if (appt?.clients?.phone) {
      await sendWhatsapp(
        organization.id,
        appt.clients.phone,
        msgCancellation({
          orgName: organization.name,
          clientName: appt.clients.full_name,
          serviceName: appt.services?.name ?? "tu servicio",
          when: formatWhen(appt.starts_at, organization.timezone),
          reason,
        })
      );
    }
  }

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

  // Aviso de reagenda por WhatsApp (best-effort)
  const { data: full } = await supabase
    .from("appointments")
    .select("clients(full_name, phone), services(name)")
    .eq("id", appointmentId)
    .eq("organization_id", organization.id)
    .single();
  if (full?.clients?.phone) {
    await sendWhatsapp(
      organization.id,
      full.clients.phone,
      msgReschedule({
        orgName: organization.name,
        clientName: full.clients.full_name,
        serviceName: full.services?.name ?? "tu servicio",
        when: formatWhen(startsAt.toISOString(), organization.timezone),
      })
    );
  }

  revalidatePath("/app");
  return { error: null, success: true };
}

/**
 * Confirmación por WhatsApp para reservas hechas desde la página pública.
 * Se llama tras el RPC `create_public_appointment` (contexto sin sesión).
 * Best-effort: nunca lanza.
 */
export async function notifyPublicBooking(input: {
  slug: string;
  clientName: string;
  phone: string;
  serviceName: string;
  startsAt: string;
}): Promise<void> {
  try {
    const supabase = createAdminClient();
    const { data: org } = await supabase
      .from("organizations")
      .select("id, name, timezone")
      .eq("slug", input.slug)
      .single();
    if (!org) return;

    await sendWhatsapp(
      org.id,
      input.phone,
      msgConfirmation({
        orgName: org.name,
        clientName: input.clientName,
        serviceName: input.serviceName,
        when: formatWhen(input.startsAt, org.timezone),
      })
    );
  } catch (e) {
    console.error("[notifyPublicBooking]", e);
  }
}
