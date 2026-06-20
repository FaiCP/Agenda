/**
 * Envío de notificaciones WhatsApp a clientes (best-effort).
 * SOLO servidor. Nunca lanza: si algo falla, devuelve false y registra el error,
 * para no romper la creación/edición de la cita.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import {
  sendText,
  toChatId,
  resolveSessionId,
  orgSessionName,
} from "./client";

/**
 * Envía un texto al cliente desde el WhatsApp de la organización.
 * Requiere que la org tenga su sesión "connected".
 */
export async function sendWhatsapp(
  organizationId: string,
  phone: string | null | undefined,
  text: string
): Promise<boolean> {
  if (!phone) return false;
  const chatId = toChatId(phone);
  if (!chatId) return false;

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("whatsapp_connections")
    .select("session_id, status")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!data || data.status !== "connected") return false;

  const uuid =
    data.session_id ?? (await resolveSessionId(orgSessionName(organizationId)));
  if (!uuid) return false;

  try {
    return await sendText(uuid, chatId, text);
  } catch (e) {
    console.error("[whatsapp notify]", e);
    return false;
  }
}

/** Fecha/hora legible en la zona horaria de la organización. */
export function formatWhen(startsAt: string, timezone: string): string {
  return new Date(startsAt).toLocaleString("es-EC", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: timezone || "America/Guayaquil",
  });
}

type MsgData = {
  orgName: string;
  clientName: string;
  serviceName: string;
  when: string;
};

export function msgConfirmation({
  orgName,
  clientName,
  serviceName,
  when,
}: MsgData): string {
  return (
    `✅ ¡Hola ${clientName}! Tu cita en *${orgName}* quedó confirmada:\n\n` +
    `📅 ${when}\n💼 ${serviceName}\n\n` +
    `Si necesitas cancelar o reagendar, escríbenos por aquí. ¡Te esperamos!`
  );
}

export function msgReminder({
  orgName,
  clientName,
  serviceName,
  when,
}: MsgData): string {
  return (
    `⏰ Hola ${clientName}, te recordamos tu cita en *${orgName}*:\n\n` +
    `📅 ${when}\n💼 ${serviceName}\n\n¡Te esperamos!`
  );
}

export function msgCancellation({
  orgName,
  clientName,
  serviceName,
  when,
  reason,
}: MsgData & { reason?: string | null }): string {
  return (
    `❌ Hola ${clientName}, tu cita en *${orgName}* fue cancelada:\n\n` +
    `📅 ${when}\n💼 ${serviceName}` +
    (reason ? `\n📝 Motivo: ${reason}` : "") +
    `\n\nSi deseas reagendar, escríbenos.`
  );
}

export function msgReschedule({
  orgName,
  clientName,
  serviceName,
  when,
}: MsgData): string {
  return (
    `🔄 Hola ${clientName}, tu cita en *${orgName}* se reagendó:\n\n` +
    `📅 Nueva fecha: ${when}\n💼 ${serviceName}\n\n¡Te esperamos!`
  );
}
