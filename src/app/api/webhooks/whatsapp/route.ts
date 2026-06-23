import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendText } from "@/lib/whatsapp/client";
import { handleBookingMessage } from "@/lib/whatsapp/bot";
import { todayInEcuador } from "@/lib/dates";
import { timingSafeEqualStr, rateLimit } from "@/lib/security";

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
  // Autenticación del webhook: el secreto va en la URL registrada (?token=) o,
  // si el gateway lo soporta, en un header. Comparación en tiempo constante.
  const secret = process.env.WHATSAPP_WEBHOOK_SECRET;
  if (secret) {
    const url = new URL(req.url);
    const token =
      url.searchParams.get("token") ??
      req.headers.get("x-webhook-token") ??
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
      null;
    if (!timingSafeEqualStr(token, secret)) {
      // 200 silencioso: no procesa, y evita que el gateway reintente en bucle.
      return NextResponse.json({ ok: true });
    }
  }

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

  // Defensa en profundidad: además del token, la sesión debe existir y estar
  // conectada en NUESTRA BD.
  const supabase = createAdminClient();
  const { data: conn } = await supabase
    .from("whatsapp_connections")
    .select("organization_id, status")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (!conn || conn.status !== "connected") {
    return NextResponse.json({ ok: true });
  }

  // Anti-abuso: limita cuántos mensajes procesa el bot (LLM = coste) por chat.
  if (!rateLimit(`wa:${conn.organization_id}:${msg.chatId}`, 12, 60_000)) {
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
