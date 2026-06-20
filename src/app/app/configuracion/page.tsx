import type { Metadata } from "next";
import { getOrgContext } from "@/lib/get-org";
import { getWhatsappConnection } from "@/lib/actions/whatsapp";
import { whatsappConfigured } from "@/lib/whatsapp/client";
import { ConfiguracionView } from "./configuracion-view";

export const metadata: Metadata = { title: "Configuración" };

type WaStatus = "connected" | "connecting" | "disconnected" | "failed";

export default async function ConfiguracionPage() {
  const { organization, role } = await getOrgContext();
  const connection = await getWhatsappConnection();

  return (
    <ConfiguracionView
      organization={organization}
      isOwner={role === "owner"}
      whatsapp={{
        status: (connection?.status as WaStatus) ?? "disconnected",
        phone: connection?.phone ?? null,
        configured: whatsappConfigured(),
      }}
    />
  );
}
