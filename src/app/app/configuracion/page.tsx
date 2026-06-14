import type { Metadata } from "next";
import { getOrgContext } from "@/lib/get-org";
import { ConfiguracionView } from "./configuracion-view";

export const metadata: Metadata = { title: "Configuración" };

export default async function ConfiguracionPage() {
  const { organization, role } = await getOrgContext();
  return (
    <ConfiguracionView organization={organization} isOwner={role === "owner"} />
  );
}
