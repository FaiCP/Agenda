# Marketing Fase 0 — Diseño técnico

Generar Reel/imagen por plantilla (Creatomate) + caption IA → **descargar / compartir**.
Sin publicación directa, sin tokens sociales, sin App Review. Lanzable ya.

Reusa convenciones existentes: server actions (`src/lib/actions/*`), `getOrgContext`,
`orgHasFeature`, Supabase Storage (igual que `billing.ts`), RLS con `is_org_member`.

---

## 1. Flujo

```
Marketing view → pestaña "Reel / Imagen"
  1. Usuario sube 1-5 fotos del local
  2. Caption (prellenado desde generateSocialPosts, o manual)
  3. Elige formato: reel 9:16 | post 1:1 | estado 9:16
  4. "Generar video"
        → createMediaRender (server action)
             · valida feature + cuota mensual del plan
             · sube fotos a bucket marketing-uploads
             · firma URLs (TTL 1h) → Creatomate las descarga
             · POST a Creatomate /v1/renders (template + modifications + webhook)
             · INSERT media_assets (status=pending, render_id)
        → Creatomate renderiza async (~5-15s)
        → POST /api/webhooks/creatomate
             · valida token + render_id
             · descarga MP4 → sube a bucket marketing-media (service role)
             · UPDATE status=ready, output_path
  5. Cliente hace polling getMediaAsset(id) cada 3s
        → status=ready → <video> + Descargar + Compartir (Web Share API)
```

Creatomate es el worker pesado (render fuera de tu servidor). Tu serverless solo
dispara y recibe webhook → requests cortos. Por eso Fase 0 no necesita cola propia.

---

## 2. Variables de entorno nuevas

```
CREATOMATE_API_KEY=...
CREATOMATE_TEMPLATE_REEL=<template_id 9:16>
CREATOMATE_TEMPLATE_POST=<template_id 1:1>
CREATOMATE_TEMPLATE_STORY=<template_id 9:16>
CREATOMATE_WEBHOOK_SECRET=<random>            # valida el callback
SUPABASE_SERVICE_ROLE_KEY=...                 # webhook escribe sin sesión
# NEXT_PUBLIC_APP_URL ya existe — base del webhook_url
```

---

## 3. Schema (migración SQL)

```sql
-- Tipos
create type public.media_status as enum ('pending','rendering','ready','failed');
create type public.media_format as enum ('reel','post','story');

-- Tabla
create table public.media_assets (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  created_by       uuid references public.profiles(id) on delete set null,
  format           public.media_format not null default 'reel',
  status           public.media_status not null default 'pending',
  caption          text,
  template_id      text,
  render_id        text,                         -- id de render Creatomate (match webhook)
  source_paths     text[] not null default '{}', -- paths de fotos en storage
  output_path      text,                         -- path del MP4 final
  duration_seconds numeric,
  error            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index media_assets_org_created_idx on public.media_assets (organization_id, created_at desc);
create index media_assets_render_idx       on public.media_assets (render_id);

-- updated_at trigger (si ya existe set_updated_at(), reusarlo)
create trigger media_assets_set_updated_at
  before update on public.media_assets
  for each row execute function public.set_updated_at();

-- RLS
alter table public.media_assets enable row level security;

create policy "media_assets_select" on public.media_assets
  for select using (public.is_org_member(organization_id));
create policy "media_assets_insert" on public.media_assets
  for insert with check (public.is_org_member(organization_id));
create policy "media_assets_update" on public.media_assets
  for update using (public.is_org_member(organization_id));
-- DELETE opcional; el webhook usa service role y omite RLS.
```

> Si `set_updated_at()` no existe en tu DB, crea el trigger estándar o quita el trigger
> y setea `updated_at = now()` en cada UPDATE del código.

### Buckets de Storage

```sql
insert into storage.buckets (id, name, public)
values ('marketing-uploads','marketing-uploads', false),
       ('marketing-media',  'marketing-media',   false)
on conflict (id) do nothing;
```

Políticas de Storage (acceso por carpeta = `${organization_id}/...`, igual patrón que
`receipts`). Lectura/escritura solo a miembros de la org:

```sql
-- marketing-uploads
create policy "mkt_uploads_rw" on storage.objects
  for all to authenticated
  using (bucket_id = 'marketing-uploads'
         and public.is_org_member((storage.foldername(name))[1]::uuid))
  with check (bucket_id = 'marketing-uploads'
         and public.is_org_member((storage.foldername(name))[1]::uuid));

-- marketing-media (solo lectura desde el cliente; escribe el webhook con service role)
create policy "mkt_media_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'marketing-media'
         and public.is_org_member((storage.foldername(name))[1]::uuid));
```

Path convención: `marketing-uploads/{org_id}/{asset_id}/{i}.{ext}` ·
`marketing-media/{org_id}/{asset_id}.mp4`.

---

## 4. Cuota por plan

Reusa `plans.features` (JSON). Agrega clave numérica:

```json
{ "ai_features": true, "marketing_renders_monthly": 20 }
```

Helper nuevo en `src/lib/features.ts`:

```ts
export async function orgFeatureNumber(
  organizationId: string,
  key: string,
  fallback = 0
): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("subscriptions")
    .select("status, plans(features)")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!data || data.status !== "active") return 0;
  const features = (data.plans?.features ?? {}) as Record<string, unknown>;
  const v = features[key];
  return typeof v === "number" ? v : fallback;
}
```

Conteo de uso del mes (cuenta intentos no fallidos para evitar abuso):

```ts
async function rendersUsedThisMonth(supabase, orgId: string): Promise<number> {
  const monthStart = new Date();
  monthStart.setDate(1); monthStart.setHours(0,0,0,0);
  const { count } = await supabase
    .from("media_assets")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .neq("status", "failed")
    .gte("created_at", monthStart.toISOString());
  return count ?? 0;
}
```

---

## 5. Server actions — `src/lib/actions/media.ts`

```ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/get-org";
import { orgHasFeature, orgFeatureNumber } from "@/lib/features";

const FORMATS = ["reel", "post", "story"] as const;
const MAX_PHOTOS = 5;
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const TEMPLATE_BY_FORMAT: Record<(typeof FORMATS)[number], string | undefined> = {
  reel:  process.env.CREATOMATE_TEMPLATE_REEL,
  post:  process.env.CREATOMATE_TEMPLATE_POST,
  story: process.env.CREATOMATE_TEMPLATE_STORY,
};

export interface CreateRenderResult { error: string | null; assetId?: string }

export async function createMediaRender(formData: FormData): Promise<CreateRenderResult> {
  const { organization, userId } = await getOrgContext();

  if (!(await orgHasFeature(organization.id, "ai_features")))
    return { error: "Tu plan no incluye marketing con IA. Mejora al plan Premium." };

  const format = FORMATS.find((f) => f === formData.get("format")) ?? "reel";
  const templateId = TEMPLATE_BY_FORMAT[format];
  if (!templateId || !process.env.CREATOMATE_API_KEY)
    return { error: "Generador de video no configurado en el servidor." };

  const caption = String(formData.get("caption") ?? "").slice(0, 2200);
  const photos = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (photos.length === 0) return { error: "Sube al menos una foto." };
  if (photos.length > MAX_PHOTOS) return { error: `Máximo ${MAX_PHOTOS} fotos.` };
  for (const p of photos) {
    if (p.size > MAX_PHOTO_BYTES) return { error: "Cada foto debe pesar menos de 8 MB." };
    if (!/^image\/(png|jpe?g|webp)$/.test(p.type)) return { error: "Solo imágenes JPG/PNG/WebP." };
  }

  // Cuota
  const supabase = await createClient();
  const limit = await orgFeatureNumber(organization.id, "marketing_renders_monthly", 0);
  const used = await rendersUsedThisMonth(supabase, organization.id);
  if (used >= limit)
    return { error: `Alcanzaste el límite de ${limit} videos este mes.` };

  // Crea fila primero para tener asset_id en el path
  const { data: asset, error: insErr } = await supabase
    .from("media_assets")
    .insert({ organization_id: organization.id, created_by: userId,
              format, caption, template_id: templateId, status: "pending" })
    .select("id").single();
  if (insErr || !asset) return { error: "No se pudo iniciar la generación." };

  // Sube fotos + firma URLs
  const sourcePaths: string[] = [];
  const signedUrls: string[] = [];
  for (let i = 0; i < photos.length; i++) {
    const ext = photos[i].name.split(".").pop() || "jpg";
    const path = `${organization.id}/${asset.id}/${i}.${ext}`;
    const up = await supabase.storage.from("marketing-uploads")
      .upload(path, photos[i], { contentType: photos[i].type, upsert: true });
    if (up.error) { await failAsset(supabase, asset.id, "upload"); return { error: "No se pudieron subir las fotos." }; }
    const { data: signed } = await supabase.storage.from("marketing-uploads")
      .createSignedUrl(path, 3600);
    if (!signed?.signedUrl) { await failAsset(supabase, asset.id, "sign"); return { error: "Error preparando las fotos." }; }
    sourcePaths.push(path);
    signedUrls.push(signed.signedUrl);
  }

  // Dispara Creatomate
  try {
    const res = await fetch("https://api.creatomate.com/v1/renders", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.CREATOMATE_API_KEY}`,
                 "Content-Type": "application/json" },
      body: JSON.stringify({
        template_id: templateId,
        modifications: buildModifications(signedUrls, caption),
        webhook_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/creatomate?token=${process.env.CREATOMATE_WEBHOOK_SECRET}`,
      }),
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    const renders = (await res.json()) as { id: string }[];
    const renderId = renders[0]?.id;
    if (!renderId) throw new Error("sin render id");

    await supabase.from("media_assets")
      .update({ status: "rendering", render_id: renderId, source_paths: sourcePaths })
      .eq("id", asset.id);
    return { error: null, assetId: asset.id };
  } catch (e) {
    console.error("[createMediaRender]", e);
    await failAsset(supabase, asset.id, "render");
    return { error: "No se pudo generar el video. Intenta de nuevo." };
  }
}

// Mapea fotos/caption a los nombres de elementos de TU plantilla Creatomate.
function buildModifications(urls: string[], caption: string): Record<string, string> {
  const mods: Record<string, string> = { "Caption": caption };
  urls.forEach((u, i) => { mods[`Photo-${i + 1}`] = u; });
  return mods;
}

async function failAsset(supabase, id: string, reason: string) {
  await supabase.from("media_assets").update({ status: "failed", error: reason }).eq("id", id);
}

async function rendersUsedThisMonth(supabase, orgId: string): Promise<number> { /* ver §4 */ }

export interface MediaAssetView {
  id: string; status: string; format: string; caption: string | null;
  videoUrl: string | null; error: string | null;
}

export async function getMediaAsset(id: string): Promise<MediaAssetView | null> {
  const { organization } = await getOrgContext();
  const supabase = await createClient();
  const { data } = await supabase.from("media_assets")
    .select("*").eq("id", id).eq("organization_id", organization.id).maybeSingle();
  if (!data) return null;

  let videoUrl: string | null = null;
  if (data.status === "ready" && data.output_path) {
    const { data: s } = await supabase.storage.from("marketing-media")
      .createSignedUrl(data.output_path, 3600);
    videoUrl = s?.signedUrl ?? null;
  }
  return { id: data.id, status: data.status, format: data.format,
           caption: data.caption, videoUrl, error: data.error };
}
```

> `buildModifications` depende de cómo nombres los elementos en tu plantilla
> Creatomate (ej. `Photo-1`, `Photo-2`, `Caption`). Define los nombres en el editor
> de Creatomate y ajusta esta función.

---

## 6. Webhook — `src/app/api/webhooks/creatomate/route.ts`

Necesita escribir sin sesión → cliente service role.

```ts
// src/lib/supabase/admin.ts
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
```

```ts
// route.ts
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

export async function POST(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("token") !== process.env.CREATOMATE_WEBHOOK_SECRET)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    id: string; status: string; url?: string; output_format?: string;
  };
  const supabase = createAdminClient();

  const { data: asset } = await supabase.from("media_assets")
    .select("id, organization_id").eq("render_id", body.id).maybeSingle();
  if (!asset) return NextResponse.json({ ok: true }); // idempotente / desconocido

  if (body.status === "succeeded" && body.url) {
    try {
      const mp4 = await fetch(body.url);
      const buf = Buffer.from(await mp4.arrayBuffer());
      const path = `${asset.organization_id}/${asset.id}.mp4`;
      const up = await supabase.storage.from("marketing-media")
        .upload(path, buf, { contentType: "video/mp4", upsert: true });
      if (up.error) throw up.error;
      await supabase.from("media_assets")
        .update({ status: "ready", output_path: path }).eq("id", asset.id);
    } catch (e) {
      console.error("[creatomate webhook]", e);
      await supabase.from("media_assets")
        .update({ status: "failed", error: "store" }).eq("id", asset.id);
    }
  } else if (body.status === "failed") {
    await supabase.from("media_assets")
      .update({ status: "failed", error: "render" }).eq("id", asset.id);
  }
  return NextResponse.json({ ok: true });
}
```

Webhook localhost: en dev usa un túnel (cloudflared / ngrok) y apunta
`NEXT_PUBLIC_APP_URL` al túnel, o haz polling al endpoint de Creatomate como fallback.

---

## 7. UI

`marketing-view.tsx` → 2 pestañas: **Texto** (lo actual) | **Reel / Imagen** (nuevo
`media-studio.tsx`).

`media-studio.tsx` (cliente):
- `<input type="file" multiple accept="image/*">` (1-5 fotos, preview en grid).
- Select de formato (reel/post/estado).
- `<Textarea>` caption — botón "Usar caption de IA" que jala de `generateSocialPosts`.
- Botón "Generar video" → `createMediaRender(formData)` → guarda `assetId`.
- Polling: `setInterval` 3s llamando `getMediaAsset(assetId)` hasta `ready`/`failed`
  (corta a los ~90s con mensaje de timeout).
- Resultado: `<video controls src={videoUrl}>` + **Descargar** + **Compartir**.

Compartir (Web Share API con archivo — móvil manda el MP4 a IG/WhatsApp/TikTok):

```ts
async function share(videoUrl: string, caption: string) {
  const blob = await (await fetch(videoUrl)).blob();
  const file = new File([blob], "reel.mp4", { type: "video/mp4" });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], text: caption });
  } else {
    const a = document.createElement("a");
    a.href = videoUrl; a.download = "reel.mp4"; a.click(); // desktop = descarga
  }
}
```

---

## 8. Capacidad a 10k usuarios (Fase 0)

- DB/Auth/Storage: Supabase Pro lo soporta. `media_assets` indexada por org+fecha.
- Render fuera de tu servidor (Creatomate) → tu app solo dispara/recibe → escala plano.
- **Cuello = costo, no técnica:** ~$0.30/video. Limita con `marketing_renders_monthly`
  por plan (free 2, premium 20).
- Egress de los MP4 al descargar: Supabase Storage ahora; **migrar a Cloudflare R2**
  (egress gratis) cuando el volumen de descargas crezca. Punto de cambio, no bloquea.

---

## 9. Checklist de implementación

1. [ ] Cuenta Creatomate + 3 plantillas (reel/post/estado), anotar element names.
2. [ ] Migración SQL (§3) + buckets + policies. Regenerar `database.types.ts`.
3. [ ] Env vars (§2) en `.env.local` y en el hosting.
4. [ ] `src/lib/supabase/admin.ts` (service role).
5. [ ] `orgFeatureNumber` en `features.ts` + clave en `plans.features`.
6. [ ] `src/lib/actions/media.ts`.
7. [ ] `src/app/api/webhooks/creatomate/route.ts`.
8. [ ] `media-studio.tsx` + pestañas en `marketing-view.tsx`.
9. [ ] Probar con túnel para el webhook en dev.
```
