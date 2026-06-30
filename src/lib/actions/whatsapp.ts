"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/get-org";
import { orgHasFeature } from "@/lib/features";
import {
  ensureSession,
  resolveSessionId,
  getQr,
  getStatus,
  deleteSession,
  registerWebhook,
  orgSessionName,
  whatsappConfigured,
  type GatewayStatus,
} from "@/lib/whatsapp/client";
import {
  sendWhatsapp,
  formatWhen,
  msgReminder,
} from "@/lib/whatsapp/notify";
import type { Tables } from "@/lib/supabase/database.types";

type WhatsappConnection = Tables<"whatsapp_connections">;

/** Conexión WhatsApp de la org activa (o null si nunca se conectó). */
export async function getWhatsappConnection(): Promise<WhatsappConnection | null> {
  const { organization } = await getOrgContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from("whatsapp_connections")
    .select("*")
    .eq("organization_id", organization.id)
    .maybeSingle();
  return data ?? null;
}

/**
 * UUID de la sesión en el gateway para esta org.
 * Usa el guardado en la BD; si falta, lo resuelve por name contra el gateway.
 */
async function gatewaySessionId(organizationId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("whatsapp_connections")
    .select("session_id")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (data?.session_id) return data.session_id;
  return resolveSessionId(orgSessionName(organizationId));
}

/** Inicia la sesión en el gateway y guarda su UUID. Solo owner. */
export async function startWhatsappConnection(): Promise<{ error: string | null }> {
  const { organization, role } = await getOrgContext();
  if (role !== "owner")
    return { error: "Solo el propietario puede conectar WhatsApp." };
  if (!(await orgHasFeature(organization.id, "whatsapp_bot")))
    return {
      error:
        "El bot de WhatsApp está disponible desde el plan Inicial. Mejora tu plan para conectarlo.",
    };
  if (!whatsappConfigured())
    return { error: "El gateway de WhatsApp no está configurado." };

  const name = orgSessionName(organization.id);
  let uuid: string;
  try {
    uuid = await ensureSession(name);
  } catch (e) {
    console.error("[whatsapp connect]", e);
    const detail = e instanceof Error ? e.message : String(e);
    return { error: `Gateway: ${detail}` };
  }

  // Registrar webhook de mensajes entrantes (best-effort).
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const hookSecret = process.env.WHATSAPP_WEBHOOK_SECRET;
  if (appUrl && hookSecret) {
    await registerWebhook(
      uuid,
      `${appUrl.replace(/\/$/, "")}/api/webhooks/whatsapp?token=${hookSecret}`
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.from("whatsapp_connections").upsert(
    {
      organization_id: organization.id,
      session_id: uuid,
      status: "connecting",
      last_qr_at: new Date().toISOString(),
    },
    { onConflict: "organization_id" }
  );
  if (error) return { error: "No se pudo guardar el estado." };

  revalidatePath("/app/configuracion");
  return { error: null };
}

/** Devuelve el QR para escanear. Solo owner. */
export async function fetchWhatsappQr(): Promise<{
  image?: string;
  raw?: string;
  error: string | null;
}> {
  const { organization, role } = await getOrgContext();
  if (role !== "owner") return { error: "No autorizado." };

  const uuid = await gatewaySessionId(organization.id);
  if (!uuid) return { error: "Sesión no iniciada." };

  try {
    const qr = await getQr(uuid);
    return { ...qr, error: null };
  } catch {
    return { error: "No se pudo obtener el código QR." };
  }
}

/** Consulta el estado real en el gateway y lo sincroniza en la BD. Solo owner. */
export async function syncWhatsappStatus(): Promise<{
  status: GatewayStatus;
  phone: string | null;
  error: string | null;
}> {
  const { organization, role } = await getOrgContext();
  if (role !== "owner")
    return { status: "disconnected", phone: null, error: "No autorizado." };

  const uuid = await gatewaySessionId(organization.id);
  if (!uuid)
    return { status: "disconnected", phone: null, error: null };

  let result: { status: GatewayStatus; phone: string | null };
  try {
    result = await getStatus(uuid);
  } catch {
    return {
      status: "disconnected",
      phone: null,
      error: "No se pudo contactar el gateway.",
    };
  }

  const supabase = await createClient();
  await supabase
    .from("whatsapp_connections")
    .update({
      status: result.status,
      phone: result.phone,
      connected_at:
        result.status === "connected" ? new Date().toISOString() : null,
    })
    .eq("organization_id", organization.id);

  revalidatePath("/app/configuracion");
  return { ...result, error: null };
}

/** Envía manualmente un recordatorio de una cita por WhatsApp. */
export async function sendManualReminder(
  appointmentId: string
): Promise<{ error: string | null }> {
  const { organization } = await getOrgContext();
  const supabase = await createClient();

  const { data: appt } = await supabase
    .from("appointments")
    .select("starts_at, clients(full_name, phone), services(name)")
    .eq("id", appointmentId)
    .eq("organization_id", organization.id)
    .single();

  if (!appt) return { error: "Cita no encontrada." };
  if (!appt.clients?.phone)
    return { error: "El cliente no tiene teléfono registrado." };

  const ok = await sendWhatsapp(
    organization.id,
    appt.clients.phone,
    msgReminder({
      orgName: organization.name,
      clientName: appt.clients.full_name,
      serviceName: appt.services?.name ?? "tu servicio",
      when: formatWhen(appt.starts_at, organization.timezone),
    })
  );

  return ok
    ? { error: null }
    : { error: "No se pudo enviar. ¿WhatsApp está conectado?" };
}

/** Desvincula el número: elimina la sesión en el gateway. Solo owner. */
export async function disconnectWhatsapp(): Promise<{ error: string | null }> {
  const { organization, role } = await getOrgContext();
  if (role !== "owner")
    return { error: "Solo el propietario puede desconectar WhatsApp." };

  const uuid = await gatewaySessionId(organization.id);
  if (uuid) await deleteSession(uuid);

  const supabase = await createClient();
  await supabase
    .from("whatsapp_connections")
    .update({ status: "disconnected", phone: null, connected_at: null })
    .eq("organization_id", organization.id);

  revalidatePath("/app/configuracion");
  return { error: null };
}
