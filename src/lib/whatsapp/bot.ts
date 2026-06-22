/**
 * Bot conversacional de reservas por WhatsApp (Fase 3B).
 * Recepcionista virtual: entiende lenguaje natural, propone horarios y agenda
 * la cita usando los mismos RPC que la página pública de reservas.
 * SOLO servidor.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { aiChat } from "@/lib/ai";

type Service = {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
};
type Professional = { id: string; name: string };
type Slot = { starts_at: string; ends_at: string; label: string };

type BotState = {
  service_id?: string;
  service_name?: string;
  professional_id?: string;
  professional_name?: string;
  date?: string; // YYYY-MM-DD
  time?: string; // HH:MM (hora local de la org)
  client_name?: string;
  phone?: string;
  history: { role: "user" | "bot"; text: string }[];
};

type BotContext = {
  slug: string;
  orgName: string;
  timezone: string;
  services: Service[];
  professionals: Professional[];
};

const CONV_TTL_MS = 60 * 60 * 1000; // 1h: tras inactividad, reinicia el hilo

/** HH:MM local (zona de la org) de un instante ISO. */
function localTime(iso: string, timezone: string): string {
  return new Date(iso).toLocaleTimeString("es-EC", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone || "America/Guayaquil",
  });
}

/** Carga contexto de reservas de la org (servicios públicos + profesionales). */
async function loadContext(
  organizationId: string
): Promise<BotContext | null> {
  const supabase = createAdminClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("slug, name, timezone, booking_enabled")
    .eq("id", organizationId)
    .single();
  if (!org || !org.booking_enabled) return null;

  const info = (await supabase.rpc("get_public_booking_info", {
    org_slug: org.slug,
  })) as { data: unknown };

  const parsed = info.data as {
    services?: Service[];
    professionals?: Professional[];
  } | null;

  return {
    slug: org.slug,
    orgName: org.name,
    timezone: org.timezone,
    services: parsed?.services ?? [],
    professionals: parsed?.professionals ?? [],
  };
}

async function loadState(
  organizationId: string,
  chatId: string
): Promise<BotState> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("whatsapp_conversations")
    .select("state, updated_at")
    .eq("organization_id", organizationId)
    .eq("chat_id", chatId)
    .maybeSingle();

  if (!data) return { history: [] };
  const stale = Date.now() - new Date(data.updated_at).getTime() > CONV_TTL_MS;
  if (stale) return { history: [] };
  return { history: [], ...(data.state as Partial<BotState>) } as BotState;
}

async function saveState(
  organizationId: string,
  chatId: string,
  state: BotState
): Promise<void> {
  const supabase = createAdminClient();
  await supabase.from("whatsapp_conversations").upsert(
    {
      organization_id: organizationId,
      chat_id: chatId,
      state: state as unknown as import("@/lib/supabase/database.types").Json,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,chat_id" }
  );
}

async function resetState(
  organizationId: string,
  chatId: string
): Promise<void> {
  const supabase = createAdminClient();
  await supabase
    .from("whatsapp_conversations")
    .delete()
    .eq("organization_id", organizationId)
    .eq("chat_id", chatId);
}

async function getSlots(
  ctx: BotContext,
  serviceId: string,
  professionalId: string,
  date: string
): Promise<Slot[]> {
  const supabase = createAdminClient();
  const { data } = await supabase.rpc("get_available_slots", {
    org_slug: ctx.slug,
    p_professional_id: professionalId,
    p_service_id: serviceId,
    p_date: date,
  });
  return ((data as unknown as Slot[]) ?? []).slice(0, 30);
}

type LlmOut = {
  reply: string;
  service_name: string | null;
  professional_name: string | null;
  date: string | null;
  time: string | null;
  client_name: string | null;
  phone: string | null;
  ready_to_book: boolean;
};

function fuzzyFind<T extends { name: string }>(
  list: T[],
  name: string | null
): T | undefined {
  if (!name) return undefined;
  const n = name.trim().toLowerCase();
  return (
    list.find((x) => x.name.toLowerCase() === n) ??
    list.find((x) => x.name.toLowerCase().includes(n)) ??
    list.find((x) => n.includes(x.name.toLowerCase()))
  );
}

async function askLlm(
  ctx: BotContext,
  state: BotState,
  todayEc: string,
  slots: Slot[] | null
): Promise<LlmOut> {
  const serviceList = ctx.services
    .map(
      (s) =>
        `- ${s.name} (${s.duration_minutes} min, $${s.price})`
    )
    .join("\n");
  const proList = ctx.professionals.map((p) => `- ${p.name}`).join("\n");
  const slotList =
    slots && slots.length
      ? slots.map((s) => localTime(s.starts_at, ctx.timezone)).join(", ")
      : slots
        ? "(no hay horarios libres ese día)"
        : "(aún no calculado)";

  const known = JSON.stringify({
    servicio: state.service_name ?? null,
    profesional: state.professional_name ?? null,
    fecha: state.date ?? null,
    hora: state.time ?? null,
    nombre: state.client_name ?? null,
    telefono: state.phone ?? null,
  });

  const system = `Eres la recepcionista virtual de "${ctx.orgName}" y agendas citas por WhatsApp, en español, con tono cálido y breve.

Hoy es ${todayEc} (zona ${ctx.timezone}).

SERVICIOS disponibles:
${serviceList || "(ninguno)"}

PROFESIONALES:
${proList || "(ninguno)"}

Para agendar necesitas: servicio, profesional (si hay varios; si solo hay uno, úsalo), fecha, hora, nombre del cliente y un teléfono de contacto.

Horarios disponibles para la selección actual: ${slotList}

Reglas:
- Pide SOLO los datos que falten, de a uno o dos por mensaje. No repreguntes lo ya conocido.
- Si el cliente da una fecha relativa ("mañana", "el martes"), conviértela a YYYY-MM-DD según la fecha de hoy.
- Propón horarios reales de la lista; nunca inventes horas. Si no hay, ofrece otro día.
- "ready_to_book" = true SOLO cuando tengas servicio, profesional, fecha, hora (de la lista), nombre y teléfono.
- "reply" es el mensaje que se enviará al cliente por WhatsApp.

Responde SOLO con JSON válido, sin texto extra:
{"reply": string, "service_name": string|null, "professional_name": string|null, "date": "YYYY-MM-DD"|null, "time": "HH:MM"|null, "client_name": string|null, "phone": string|null, "ready_to_book": boolean}`;

  const historyText = state.history
    .slice(-8)
    .map((h) => `${h.role === "user" ? "Cliente" : "Tú"}: ${h.text}`)
    .join("\n");

  const user = `Datos ya recopilados: ${known}\n\nConversación reciente:\n${historyText}`;

  const raw = await aiChat(system, user, { json: true });
  const cleaned = raw.replace(/```(?:json)?/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const obj = JSON.parse(cleaned.slice(start, end + 1)) as Partial<LlmOut>;

  return {
    reply: typeof obj.reply === "string" ? obj.reply : "¿Me repites, por favor?",
    service_name: obj.service_name ?? null,
    professional_name: obj.professional_name ?? null,
    date: obj.date ?? null,
    time: obj.time ?? null,
    client_name: obj.client_name ?? null,
    phone: obj.phone ?? null,
    ready_to_book: Boolean(obj.ready_to_book),
  };
}

/**
 * Procesa un mensaje entrante y devuelve la respuesta del bot (texto a enviar).
 * Maneja toda la memoria y la creación de la cita.
 */
export async function handleBookingMessage(
  organizationId: string,
  chatId: string,
  text: string,
  todayEc: string
): Promise<string> {
  const ctx = await loadContext(organizationId);
  if (!ctx)
    return "Gracias por escribir. Por ahora no puedo agendar citas automáticamente; en breve te atenderá una persona.";
  if (ctx.services.length === 0)
    return "Gracias por escribir. Aún no tenemos servicios disponibles para reservar en línea.";

  const state = await loadState(organizationId, chatId);
  state.history = state.history ?? [];
  state.history.push({ role: "user", text });

  // Si solo hay un profesional, fijarlo.
  if (!state.professional_id && ctx.professionals.length === 1) {
    state.professional_id = ctx.professionals[0].id;
    state.professional_name = ctx.professionals[0].name;
  }

  // Calcular slots si ya tenemos servicio + profesional + fecha.
  let slots: Slot[] | null = null;
  if (state.service_id && state.professional_id && state.date) {
    slots = await getSlots(
      ctx,
      state.service_id,
      state.professional_id,
      state.date
    );
  }

  let out: LlmOut;
  try {
    out = await askLlm(ctx, state, todayEc, slots);
  } catch (e) {
    console.error("[bot askLlm]", e);
    return "Disculpa, tuve un problema. ¿Puedes repetir tu mensaje?";
  }

  // Fusionar lo que el LLM extrajo (resolviendo nombres -> ids).
  const svc = fuzzyFind(ctx.services, out.service_name);
  if (svc) {
    state.service_id = svc.id;
    state.service_name = svc.name;
  }
  const pro = fuzzyFind(ctx.professionals, out.professional_name);
  if (pro) {
    state.professional_id = pro.id;
    state.professional_name = pro.name;
  }
  if (out.date) state.date = out.date;
  if (out.time) state.time = out.time;
  if (out.client_name) state.client_name = out.client_name;
  if (out.phone) state.phone = out.phone.replace(/[^\d+]/g, "");

  // ¿Listo para reservar? Validar contra slots reales antes de crear.
  const haveAll =
    state.service_id &&
    state.professional_id &&
    state.date &&
    state.time &&
    state.client_name &&
    state.phone;

  if (out.ready_to_book && haveAll) {
    const daySlots = await getSlots(
      ctx,
      state.service_id!,
      state.professional_id!,
      state.date!
    );
    const match = daySlots.find(
      (s) => localTime(s.starts_at, ctx.timezone) === state.time
    );

    if (!match) {
      const reply =
        daySlots.length > 0
          ? `Ese horario ya no está disponible. Para el ${state.date} tengo: ${daySlots
              .map((s) => localTime(s.starts_at, ctx.timezone))
              .join(", ")}. ¿Cuál prefieres?`
          : `No quedan horarios libres el ${state.date}. ¿Probamos otro día?`;
      state.time = undefined;
      state.history.push({ role: "bot", text: reply });
      await saveState(organizationId, chatId, state);
      return reply;
    }

    const supabase = createAdminClient();
    const { error } = await supabase.rpc("create_public_appointment", {
      org_slug: ctx.slug,
      p_professional_id: state.professional_id!,
      p_service_id: state.service_id!,
      p_starts_at: match.starts_at,
      p_client_name: state.client_name!,
      p_client_email: "",
      p_client_phone: state.phone!,
      p_notes: "Reserva por WhatsApp",
    });

    if (error) {
      console.error("[bot create_public_appointment]", error);
      const reply =
        "Uy, ese horario acaba de ocuparse. ¿Quieres elegir otro?";
      state.time = undefined;
      state.history.push({ role: "bot", text: reply });
      await saveState(organizationId, chatId, state);
      return reply;
    }

    const confirm = `✅ ¡Listo ${state.client_name}! Tu cita de *${state.service_name}* quedó agendada para el ${state.date} a las ${state.time}. ¡Te esperamos! 🙌`;
    await resetState(organizationId, chatId);
    return confirm;
  }

  state.history.push({ role: "bot", text: out.reply });
  await saveState(organizationId, chatId, state);
  return out.reply;
}
