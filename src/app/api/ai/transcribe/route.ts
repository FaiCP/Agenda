import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  aiConfigured,
  transcribeAudio,
  structureEntry,
  type DictationMode,
  type FieldSpec,
} from "@/lib/ai";
import { orgHasFeature } from "@/lib/features";
import { VERTICALS } from "@/lib/verticals";

export const maxDuration = 120;

// Límite de Groq Whisper (free tier): 25 MB. A 32 kbps webm ≈ 14 MB/hora,
// alcanza para consultas de ~1.5 horas.
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id, organizations(vertical)")
    .eq("profile_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!membership?.organizations)
    return NextResponse.json({ error: "Sin organización." }, { status: 403 });

  if (!(await orgHasFeature(membership.organization_id, "ai_features")))
    return NextResponse.json(
      { error: "Tu plan no incluye funciones de IA. Mejora al plan Premium." },
      { status: 403 }
    );

  if (!aiConfigured())
    return NextResponse.json(
      { error: "IA no configurada en el servidor (falta GROQ_API_KEY)." },
      { status: 503 }
    );

  const form = await req.formData();
  const audio = form.get("audio");
  const templateId = String(form.get("template_id") ?? "");
  const mode: DictationMode =
    form.get("mode") === "consulta" ? "consulta" : "dictado";

  if (!(audio instanceof File) || audio.size === 0)
    return NextResponse.json({ error: "Audio vacío." }, { status: 400 });
  if (audio.size > MAX_AUDIO_BYTES)
    return NextResponse.json(
      { error: "El audio supera el límite (~1.5 horas de grabación)." },
      { status: 400 }
    );

  let fields: FieldSpec[] = [];
  if (templateId) {
    const { data } = await supabase
      .from("record_template_fields")
      .select("field_key, label, field_type, options, sort_order")
      .eq("template_id", templateId)
      .order("sort_order");
    fields = (data ?? []).map((f) => ({
      key: f.field_key,
      label: f.label,
      type: f.field_type,
      choices:
        (f.options as { choices?: string[] } | null)?.choices ?? undefined,
    }));
  }

  try {
    const transcript = await transcribeAudio(audio);
    if (!transcript)
      return NextResponse.json(
        { error: "No se entendió el audio. Intenta de nuevo." },
        { status: 422 }
      );

    const vertical = membership.organizations.vertical;
    const config = VERTICALS[vertical];
    const draft = await structureEntry(
      transcript,
      fields,
      {
        verticalLabel: config.label,
        recordLabel: config.recordLabel,
      },
      mode
    );

    return NextResponse.json({ transcript, draft });
  } catch (e) {
    console.error("[api/ai/transcribe]", e);
    return NextResponse.json(
      { error: "No se pudo procesar el audio. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
