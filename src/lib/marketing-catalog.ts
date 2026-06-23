// Catálogo y tipos del Agente de Marketing.
// Vive fuera de los server actions porque un módulo "use server" solo puede
// exportar funciones async. Lo reusan tanto las actions como la UI.

export const GOALS = [
  { value: "conseguir_citas", label: "Conseguir citas" },
  { value: "educar", label: "Educar pacientes" },
  { value: "promo_tratamiento", label: "Promocionar un tratamiento" },
  { value: "faq", label: "Responder preguntas frecuentes" },
  { value: "promo_mes", label: "Promoción del mes" },
] as const;

export const DURATIONS = [15, 30, 60] as const;

export const PLATFORMS = [
  { value: "tiktok", label: "TikTok" },
  { value: "reels", label: "Instagram Reels" },
  { value: "facebook", label: "Facebook" },
  { value: "whatsapp_status", label: "Estado de WhatsApp" },
] as const;

export const TONES = [
  "seria",
  "divertida",
  "profesional",
  "emocional",
  "viral",
] as const;

export type Goal = (typeof GOALS)[number]["value"];
export type Duration = (typeof DURATIONS)[number];
export type Platform = (typeof PLATFORMS)[number]["value"];
export type Tone = (typeof TONES)[number];

export interface RecordingTips {
  location: string;
  shot: string;
  expression: string;
}

export interface ScriptVariation {
  tone: Tone;
  hook: string;
  body: string;
  cta: string;
  caption: string;
  hashtags: string[];
  recording: RecordingTips;
}

export interface ContentIdea {
  title: string;
  angle: string;
}

export interface FullPost {
  title: string;
  caption: string;
  hashtags: string[];
  emojis: string[];
  imageIdea: string;
}

export interface AgendaCampaign {
  situation: string;
  title: string;
  audience: string;
  message: string;
  hook: string;
  body: string;
  cta: string;
}

export interface ActionResult<T> {
  error: string | null;
  data?: T;
  contentId?: string;
}

// ---- Fase 2: calendario semanal ----

export const WEEKDAYS = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
] as const;

export type Weekday = (typeof WEEKDAYS)[number];

export interface CalendarDay {
  day: Weekday;
  theme: string;
  idea: string;
}

// ---- Fase 2: reutilizar contenido (1 → N piezas) ----

export interface RepurposePieces {
  reel: { hook: string; body: string; cta: string };
  story: string;
  carousel: string[];
  post: { caption: string; hashtags: string[] };
}
