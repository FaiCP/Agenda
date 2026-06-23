"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/get-org";
import { orgHasFeature, orgFeatureNumber, type PlanFeature } from "@/lib/features";
import { aiConfigured, aiChat, transcribeAudio } from "@/lib/ai";
import { VERTICALS } from "@/lib/verticals";
import {
  GOALS,
  DURATIONS,
  PLATFORMS,
  TONES,
  WEEKDAYS,
  type Goal,
  type Duration,
  type Platform,
  type Tone,
  type ScriptVariation,
  type ContentIdea,
  type FullPost,
  type AgendaCampaign,
  type CalendarDay,
  type RepurposePieces,
  type ActionResult,
} from "@/lib/marketing-catalog";
import type { Tables } from "@/lib/supabase/database.types";

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

const GOAL_GUIDE: Record<Goal, string> = {
  conseguir_citas:
    "Conseguir citas: el objetivo es que el espectador agende. CTA fuerte hacia la reserva.",
  educar:
    "Educar: enseña algo útil que posicione al profesional como experto y genere confianza.",
  promo_tratamiento:
    "Promocionar un tratamiento: explica el beneficio del tratamiento indicado y por qué vale la pena.",
  faq: "Responder preguntas frecuentes: resuelve una duda común que frena a la gente de agendar.",
  promo_mes:
    "Promoción del mes: comunica la oferta con urgencia amable, sin inventar precios no indicados.",
};

const PLATFORM_GUIDE: Record<Platform, string> = {
  tiktok:
    "TikTok: gancho brutal en los primeros 2 segundos, lenguaje natural y dinámico, texto en pantalla.",
  reels:
    "Instagram Reels: estético y con ritmo, gancho visual rápido, caption breve con 1 CTA.",
  facebook:
    "Facebook: tono cercano y claro, sirve público un poco mayor, CTA explícito.",
  whatsapp_status:
    "Estado de WhatsApp: súper directo, vertical, pensado para contactos que ya te conocen.",
};

const DURATION_GUIDE: Record<Duration, string> = {
  15: "15 segundos: UN solo mensaje. Gancho + 1 idea + CTA. Body de 1-2 frases.",
  30: "30 segundos: gancho + 2-3 puntos breves + CTA. Body de 3-4 frases.",
  60: "60 segundos: gancho + desarrollo con ejemplo o mini-historia + CTA. Body de 5-7 frases.",
};

// ---------- Helpers ----------

/** Valida la feature del plan + IA + cuota mensual. Devuelve contexto o error. */
async function guard(feature: PlanFeature): Promise<
  | { ok: true; supabase: SupabaseServer; organization: Tables<"organizations">; userId: string }
  | { ok: false; error: string }
> {
  const { organization, userId } = await getOrgContext();
  if (!(await orgHasFeature(organization.id, feature)))
    return {
      ok: false,
      error: "Esta función no está disponible en tu plan. Mejóralo para usarla.",
    };
  if (!aiConfigured())
    return { ok: false, error: "IA no configurada en el servidor (falta GROQ_API_KEY)." };

  const supabase = await createClient();
  const limit = await orgFeatureNumber(organization.id, "marketing_ai_monthly", 0);
  const used = await monthlyContentUsed(supabase, organization.id);
  if (limit > 0 && used >= limit)
    return {
      ok: false,
      error: `Alcanzaste el límite de ${limit} generaciones de IA este mes.`,
    };

  return { ok: true, supabase, organization, userId };
}

/** Cuenta generaciones (filas) creadas este mes para la cuota. */
async function monthlyContentUsed(
  supabase: SupabaseServer,
  orgId: string
): Promise<number> {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const { count } = await supabase
    .from("marketing_content")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .gte("created_at", start.toISOString());
  return count ?? 0;
}

/** Extrae el primer objeto JSON de la respuesta del modelo. */
function parseJson<T>(raw: string): T {
  const cleaned = raw.replace(/```(?:json)?/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Respuesta IA sin JSON");
  return JSON.parse(cleaned.slice(start, end + 1)) as T;
}

async function activeServices(supabase: SupabaseServer, orgId: string): Promise<string> {
  const { data } = await supabase
    .from("services")
    .select("name, duration_minutes, price")
    .eq("organization_id", orgId)
    .eq("active", true)
    .limit(12);
  return (data ?? [])
    .map((s) => `- ${s.name} (${s.duration_minutes} min, $${Number(s.price).toFixed(2)})`)
    .join("\n");
}

function businessContext(org: Tables<"organizations">, services: string): string {
  const v = VERTICALS[org.vertical];
  return `Negocio: ${org.name} — ${v.label} (atiende ${v.clientLabelPlural}) en Ecuador.
${org.phone ? `Teléfono: ${org.phone}` : ""}
${org.address ? `Dirección: ${org.address}` : ""}
Reservas en línea disponibles (AgendaPro).

Servicios activos:
${services || "(sin servicios cargados)"}`;
}

async function saveContent(
  supabase: SupabaseServer,
  org: Tables<"organizations">,
  userId: string,
  row: {
    kind: Tables<"marketing_content">["kind"];
    title?: string | null;
    platform?: string | null;
    goal?: string | null;
    payload: unknown;
  }
): Promise<string | undefined> {
  const { data } = await supabase
    .from("marketing_content")
    .insert({
      organization_id: org.id,
      created_by: userId,
      kind: row.kind,
      title: row.title ?? null,
      platform: row.platform ?? null,
      goal: row.goal ?? null,
      payload: row.payload as Tables<"marketing_content">["payload"],
      status: "draft",
    })
    .select("id")
    .single();
  return data?.id;
}

// ---------- 1. Guion + instrucciones de grabación (5 variaciones) ----------

export async function generateScript(input: {
  goal: string;
  duration: number;
  platform: string;
  topic: string;
}): Promise<ActionResult<ScriptVariation[]>> {
  const g = await guard("mkt_create");
  if (!g.ok) return { error: g.error };

  const goal = GOALS.find((x) => x.value === input.goal)?.value;
  const platform = PLATFORMS.find((x) => x.value === input.platform)?.value;
  const duration = DURATIONS.find((d) => d === input.duration);
  if (!goal || !platform || !duration) return { error: "Selección no válida." };

  const services = await activeServices(g.supabase, g.organization.id);
  const vertical = VERTICALS[g.organization.vertical];

  const system = `Eres un estratega de marketing de contenido para negocios de "${vertical.label}" en Ecuador. Escribes guiones de video cortos en español latino, cercanos y profesionales, SIN promesas médicas/legales exageradas ni garantías de resultados.

Devuelve SOLO un objeto JSON válido (sin bloques de código) con esta forma exacta:
{"variations": [
  {"tone": string, "hook": string, "body": string, "cta": string, "caption": string, "hashtags": string[], "recording": {"location": string, "shot": string, "expression": string}}
]}

Reglas:
- EXACTAMENTE 5 variaciones, una por cada tono en este orden: ${TONES.join(", ")}.
- "hook": primera frase que detiene el scroll. "body": desarrollo según duración. "cta": llamado a la acción claro (agendar).
- ${DURATION_GUIDE[duration]}
- ${PLATFORM_GUIDE[platform]}
- ${GOAL_GUIDE[goal]}
- "caption": texto para publicar (breve, con 1-2 emojis). "hashtags": 3-6 sin espacios, mezcla genéricos del rubro y locales de Ecuador.
- "recording": instrucciones para que CUALQUIER persona del consultorio grabe con un celular.
  - "location": dónde grabar dentro del local (realista para ${vertical.label}).
  - "shot": tipo de plano y encuadre (ej. "plano medio, cámara vertical, luz de frente").
  - "expression": cómo actuar frente a cámara (ej. "sonríe, habla despacio, mira a la cámara").
- Nunca inventes precios ni promociones no indicadas.`;

  const user = `${businessContext(g.organization, services)}

Tema indicado: ${input.topic.trim() || "(libre, elige tú el enfoque más relevante)"}

Genera las 5 variaciones en JSON.`;

  try {
    const raw = await aiChat(system, user, { json: true });
    const parsed = parseJson<{ variations?: unknown[] }>(raw);
    const variations = normalizeVariations(parsed.variations);
    if (variations.length === 0)
      return { error: "La IA no devolvió guiones. Intenta de nuevo." };

    const contentId = await saveContent(g.supabase, g.organization, g.userId, {
      kind: "script",
      title: input.topic.trim() || GOALS.find((x) => x.value === goal)?.label,
      platform,
      goal,
      payload: { duration, variations },
    });
    return { error: null, data: variations, contentId };
  } catch (e) {
    console.error("[generateScript]", e);
    return { error: "No se pudo generar el guion. Intenta de nuevo." };
  }
}

function normalizeVariations(raw: unknown): ScriptVariation[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((v): v is Record<string, unknown> => Boolean(v) && typeof v === "object")
    .map((v, i) => {
      const rec = (v.recording && typeof v.recording === "object"
        ? v.recording
        : {}) as Record<string, unknown>;
      return {
        tone: (TONES.includes(v.tone as Tone) ? v.tone : TONES[i % TONES.length]) as Tone,
        hook: str(v.hook),
        body: str(v.body),
        cta: str(v.cta),
        caption: str(v.caption),
        hashtags: Array.isArray(v.hashtags)
          ? v.hashtags.map(String).filter(Boolean).slice(0, 8)
          : [],
        recording: {
          location: str(rec.location),
          shot: str(rec.shot),
          expression: str(rec.expression),
        },
      };
    })
    .filter((v) => v.hook || v.body)
    .slice(0, 5);
}

// ---------- 2. Ideas de contenido (30) ----------

export async function generateIdeas(): Promise<ActionResult<ContentIdea[]>> {
  const g = await guard("mkt_ideas");
  if (!g.ok) return { error: g.error };

  const services = await activeServices(g.supabase, g.organization.id);
  const vertical = VERTICALS[g.organization.vertical];

  const system = `Eres un estratega de contenido para "${vertical.label}" en Ecuador. Propones ideas de publicaciones que un profesional puede grabar fácilmente.

Devuelve SOLO un objeto JSON válido (sin bloques de código):
{"ideas": [{"title": string, "angle": string}]}

Reglas:
- EXACTAMENTE 30 ideas, variadas: mitos, consejos rápidos, preguntas frecuentes, antes/después, casos, educación, detrás de cámara.
- "title": idea concreta y atractiva (ej. "¿Por qué sangran las encías?").
- "angle": en 1 frase, el enfoque o gancho de esa idea.
- Específicas del rubro ${vertical.label}; nada genérico ni repetido.`;

  const user = `${businessContext(g.organization, services)}

Genera 30 ideas en JSON.`;

  try {
    const raw = await aiChat(system, user, { json: true });
    const parsed = parseJson<{ ideas?: unknown[] }>(raw);
    const ideas: ContentIdea[] = (Array.isArray(parsed.ideas) ? parsed.ideas : [])
      .filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === "object")
      .map((x) => ({ title: str(x.title), angle: str(x.angle) }))
      .filter((x) => x.title)
      .slice(0, 30);
    if (ideas.length === 0) return { error: "La IA no devolvió ideas. Intenta de nuevo." };

    const contentId = await saveContent(g.supabase, g.organization, g.userId, {
      kind: "idea_batch",
      title: `${ideas.length} ideas de contenido`,
      payload: { ideas },
    });
    return { error: null, data: ideas, contentId };
  } catch (e) {
    console.error("[generateIdeas]", e);
    return { error: "No se pudieron generar ideas. Intenta de nuevo." };
  }
}

// ---------- 3. Expandir idea a publicación completa ----------

export async function expandIdeaToPost(input: {
  idea: string;
  platform: string;
}): Promise<ActionResult<FullPost>> {
  const g = await guard("mkt_create");
  if (!g.ok) return { error: g.error };

  const idea = input.idea.trim();
  if (!idea) return { error: "Falta la idea a desarrollar." };
  const platform = PLATFORMS.find((x) => x.value === input.platform)?.value ?? "reels";

  const services = await activeServices(g.supabase, g.organization.id);
  const vertical = VERTICALS[g.organization.vertical];

  const system = `Eres community manager para "${vertical.label}" en Ecuador. Conviertes una idea en una publicación lista para copiar y pegar.

Devuelve SOLO un objeto JSON válido (sin bloques de código):
{"title": string, "caption": string, "hashtags": string[], "emojis": string[], "imageIdea": string}

Reglas:
- ${PLATFORM_GUIDE[platform as Platform] ?? ""}
- "title": titular corto y atractivo.
- "caption": texto del post completo, listo para publicar, con emojis bien ubicados.
- "hashtags": 5-10 sin espacios (genéricos del rubro + locales de Ecuador).
- "emojis": 3-6 emojis sueltos sugeridos para reforzar.
- "imageIdea": foto o video que acompaña, grabable con celular en el local.
- Sin promesas exageradas ni precios inventados.`;

  const user = `${businessContext(g.organization, services)}

Idea a desarrollar: "${idea}"

Genera la publicación en JSON.`;

  try {
    const raw = await aiChat(system, user, { json: true });
    const p = parseJson<Record<string, unknown>>(raw);
    const post: FullPost = {
      title: str(p.title),
      caption: str(p.caption),
      hashtags: Array.isArray(p.hashtags)
        ? p.hashtags.map(String).filter(Boolean).slice(0, 12)
        : [],
      emojis: Array.isArray(p.emojis)
        ? p.emojis.map(String).filter(Boolean).slice(0, 8)
        : [],
      imageIdea: str(p.imageIdea),
    };
    if (!post.caption) return { error: "La IA no devolvió la publicación. Intenta de nuevo." };

    const contentId = await saveContent(g.supabase, g.organization, g.userId, {
      kind: "post",
      title: post.title || idea.slice(0, 60),
      platform,
      payload: post,
    });
    return { error: null, data: post, contentId };
  } catch (e) {
    console.error("[expandIdeaToPost]", e);
    return { error: "No se pudo crear la publicación. Intenta de nuevo." };
  }
}

// ---------- 4. Campañas basadas en la agenda ----------

interface AgendaSignals {
  upcomingWeek: number;
  cancellationsRecent: number;
  topService: string | null;
  inactiveClients: number;
}

export async function generateAgendaCampaigns(): Promise<
  ActionResult<AgendaCampaign[]>
> {
  const g = await guard("mkt_agenda");
  if (!g.ok) return { error: g.error };

  const signals = await collectAgendaSignals(g.supabase, g.organization.id);
  const vertical = VERTICALS[g.organization.vertical];
  const services = await activeServices(g.supabase, g.organization.id);

  const system = `Eres un estratega de marketing que usa los DATOS REALES de la agenda de un negocio de "${vertical.label}" en Ecuador para proponer campañas accionables.

Devuelve SOLO un objeto JSON válido (sin bloques de código):
{"campaigns": [{"situation": string, "title": string, "audience": string, "message": string, "hook": string, "body": string, "cta": string}]}

Reglas:
- Propón solo campañas JUSTIFICADAS por las señales dadas (no inventes datos que no estén).
- Posibles situaciones: pocos turnos la próxima semana → campaña para llenar huecos; servicio muy frecuente → venta adicional/upsell relacionado; ${vertical.clientLabelPlural} inactivos → reactivación; muchas cancelaciones → promover disponibilidad inmediata.
- "situation": qué señal la motiva. "audience": a quién va dirigida.
- "message": mensaje breve listo para enviar por WhatsApp/estado (tono cercano).
- "hook"/"body"/"cta": guion corto por si lo quieren grabar en video.
- Entre 2 y 4 campañas. Sin precios inventados.`;

  const user = `${businessContext(g.organization, services)}

Señales de la agenda (datos reales):
- Citas agendadas para los próximos 7 días: ${signals.upcomingWeek}
- Cancelaciones en los últimos 14 días: ${signals.cancellationsRecent}
- Servicio más frecuente (últimos 30 días): ${signals.topService ?? "sin datos"}
- ${vertical.clientLabelPlural} sin volver hace 6+ meses: ${signals.inactiveClients}

Genera las campañas en JSON.`;

  try {
    const raw = await aiChat(system, user, { json: true });
    const parsed = parseJson<{ campaigns?: unknown[] }>(raw);
    const campaigns: AgendaCampaign[] = (Array.isArray(parsed.campaigns) ? parsed.campaigns : [])
      .filter((c): c is Record<string, unknown> => Boolean(c) && typeof c === "object")
      .map((c) => ({
        situation: str(c.situation),
        title: str(c.title),
        audience: str(c.audience),
        message: str(c.message),
        hook: str(c.hook),
        body: str(c.body),
        cta: str(c.cta),
      }))
      .filter((c) => c.title && c.message)
      .slice(0, 4);
    if (campaigns.length === 0)
      return { error: "No hay suficientes datos en tu agenda para sugerir campañas todavía." };

    const contentId = await saveContent(g.supabase, g.organization, g.userId, {
      kind: "campaign",
      title: "Campañas desde tu agenda",
      payload: { signals, campaigns },
    });
    return { error: null, data: campaigns, contentId };
  } catch (e) {
    console.error("[generateAgendaCampaigns]", e);
    return { error: "No se pudieron generar campañas. Intenta de nuevo." };
  }
}

async function collectAgendaSignals(
  supabase: SupabaseServer,
  orgId: string
): Promise<AgendaSignals> {
  const now = new Date();
  const in7 = new Date(now.getTime() + 7 * 86400000);
  const last14 = new Date(now.getTime() - 14 * 86400000);
  const last30 = new Date(now.getTime() - 30 * 86400000);

  const [upcoming, cancellations, recent, risk] = await Promise.all([
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .in("status", ["pending", "confirmed"])
      .gte("starts_at", now.toISOString())
      .lte("starts_at", in7.toISOString()),
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "cancelled")
      .gte("starts_at", last14.toISOString()),
    supabase
      .from("appointments")
      .select("service_id, services(name)")
      .eq("organization_id", orgId)
      .gte("starts_at", last30.toISOString())
      .limit(500),
    supabase.rpc("client_risk_stats", { p_organization_id: orgId }),
  ]);

  // Servicio más frecuente
  const counts = new Map<string, number>();
  for (const row of (recent.data ?? []) as { services: { name: string } | null }[]) {
    const name = row.services?.name;
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const topService =
    [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  // Inactivos 6+ meses
  const sixMonthsAgo = new Date(now.getTime() - 182 * 86400000);
  const inactiveClients = ((risk.data ?? []) as {
    last_visit: string | null;
    next_appointment: string | null;
  }[]).filter(
    (c) =>
      c.last_visit &&
      new Date(c.last_visit) < sixMonthsAgo &&
      !c.next_appointment
  ).length;

  return {
    upcomingWeek: upcoming.count ?? 0,
    cancellationsRecent: cancellations.count ?? 0,
    topService,
    inactiveClients,
  };
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

// ---------- 5. Calendario semanal ----------

export async function generateWeeklyCalendar(): Promise<
  ActionResult<CalendarDay[]>
> {
  const g = await guard("mkt_create");
  if (!g.ok) return { error: g.error };

  const services = await activeServices(g.supabase, g.organization.id);
  const vertical = VERTICALS[g.organization.vertical];

  const system = `Eres un estratega de contenido para "${vertical.label}" en Ecuador. Diseñas un calendario semanal de publicaciones, UNA idea por día, equilibrado y variado.

Devuelve SOLO un objeto JSON válido (sin bloques de código):
{"calendar": [{"day": string, "theme": string, "idea": string}]}

Reglas:
- EXACTAMENTE 7 entradas, una por cada día en este orden: ${WEEKDAYS.join(", ")}.
- "theme": tipo de contenido del día (ej. "Mito", "Consejo rápido", "Antes y después", "Pregunta frecuente", "Caso", "Promoción", "Historia del profesional").
- "idea": idea concreta y publicable para ese día, específica de ${vertical.label}.
- Variado: no repitas temas ni ideas. Sábado puede ser promocional, domingo más humano/cercano.`;

  const user = `${businessContext(g.organization, services)}

Genera el calendario semanal en JSON.`;

  try {
    const raw = await aiChat(system, user, { json: true });
    const parsed = parseJson<{ calendar?: unknown[] }>(raw);
    const calendar: CalendarDay[] = (Array.isArray(parsed.calendar) ? parsed.calendar : [])
      .filter((d): d is Record<string, unknown> => Boolean(d) && typeof d === "object")
      .map((d, i) => ({
        day: (WEEKDAYS.includes(d.day as CalendarDay["day"])
          ? d.day
          : WEEKDAYS[i % 7]) as CalendarDay["day"],
        theme: str(d.theme),
        idea: str(d.idea),
      }))
      .filter((d) => d.idea)
      .slice(0, 7);
    if (calendar.length === 0)
      return { error: "La IA no devolvió el calendario. Intenta de nuevo." };

    const contentId = await saveContent(g.supabase, g.organization, g.userId, {
      kind: "calendar",
      title: "Calendario semanal",
      payload: { calendar },
    });
    return { error: null, data: calendar, contentId };
  } catch (e) {
    console.error("[generateWeeklyCalendar]", e);
    return { error: "No se pudo generar el calendario. Intenta de nuevo." };
  }
}

// ---------- 6. Reutilizar contenido (1 → N piezas) ----------

const REPURPOSE_MAX_BYTES = 25 * 1024 * 1024; // tope de Groq Whisper (~25 MB)

export async function repurposeContent(
  formData: FormData
): Promise<ActionResult<RepurposePieces>> {
  const g = await guard("mkt_create");
  if (!g.ok) return { error: g.error };

  let source = String(formData.get("text") ?? "").trim();

  // Si subieron un archivo (video/audio), lo transcribimos con Whisper.
  const media = formData.get("media");
  if (media instanceof File && media.size > 0) {
    if (media.size > REPURPOSE_MAX_BYTES)
      return { error: "El archivo es muy grande (máx 25 MB)." };
    if (!/^(audio|video)\//.test(media.type))
      return { error: "Sube un archivo de audio o video." };
    try {
      const transcript = await transcribeAudio(media);
      source = [source, transcript].filter(Boolean).join("\n\n").trim();
    } catch (e) {
      console.error("[repurposeContent] transcripción", e);
      return { error: "No se pudo transcribir el archivo. Intenta con audio más corto." };
    }
  }

  if (source.length < 20)
    return { error: "Pega un texto o sube un video con contenido para reutilizar." };

  const vertical = VERTICALS[g.organization.vertical];
  const services = await activeServices(g.supabase, g.organization.id);

  const system = `Eres un estratega de contenido para "${vertical.label}" en Ecuador. Tomas UN contenido base y lo conviertes en varias piezas listas para distintos formatos, en español latino.

Devuelve SOLO un objeto JSON válido (sin bloques de código):
{"reel": {"hook": string, "body": string, "cta": string},
 "story": string,
 "carousel": string[],
 "post": {"caption": string, "hashtags": string[]}}

Reglas:
- "reel": guion corto para Reel/TikTok (gancho + desarrollo breve + CTA).
- "story": texto de 1-2 líneas para una historia con encuesta o invitación.
- "carousel": 4-6 diapositivas; cada string es el texto de una diapositiva (la 1 es portada con gancho, la última un CTA).
- "post": publicación para Facebook/Instagram con caption y 5-8 hashtags sin espacios.
- Conserva el mensaje del contenido base; no inventes datos ni precios.`;

  const user = `${businessContext(g.organization, services)}

Contenido base a reutilizar:
"""
${source.slice(0, 4000)}
"""

Genera las piezas en JSON.`;

  try {
    const raw = await aiChat(system, user, { json: true });
    const p = parseJson<Record<string, unknown>>(raw);
    const reel = (p.reel && typeof p.reel === "object" ? p.reel : {}) as Record<string, unknown>;
    const post = (p.post && typeof p.post === "object" ? p.post : {}) as Record<string, unknown>;
    const pieces: RepurposePieces = {
      reel: { hook: str(reel.hook), body: str(reel.body), cta: str(reel.cta) },
      story: str(p.story),
      carousel: Array.isArray(p.carousel)
        ? p.carousel.map(String).map((s) => s.trim()).filter(Boolean).slice(0, 8)
        : [],
      post: {
        caption: str(post.caption),
        hashtags: Array.isArray(post.hashtags)
          ? post.hashtags.map(String).filter(Boolean).slice(0, 12)
          : [],
      },
    };
    if (!pieces.reel.hook && !pieces.post.caption && pieces.carousel.length === 0)
      return { error: "La IA no devolvió piezas. Intenta de nuevo." };

    const contentId = await saveContent(g.supabase, g.organization, g.userId, {
      kind: "repurpose",
      title: source.slice(0, 60),
      payload: pieces,
    });
    return { error: null, data: pieces, contentId };
  } catch (e) {
    console.error("[repurposeContent]", e);
    return { error: "No se pudo reutilizar el contenido. Intenta de nuevo." };
  }
}

// ---------- Biblioteca: contenido guardado ----------

export type SavedContent = Pick<
  Tables<"marketing_content">,
  "id" | "kind" | "title" | "platform" | "goal" | "payload" | "created_at"
>;

export async function listSavedContent(): Promise<ActionResult<SavedContent[]>> {
  const { organization } = await getOrgContext();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("marketing_content")
    .select("id, kind, title, platform, goal, payload, created_at")
    .eq("organization_id", organization.id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return { error: "No se pudo cargar la biblioteca." };
  return { error: null, data: data ?? [] };
}

export async function deleteSavedContent(
  id: string
): Promise<{ error: string | null }> {
  const { organization, role } = await getOrgContext();
  if (role !== "owner")
    return { error: "Solo el propietario puede borrar contenido." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("marketing_content")
    .delete()
    .eq("id", id)
    .eq("organization_id", organization.id);
  return { error: error ? "No se pudo borrar." : null };
}
