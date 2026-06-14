"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/get-org";
import { orgHasFeature } from "@/lib/features";
import { aiConfigured, generateDocumentText } from "@/lib/ai";
import { DOCUMENT_TYPES } from "@/lib/document-types";
import { VERTICALS } from "@/lib/verticals";

export interface DocumentResult {
  error: string | null;
  title?: string;
  body?: string;
}

export async function generateDocument(input: {
  clientId: string;
  docTypeKey: string;
  instructions: string;
}): Promise<DocumentResult> {
  const { organization, profile } = await getOrgContext();

  if (!(await orgHasFeature(organization.id, "ai_features")))
    return { error: "Tu plan no incluye funciones de IA. Mejora al plan Premium." };
  if (!aiConfigured())
    return { error: "IA no configurada en el servidor (falta GROQ_API_KEY)." };

  const docType = DOCUMENT_TYPES[organization.vertical].find(
    (d) => d.key === input.docTypeKey
  );
  if (!docType) return { error: "Tipo de documento no válido." };

  const supabase = await createClient();
  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", input.clientId)
    .eq("organization_id", organization.id)
    .single();
  if (!client) return { error: "Cliente no encontrado." };

  // Últimas entradas del expediente como contexto
  const { data: record } = await supabase
    .from("records")
    .select("id")
    .eq("client_id", input.clientId)
    .eq("organization_id", organization.id)
    .maybeSingle();

  let entriesSummary = "";
  if (record) {
    const { data: entries } = await supabase
      .from("record_entries")
      .select("title, data, notes, created_at")
      .eq("record_id", record.id)
      .order("created_at", { ascending: false })
      .limit(3);
    entriesSummary = (entries ?? [])
      .map((e) => {
        const fields = Object.entries(
          (e.data as Record<string, string>) ?? {}
        )
          .map(([k, v]) => `${k.replaceAll("_", " ")}: ${v}`)
          .join("; ");
        return [
          `[${e.created_at.slice(0, 10)}] ${e.title ?? "Entrada"}`,
          fields,
          e.notes ?? "",
        ]
          .filter(Boolean)
          .join(" — ");
      })
      .join("\n");
  }

  const clientSummary = [
    `Nombre: ${client.full_name}`,
    client.document_id ? `Cédula/documento: ${client.document_id}` : null,
    client.birth_date ? `Fecha de nacimiento: ${client.birth_date}` : null,
    client.phone ? `Teléfono: ${client.phone}` : null,
    client.email ? `Email: ${client.email}` : null,
    client.address ? `Dirección: ${client.address}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const date = new Date().toLocaleDateString("es-EC", {
    timeZone: "America/Guayaquil",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  try {
    const body = await generateDocumentText({
      docLabel: docType.label,
      docHint: docType.hint,
      verticalLabel: VERTICALS[organization.vertical].label,
      orgName: organization.name,
      professionalName: profile.full_name,
      clientSummary,
      entriesSummary,
      instructions: input.instructions.slice(0, 2000),
      date,
    });
    if (!body) return { error: "La IA no devolvió contenido. Intenta de nuevo." };
    return { error: null, title: docType.label, body };
  } catch (e) {
    console.error("[generateDocument]", e);
    return { error: "No se pudo generar el documento. Intenta de nuevo." };
  }
}
