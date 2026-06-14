"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/get-org";
import { orgHasFeature, orgFeatureNumber } from "@/lib/features";

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

const FORMATS = ["reel", "post", "story"] as const;
type Format = (typeof FORMATS)[number];

const MAX_PHOTOS = 5;
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const SIGNED_URL_TTL = 3600; // 1h: Creatomate descarga las fotos durante el render
const CAPTION_MAX = 2200;

const TEMPLATE_BY_FORMAT: Record<Format, string | undefined> = {
  reel: process.env.CREATOMATE_TEMPLATE_REEL,
  post: process.env.CREATOMATE_TEMPLATE_POST,
  story: process.env.CREATOMATE_TEMPLATE_STORY,
};

export interface CreateRenderResult {
  error: string | null;
  assetId?: string;
}

export async function createMediaRender(
  formData: FormData
): Promise<CreateRenderResult> {
  const { organization, userId } = await getOrgContext();

  if (!(await orgHasFeature(organization.id, "ai_features")))
    return { error: "Tu plan no incluye marketing con IA. Mejora al plan Premium." };

  const format =
    FORMATS.find((f) => f === formData.get("format")) ?? "reel";
  const templateId = TEMPLATE_BY_FORMAT[format];
  if (!templateId || !process.env.CREATOMATE_API_KEY)
    return { error: "El generador de video no está configurado en el servidor." };

  const caption = String(formData.get("caption") ?? "").slice(0, CAPTION_MAX);
  const photos = formData
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0);

  if (photos.length === 0) return { error: "Sube al menos una foto." };
  if (photos.length > MAX_PHOTOS)
    return { error: `Máximo ${MAX_PHOTOS} fotos.` };
  for (const p of photos) {
    if (p.size > MAX_PHOTO_BYTES)
      return { error: "Cada foto debe pesar menos de 8 MB." };
    if (!/^image\/(png|jpe?g|webp)$/.test(p.type))
      return { error: "Solo imágenes JPG, PNG o WebP." };
  }

  const supabase = await createClient();

  // Cuota mensual del plan
  const limit = await orgFeatureNumber(
    organization.id,
    "marketing_renders_monthly",
    0
  );
  if (limit <= 0)
    return { error: "Tu plan no incluye generación de videos." };
  const used = await rendersUsedThisMonth(supabase, organization.id);
  if (used >= limit)
    return { error: `Alcanzaste el límite de ${limit} videos este mes.` };

  // Crea la fila primero para usar su id en el path de storage
  const { data: asset, error: insErr } = await supabase
    .from("media_assets")
    .insert({
      organization_id: organization.id,
      created_by: userId,
      format,
      caption,
      template_id: templateId,
      status: "pending",
    })
    .select("id")
    .single();
  if (insErr || !asset)
    return { error: "No se pudo iniciar la generación." };

  // Sube fotos y firma URLs para que Creatomate las descargue
  const sourcePaths: string[] = [];
  const signedUrls: string[] = [];
  for (let i = 0; i < photos.length; i++) {
    const ext = photos[i].name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${organization.id}/${asset.id}/${i}.${ext}`;
    const up = await supabase.storage
      .from("marketing-uploads")
      .upload(path, photos[i], { contentType: photos[i].type, upsert: true });
    if (up.error) {
      await failAsset(supabase, asset.id, "upload");
      return { error: "No se pudieron subir las fotos." };
    }
    const { data: signed } = await supabase.storage
      .from("marketing-uploads")
      .createSignedUrl(path, SIGNED_URL_TTL);
    if (!signed?.signedUrl) {
      await failAsset(supabase, asset.id, "sign");
      return { error: "Error preparando las fotos." };
    }
    sourcePaths.push(path);
    signedUrls.push(signed.signedUrl);
  }

  // Dispara el render en Creatomate
  try {
    const res = await fetch("https://api.creatomate.com/v2/renders", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.CREATOMATE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        template_id: templateId,
        modifications: buildModifications(signedUrls, caption),
        webhook_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/creatomate?token=${process.env.CREATOMATE_WEBHOOK_SECRET}`,
      }),
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);

    const render = (await res.json()) as { id?: string };
    const renderId = render.id;
    if (!renderId) throw new Error("respuesta sin render id");

    await supabase
      .from("media_assets")
      .update({ status: "rendering", render_id: renderId, source_paths: sourcePaths })
      .eq("id", asset.id);

    return { error: null, assetId: asset.id };
  } catch (e) {
    console.error("[createMediaRender]", e);
    await failAsset(supabase, asset.id, "render");
    return { error: "No se pudo generar el video. Intenta de nuevo." };
  }
}

export interface MediaAssetView {
  id: string;
  status: string;
  format: string;
  caption: string | null;
  videoUrl: string | null;
  error: string | null;
}

export async function getMediaAsset(
  id: string
): Promise<MediaAssetView | null> {
  const { organization } = await getOrgContext();
  const supabase = await createClient();

  const { data } = await supabase
    .from("media_assets")
    .select("id, status, format, caption, output_path, error")
    .eq("id", id)
    .eq("organization_id", organization.id)
    .maybeSingle();
  if (!data) return null;

  let videoUrl: string | null = null;
  if (data.status === "ready" && data.output_path) {
    const { data: signed } = await supabase.storage
      .from("marketing-media")
      .createSignedUrl(data.output_path, SIGNED_URL_TTL);
    videoUrl = signed?.signedUrl ?? null;
  }

  return {
    id: data.id,
    status: data.status,
    format: data.format,
    caption: data.caption,
    videoUrl,
    error: data.error,
  };
}

/**
 * Mapea fotos y caption a los nombres de elementos de la plantilla Creatomate.
 * Los nombres (`Photo-1`, `Caption`, ...) deben coincidir con los del editor,
 * con la capa "Dynamic" activada para que la API pueda escribirles.
 */
function buildModifications(
  urls: string[],
  caption: string
): Record<string, string> {
  const mods: Record<string, string> = { Caption: caption };
  urls.forEach((url, i) => {
    mods[`Photo-${i + 1}.source`] = url;
  });
  return mods;
}

async function failAsset(
  supabase: SupabaseServer,
  id: string,
  reason: string
): Promise<void> {
  await supabase
    .from("media_assets")
    .update({ status: "failed", error: reason })
    .eq("id", id);
}

/** Renders no fallidos creados en el mes calendario actual (para la cuota). */
async function rendersUsedThisMonth(
  supabase: SupabaseServer,
  orgId: string
): Promise<number> {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { count } = await supabase
    .from("media_assets")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .neq("status", "failed")
    .gte("created_at", monthStart.toISOString());

  return count ?? 0;
}
