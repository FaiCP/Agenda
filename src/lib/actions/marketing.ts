"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/get-org";
import { orgHasFeature } from "@/lib/features";
import { aiConfigured, aiChat } from "@/lib/ai";
import { VERTICALS } from "@/lib/verticals";

export interface SocialPost {
  caption: string;
  hashtags: string[];
  imageIdea: string;
}

export interface SocialPostsResult {
  error: string | null;
  posts?: SocialPost[];
}

const PLATFORMS = ["instagram", "facebook", "tiktok", "whatsapp"] as const;
const GOALS = ["atraer", "promocion", "educativo", "recordatorio"] as const;

const PLATFORM_GUIDE: Record<(typeof PLATFORMS)[number], string> = {
  instagram:
    "Instagram: caption de 2-4 párrafos cortos con emojis moderados, gancho en la primera línea, llamado a la acción al final, 5-10 hashtags.",
  facebook:
    "Facebook: texto conversacional de 2-4 párrafos, puede ser un poco más largo, 3-5 hashtags máximo, llamado a la acción claro.",
  tiktok:
    "TikTok: descripción corta y con gancho (máx. 150 caracteres ideales), 3-6 hashtags incluyendo alguno de tendencia genérica; en imageIdea describe la idea del VIDEO (escenas, texto en pantalla).",
  whatsapp:
    "Estado de WhatsApp: mensaje breve y directo (2-4 líneas), sin hashtags (lista vacía), con invitación a escribir o agendar.",
};

const GOAL_GUIDE: Record<(typeof GOALS)[number], string> = {
  atraer: "Atraer clientes nuevos: presenta el servicio y su beneficio principal.",
  promocion: "Promoción u oferta: destaca la promoción indicada con urgencia amable.",
  educativo:
    "Contenido educativo: comparte un consejo o dato útil del área profesional que posicione como experto.",
  recordatorio:
    "Recordatorio de agendar: motiva a clientes existentes a retomar su cita o control.",
};

export async function generateSocialPosts(input: {
  platform: string;
  goal: string;
  topic: string;
}): Promise<SocialPostsResult> {
  const { organization } = await getOrgContext();

  if (!(await orgHasFeature(organization.id, "ai_features")))
    return { error: "Tu plan no incluye funciones de IA. Mejora al plan Premium." };
  if (!aiConfigured())
    return { error: "IA no configurada en el servidor (falta GROQ_API_KEY)." };

  const platform = PLATFORMS.find((p) => p === input.platform);
  const goal = GOALS.find((g) => g === input.goal);
  if (!platform || !goal) return { error: "Selección no válida." };

  const supabase = await createClient();
  const { data: services } = await supabase
    .from("services")
    .select("name, duration_minutes, price")
    .eq("organization_id", organization.id)
    .eq("active", true)
    .limit(10);

  const servicesList = (services ?? [])
    .map((s) => `- ${s.name} (${s.duration_minutes} min, $${Number(s.price).toFixed(2)})`)
    .join("\n");

  const vertical = VERTICALS[organization.vertical];

  const system = `Eres un community manager experto en negocios de "${vertical.label}" en Ecuador. Creas publicaciones en español latino, cercanas y profesionales, sin promesas médicas/legales exageradas ni garantías de resultados.

Responde SOLO con un objeto JSON válido (sin bloques de código) con esta forma exacta:
{"posts": [{"caption": string, "hashtags": string[], "imageIdea": string}, ...]}

Reglas:
- Exactamente 3 publicaciones, con enfoques distintos entre sí.
- ${PLATFORM_GUIDE[platform]}
- ${GOAL_GUIDE[goal]}
- "imageIdea": descripción en 1-2 frases de la foto/imagen (o video en TikTok) que acompaña al post, realizable con un celular en el local.
- Menciona el nombre del negocio cuando aporte; nunca inventes precios ni promociones no indicadas.
- Hashtags sin espacios, mezclando genéricos del rubro y locales de Ecuador.`;

  const user = `Negocio: ${organization.name} (${vertical.label})
${organization.phone ? `Teléfono: ${organization.phone}` : ""}
Página de reservas: agendapro — los clientes pueden agendar en línea.

Servicios activos:
${servicesList || "(sin servicios cargados)"}

Tema o promoción indicada por el profesional: ${input.topic.trim() || "(libre, elige tú el enfoque)"}

Genera las 3 publicaciones en JSON.`;

  try {
    const raw = await aiChat(system, user, { json: true });
    const cleaned = raw.replace(/```(?:json)?/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("Respuesta IA sin JSON");
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as {
      posts?: { caption?: unknown; hashtags?: unknown; imageIdea?: unknown }[];
    };

    const posts: SocialPost[] = (parsed.posts ?? [])
      .filter((p) => typeof p.caption === "string" && p.caption)
      .slice(0, 3)
      .map((p) => ({
        caption: String(p.caption),
        hashtags: Array.isArray(p.hashtags)
          ? p.hashtags.map(String).filter(Boolean).slice(0, 12)
          : [],
        imageIdea: typeof p.imageIdea === "string" ? p.imageIdea : "",
      }));

    if (posts.length === 0)
      return { error: "La IA no devolvió publicaciones. Intenta de nuevo." };
    return { error: null, posts };
  } catch (e) {
    console.error("[generateSocialPosts]", e);
    return { error: "No se pudo generar el contenido. Intenta de nuevo." };
  }
}
