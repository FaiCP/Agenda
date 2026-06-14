import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/get-org";
import { ClientesView } from "./clientes-view";

export const metadata: Metadata = { title: "Clientes" };

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { organization } = await getOrgContext();
  const supabase = await createClient();
  const { q } = await searchParams;

  let query = supabase
    .from("clients")
    .select("*")
    .eq("organization_id", organization.id)
    .order("full_name")
    .limit(200);

  if (q && q.trim()) {
    query = query.or(
      `full_name.ilike.%${q.trim()}%,email.ilike.%${q.trim()}%,document_id.ilike.%${q.trim()}%`
    );
  }

  const { data: clients } = await query;

  return (
    <ClientesView
      clients={clients ?? []}
      clientLabel={organization.client_label}
      q={q ?? ""}
    />
  );
}
