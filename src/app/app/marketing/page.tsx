import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { getOrgContext } from "@/lib/get-org";
import { orgMarketingCaps } from "@/lib/features";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MarketingView } from "./marketing-view";

export const metadata: Metadata = { title: "Marketing" };

export default async function MarketingPage() {
  const { organization } = await getOrgContext();
  const caps = await orgMarketingCaps(organization.id);

  // Sin ninguna capacidad de marketing (no debería pasar: hasta Gratis trae
  // Ideas), mostramos el upsell.
  if (!caps.ideas && !caps.create && !caps.agenda) {
    return (
      <div className="mx-auto max-w-lg pt-12">
        <Card>
          <CardHeader className="text-center">
            <Sparkles className="mx-auto h-8 w-8 text-primary" />
            <CardTitle>Agente de Marketing</CardTitle>
            <CardDescription>
              Genera ideas, guiones y campañas para tus redes sociales.
              Disponible desde el plan Gratis.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button asChild>
              <Link href="/app/facturacion">Ver planes</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <MarketingView caps={caps} />;
}
