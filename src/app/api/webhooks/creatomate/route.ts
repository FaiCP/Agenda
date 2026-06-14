import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Descargar el MP4 de Creatomate y subirlo a Storage puede tardar unos segundos.
export const maxDuration = 60;

interface CreatomateWebhook {
  id: string;
  status: string; // "succeeded" | "failed" | ...
  url?: string;
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("token") !== process.env.CREATOMATE_WEBHOOK_SECRET)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: CreatomateWebhook;
  try {
    body = (await req.json()) as CreatomateWebhook;
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (!body.id)
    return NextResponse.json({ error: "missing id" }, { status: 400 });

  const supabase = createAdminClient();

  const { data: asset } = await supabase
    .from("media_assets")
    .select("id, organization_id, status")
    .eq("render_id", body.id)
    .maybeSingle();

  // Desconocido o ya procesado: responde 200 para que Creatomate no reintente.
  if (!asset || asset.status === "ready" || asset.status === "failed")
    return NextResponse.json({ ok: true });

  if (body.status === "succeeded" && body.url) {
    try {
      const mp4 = await fetch(body.url);
      if (!mp4.ok) throw new Error(`fetch mp4 ${mp4.status}`);
      const buffer = Buffer.from(await mp4.arrayBuffer());
      const path = `${asset.organization_id}/${asset.id}.mp4`;

      const up = await supabase.storage
        .from("marketing-media")
        .upload(path, buffer, { contentType: "video/mp4", upsert: true });
      if (up.error) throw up.error;

      await supabase
        .from("media_assets")
        .update({ status: "ready", output_path: path })
        .eq("id", asset.id);
    } catch (e) {
      console.error("[creatomate webhook]", e);
      await supabase
        .from("media_assets")
        .update({ status: "failed", error: "store" })
        .eq("id", asset.id);
    }
  } else if (body.status === "failed") {
    await supabase
      .from("media_assets")
      .update({ status: "failed", error: "render" })
      .eq("id", asset.id);
  }

  return NextResponse.json({ ok: true });
}
