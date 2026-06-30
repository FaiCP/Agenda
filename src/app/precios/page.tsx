import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Precios" };

const PLAN_FEATURES: Record<string, string[]> = {
  free: [
    "1 profesional",
    "Hasta 20 citas al mes",
    "Página pública de reservas",
  ],
  inicial: [
    "1 profesional",
    "Bot de WhatsApp: recepcionista que agenda sola",
    "Página pública de reservas",
    "Marketing IA: ideas de contenido (10/mes)",
  ],
  pro: [
    "Hasta 3 profesionales",
    "Bot de WhatsApp",
    "Citas ilimitadas",
    "Recordatorios por correo",
    "Marketing IA: guiones, calendario y reutilizar (50/mes)",
  ],
  premium: [
    "Hasta 10 profesionales",
    "Todo lo de Pro",
    "Marketing IA: campañas desde tu agenda (200/mes)",
    "IA clínica: dictado, documentos y riesgo",
  ],
};

export default async function PreciosPage() {
  const supabase = await createClient();
  const { data: plans } = await supabase
    .from("plans")
    .select("*")
    .eq("active", true)
    .order("price_monthly");

  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <CalendarDays className="h-5 w-5 text-primary" />
            AgendaPro
          </Link>
          <Button asChild>
            <Link href="/registro">Crear cuenta gratis</Link>
          </Button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-16">
        <h1 className="text-center text-3xl font-bold">
          Planes simples, en dólares
        </h1>
        <p className="mt-2 text-center text-muted-foreground">
          Empieza con 1 mes de prueba Premium gratis. Paga por transferencia
          bancaria. Sin contratos ni sorpresas.
        </p>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {(plans ?? []).map((plan) => (
            <Card
              key={plan.id}
              className={plan.code === "pro" ? "border-primary shadow-md" : ""}
            >
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription>
                  <span className="text-3xl font-bold text-foreground">
                    ${Number(plan.price_monthly).toFixed(0)}
                  </span>{" "}
                  / mes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="space-y-2 text-sm">
                  {(PLAN_FEATURES[plan.code] ?? []).map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" /> {f}
                    </li>
                  ))}
                </ul>
                <Button className="w-full" asChild>
                  <Link href="/registro">
                    {plan.code === "free" ? "Comenzar gratis" : "Elegir plan"}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
