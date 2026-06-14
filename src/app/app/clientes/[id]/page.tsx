import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/get-org";
import { orgHasFeature } from "@/lib/features";
import { DOCUMENT_TYPES } from "@/lib/document-types";
import { VERTICALS } from "@/lib/verticals";
import { ExpedienteView } from "./expediente-view";

export const metadata: Metadata = { title: "Expediente" };

export default async function ClienteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { organization, profile } = await getOrgContext();
  const supabase = await createClient();

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .eq("organization_id", organization.id)
    .single();
  if (!client) notFound();

  const [record, templates, appointments, aiEnabled] = await Promise.all([
    supabase
      .from("records")
      .select("id, template_id")
      .eq("client_id", id)
      .maybeSingle(),
    supabase
      .from("record_templates")
      .select("id, name, vertical, record_template_fields(*)")
      .or(`organization_id.is.null,organization_id.eq.${organization.id}`)
      .eq("vertical", organization.vertical),
    supabase
      .from("appointments")
      .select("id, starts_at, status, services(name), profiles:professional_id(full_name)")
      .eq("client_id", id)
      .order("starts_at", { ascending: false })
      .limit(20),
    orgHasFeature(organization.id, "ai_features"),
  ]);

  const entries = record.data
    ? (
        await supabase
          .from("record_entries")
          .select("*, profiles:author_id(full_name)")
          .eq("record_id", record.data.id)
          .order("created_at", { ascending: false })
      ).data
    : [];

  return (
    <ExpedienteView
      client={client}
      clientLabel={organization.client_label}
      recordLabel={VERTICALS[organization.vertical].recordLabel}
      templates={templates.data ?? []}
      entries={entries ?? []}
      appointments={appointments.data ?? []}
      aiEnabled={aiEnabled}
      orgName={organization.name}
      professionalName={profile.full_name}
      documentTypes={DOCUMENT_TYPES[organization.vertical]}
    />
  );
}
