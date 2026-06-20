import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsapp, formatWhen, msgReminder } from "@/lib/whatsapp/notify";

// Envío de recordatorios puede tardar si hay muchas citas.
export const maxDuration = 60;

// Ventana: recordar citas que empiezan en las próximas N horas.
const WINDOW_HOURS = 24;

/**
 * Recordatorios de cita por WhatsApp. Pensado para un cron externo que llame
 * GET /api/cron/reminders?token=CRON_SECRET cada hora.
 * Idempotente: marca reminder_sent_at para no repetir.
 */
export async function GET(req: Request) {
  // Acepta ?token=CRON_SECRET (cron externo) o Authorization: Bearer CRON_SECRET
  // (cron nativo de Vercel).
  const url = new URL(req.url);
  const secret = process.env.CRON_SECRET;
  const tokenOk = url.searchParams.get("token") === secret;
  const headerOk = req.headers.get("authorization") === `Bearer ${secret}`;
  if (!secret || (!tokenOk && !headerOk))
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const now = new Date();
  const until = new Date(now.getTime() + WINDOW_HOURS * 3600_000);

  const { data: due, error } = await supabase
    .from("appointments")
    .select(
      "id, starts_at, organization_id, clients(full_name, phone), services(name), organizations(name, timezone)"
    )
    .in("status", ["pending", "confirmed"])
    .is("reminder_sent_at", null)
    .gte("starts_at", now.toISOString())
    .lte("starts_at", until.toISOString())
    .limit(200);

  if (error)
    return NextResponse.json({ error: "query" }, { status: 500 });

  let sent = 0;
  for (const appt of due ?? []) {
    const phone = appt.clients?.phone;
    const org = appt.organizations;
    if (!phone || !org) {
      // Sin teléfono u org: marcar para no reintentar indefinidamente.
      await supabase
        .from("appointments")
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq("id", appt.id);
      continue;
    }

    const ok = await sendWhatsapp(
      appt.organization_id,
      phone,
      msgReminder({
        orgName: org.name,
        clientName: appt.clients?.full_name ?? "",
        serviceName: appt.services?.name ?? "tu servicio",
        when: formatWhen(appt.starts_at, org.timezone),
      })
    );
    if (ok) sent++;

    // Marcar enviado (incluso si el envío falló, para no spamear reintentos;
    // ajusta esto si prefieres reintentar los fallidos).
    await supabase
      .from("appointments")
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq("id", appt.id);
  }

  return NextResponse.json({ ok: true, processed: due?.length ?? 0, sent });
}
