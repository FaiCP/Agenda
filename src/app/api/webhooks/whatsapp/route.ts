import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendText } from "@/lib/whatsapp/client";
import { handleBookingMessage } from "@/lib/whatsapp/bot";
import { todayInEcuador } from "@/lib/dates";

// Webhook de mensajes entrantes desde el gateway OpenWA.
// FASE 3B: filtra ruido, mapea sesión→org y deja que el bot agende la cita.

export const maxDuration = 30;

interface OpenWaMessage {
  event?: string;
  sessionId?: string;
  data?: {
    id?: string;
    from?: string;
    chatId?: string;
    body?: string;
    type?: string;
    fromMe?: boolean;
    isGroup?: boolean;
    isStatusBroadcast?: boolean;
    contact?: { pushName?: string };
  };
}

export async function POST(req: Request) {
  let payload: OpenWaMessage;
  try {
    payload = (await req.json()) as OpenWaMessage;
  } catch {
    return NextResponse.json({ ok: true }); // 200 para que no reintente
  }

  const msg = payload.data;
  const sessionId = payload.sessionId;

  // Ignorar ruido: sin datos, propios, grupos, estados, no-texto, vacíos.
  if (
    !msg ||
    !sessionId ||
    msg.fromMe ||
    msg.isGroup ||
    msg.isStatusBroadcast ||
    msg.type !== "text" ||
    !msg.body?.trim() ||
    !msg.chatId
  ) {
    return NextResponse.json({ ok: true });
  }

  // Autenticación: la sesión debe existir y estar conectada en NUESTRA BD.
  // (OpenWA no preserva el ?token=, así que validamos por sessionId real.)
  const supabase = createAdminClient();
  const { data: conn } = await supabase
    .from("whatsapp_connections")
    .select("organization_id, status")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (!conn || conn.status !== "connected") {
    return NextResponse.json({ ok: true });
  }

  const text = msg.body.trim();

  // El bot procesa el mensaje y devuelve la respuesta a enviar.
  try {
    const reply = await handleBookingMessage(
      conn.organization_id,
      msg.chatId,
      text,
      todayInEcuador()
    );
    if (reply) await sendText(sessionId, msg.chatId, reply);
  } catch (e) {
    console.error("[whatsapp bot]", e);
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
