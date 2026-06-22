import type { CSSProperties } from "react";
import type { Json } from "@/lib/supabase/database.types";

// Personalización de la página pública de reservas. Todo vive en la columna
// JSON `organizations.branding` (ver migración 0005) para crecer sin más
// migraciones. El logo usa la columna `organizations.logo_url` (preexistente).

export type TemplateId = "minimal" | "elegante" | "medico" | "moderno";
export type BackgroundType = "default" | "color" | "image";

export interface Branding {
  template: TemplateId;
  brand_color: string | null;
  cover_url: string | null;
  background: { type: BackgroundType; value: string | null };
  gallery: string[];
}

export interface TemplatePreset {
  id: TemplateId;
  name: string;
  /** Color de marca por defecto si el jefe no elige uno. */
  defaultColor: string;
  /** Header con hero centrado sobre la portada, o barra simple a la izquierda. */
  heroLayout: "centered" | "bar";
  description: string;
}

export const TEMPLATES: TemplatePreset[] = [
  {
    id: "minimal",
    name: "Minimal",
    defaultColor: "#0052ff",
    heroLayout: "bar",
    description: "Limpio y directo. Barra simple con tu logo.",
  },
  {
    id: "elegante",
    name: "Elegante",
    defaultColor: "#7c3aed",
    heroLayout: "centered",
    description: "Portada amplia con tu nombre centrado.",
  },
  {
    id: "medico",
    name: "Médico",
    defaultColor: "#0d9488",
    heroLayout: "bar",
    description: "Sobrio y confiable, tonos clínicos.",
  },
  {
    id: "moderno",
    name: "Moderno",
    defaultColor: "#ea580c",
    heroLayout: "centered",
    description: "Audaz, con portada a todo color.",
  },
];

const DEFAULT_TEMPLATE: TemplateId = "minimal";

export function templatePreset(id: TemplateId | null | undefined): TemplatePreset {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}

/** Normaliza el JSON crudo de la DB a un objeto Branding completo y seguro. */
export function parseBranding(raw: Json | null | undefined): Branding {
  const b = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<
    string,
    unknown
  >;
  const template = TEMPLATES.some((t) => t.id === b.template)
    ? (b.template as TemplateId)
    : DEFAULT_TEMPLATE;
  const bg = (b.background && typeof b.background === "object"
    ? b.background
    : {}) as Record<string, unknown>;
  const bgType: BackgroundType =
    bg.type === "color" || bg.type === "image" ? bg.type : "default";
  return {
    template,
    brand_color: isHexColor(b.brand_color) ? (b.brand_color as string) : null,
    cover_url: typeof b.cover_url === "string" ? b.cover_url : null,
    background: {
      type: bgType,
      value: typeof bg.value === "string" ? bg.value : null,
    },
    gallery: Array.isArray(b.gallery)
      ? b.gallery.filter((g): g is string => typeof g === "string").slice(0, 12)
      : [],
  };
}

export function isHexColor(v: unknown): v is string {
  return typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);
}

/** Color de marca efectivo: el elegido, o el del template. */
export function effectiveColor(branding: Branding): string {
  return branding.brand_color ?? templatePreset(branding.template).defaultColor;
}

/** Estilos del contenedor raíz: fondo + variable de color de marca. */
export function pageStyle(branding: Branding): CSSProperties {
  const style: CSSProperties & Record<string, string> = {
    ["--primary"]: effectiveColor(branding),
  };
  const bg = branding.background;
  if (bg.type === "color" && isHexColor(bg.value)) {
    style.backgroundColor = bg.value;
  } else if (bg.type === "image" && bg.value) {
    style.backgroundImage = `url(${cssUrl(bg.value)})`;
    style.backgroundSize = "cover";
    style.backgroundPosition = "center";
    style.backgroundAttachment = "fixed";
  }
  return style;
}

/** Escapa una URL para usarla con seguridad dentro de `url(...)` en CSS. */
export function cssUrl(url: string): string {
  return url.replace(/["'()\\\s]/g, encodeURIComponent);
}
