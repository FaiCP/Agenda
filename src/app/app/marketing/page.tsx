import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { getOrgContext } from "@/lib/get-org";
import { orgHasFeature } from "@/lib/features";
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
  const aiEnabled = await orgHasFeature(organization.id, "ai_features");

  if (!aiEnabled) {
    return (
      <div className="mx-auto max-w-lg pt-12">
        <Card>
          <CardHeader className="text-center">
            <Sparkles className="mx-auto h-8 w-8 text-primary" />
            <CardTitle>Contenido para redes sociales</CardTitle>
            <CardDescription>
              Genera publicaciones listas para Instagram, Facebook, TikTok y
              WhatsApp basadas en tus servicios. Disponible en el plan Premium.
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

  return <MarketingView />;
}
