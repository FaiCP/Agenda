// Helpers de IA (Fase 2).
// Transcripción de voz: Groq Whisper (GROQ_API_KEY, gratis en console.groq.com).
// Estructuración de notas: Claude API si hay ANTHROPIC_API_KEY; si no, Groq.

const GROQ_BASE = "https://api.groq.com/openai/v1";

export function aiConfigured(): boolean {
  return Boolean(process.env.GROQ_API_KEY);
}

export async function transcribeAudio(file: File): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY no configurada");

  const form = new FormData();
  form.append("file", file, file.name || "audio.webm");
  form.append("model", "whisper-large-v3-turbo");
  form.append("language", "es");
  form.append("temperature", "0");

  const res = await fetch(`${GROQ_BASE}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!res.ok)
    throw new Error(`Transcripción falló (${res.status}): ${await res.text()}`);

  const json = (await res.json()) as { text?: string };
  return (json.text ?? "").trim();
}

export interface FieldSpec {
  key: string;
  label: string;
  type: string;
  choices?: string[];
}

export interface EntryDraft {
  title: string;
  fields: Record<string, string>;
  notes: string;
}

export type DictationMode = "dictado" | "consulta";

export async function structureEntry(
  transcript: string,
  fields: FieldSpec[],
  context: { verticalLabel: string; recordLabel: string },
  mode: DictationMode = "dictado"
): Promise<EntryDraft> {
  const fieldLines = fields
    .map((f) => {
      let line = `- "${f.key}" (${f.label}, tipo ${f.type})`;
      if (f.choices?.length)
        line += ` — opciones válidas: ${f.choices.map((c) => `"${c}"`).join(", ")}`;
      return line;
    })
    .join("\n");

  const sourceDescription =
    mode === "consulta"
      ? `la transcripción de una CONSULTA COMPLETA: una conversación entre el profesional (${context.verticalLabel}) y su paciente/cliente`
      : `una nota dictada por un profesional (${context.verticalLabel})`;

  const notesRule =
    mode === "consulta"
      ? `- "notes": resumen estructurado de la consulta en este orden: (1) Resumen breve de lo tratado; (2) Relato del paciente/cliente — incluye las descripciones importantes con sus palabras textuales entre comillas; (3) Observaciones del profesional; (4) Plan / acuerdos / próximos pasos. Omite saludos y conversación trivial.`
      : `- "notes": información clínica/profesional relevante de la transcripción que no encaje en ningún campo; "" si no hay.`;

  const system = `Eres un asistente que estructura ${sourceDescription} en los campos de un ${context.recordLabel}.

Responde SOLO con un objeto JSON válido, sin texto adicional ni bloques de código, con esta forma exacta:
{"title": string, "fields": {<clave>: string}, "notes": string}

Reglas:
- Usa únicamente información presente en la transcripción; nunca inventes datos.
- "title": título breve y descriptivo de la entrada (máx. 60 caracteres).
- "fields": solo claves de la lista dada. Si la transcripción no menciona un campo, omítelo.
- Campos tipo select: usa exactamente una de las opciones válidas.
- Campos tipo boolean: usa "Sí" o "No".
- Campos tipo date: formato YYYY-MM-DD.
- Campos tipo number: solo el número, sin unidades.
${notesRule}
- Corrige puntuación y muletillas, pero conserva la terminología del profesional.`;

  const user = `Campos disponibles:\n${fieldLines || "(sin plantilla: deja \"fields\" vacío y pon todo en \"notes\")"}\n\nTranscripción:\n"""\n${transcript}\n"""`;

  const raw = await aiChat(system, user, { json: true });
  return parseDraft(raw);
}

/** Chat genérico: Claude si hay ANTHROPIC_API_KEY, si no Groq. */
export async function aiChat(
  system: string,
  user: string,
  options: { json?: boolean } = {}
): Promise<string> {
  return process.env.ANTHROPIC_API_KEY
    ? callClaude(system, user)
    : callGroqChat(system, user, options.json ?? false);
}

export interface DocumentContext {
  docLabel: string;
  docHint: string;
  verticalLabel: string;
  orgName: string;
  professionalName: string;
  clientSummary: string;
  entriesSummary: string;
  instructions: string;
  date: string;
}

export async function generateDocumentText(
  ctx: DocumentContext
): Promise<string> {
  const system = `Redactas documentos profesionales en español para un profesional de "${ctx.verticalLabel}" en Ecuador.

Genera ÚNICAMENTE el cuerpo del documento solicitado, en texto plano (sin markdown, sin asteriscos, sin numerales). El encabezado con el nombre del consultorio, la fecha y la línea de firma se agregan aparte: NO los incluyas.

Reglas:
- Usa solo los datos proporcionados; si falta un dato necesario, deja un espacio así: [__________].
- Nunca inventes datos clínicos, legales ni personales.
- Lenguaje formal y apropiado al tipo de documento y a la normativa ecuatoriana cuando aplique.
- Estructura con párrafos y, si corresponde, listas con guiones simples.
- Extensión adecuada al tipo de documento: conciso pero completo.`;

  const user = `Tipo de documento: ${ctx.docLabel}
Guía del documento: ${ctx.docHint}
Fecha: ${ctx.date}
Profesional: ${ctx.professionalName} — ${ctx.orgName}

Datos del cliente/paciente:
${ctx.clientSummary}

Información reciente del expediente:
${ctx.entriesSummary || "(sin entradas)"}

Indicaciones adicionales del profesional:
${ctx.instructions || "(ninguna)"}

Redacta el documento.`;

  return (await aiChat(system, user)).trim();
}

async function callClaude(system: string, user: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok)
    throw new Error(`Claude API falló (${res.status}): ${await res.text()}`);
  const json = (await res.json()) as { content: { type: string; text?: string }[] };
  return json.content.find((b) => b.type === "text")?.text ?? "";
}

async function callGroqChat(
  system: string,
  user: string,
  json = true
): Promise<string> {
  const res = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      temperature: 0,
      ...(json ? { response_format: { type: "json_object" } } : {}),
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok)
    throw new Error(`Groq chat falló (${res.status}): ${await res.text()}`);
  const data = (await res.json()) as {
    choices: { message: { content: string } }[];
  };
  return data.choices[0]?.message?.content ?? "";
}

function parseDraft(raw: string): EntryDraft {
  // Tolera bloques ```json ... ``` y texto alrededor del objeto.
  const cleaned = raw.replace(/```(?:json)?/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Respuesta IA sin JSON");

  const parsed = JSON.parse(cleaned.slice(start, end + 1)) as {
    title?: unknown;
    fields?: Record<string, unknown>;
    notes?: unknown;
  };

  const fields: Record<string, string> = {};
  for (const [k, v] of Object.entries(parsed.fields ?? {})) {
    if (v !== null && v !== undefined && String(v).trim() !== "")
      fields[k] = String(v);
  }

  return {
    title: typeof parsed.title === "string" ? parsed.title.slice(0, 80) : "",
    fields,
    notes: typeof parsed.notes === "string" ? parsed.notes : "",
  };
}
