import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/get-org";
import { orgHasFeature } from "@/lib/features";
import { rankClientRisks } from "@/lib/churn";
import { formatDateShort } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata: Metadata = { title: "Riesgo de abandono" };

export default async function RiesgoPage() {
  const { organization } = await getOrgContext();

  const aiEnabled = await orgHasFeature(organization.id, "ai_features");
  if (!aiEnabled) {
    return (
      <div className="mx-auto max-w-lg pt-12">
        <Card>
          <CardHeader className="text-center">
            <Sparkles className="mx-auto h-8 w-8 text-primary" />
            <CardTitle>Predicción de abandono</CardTitle>
            <CardDescription>
              Detecta {organization.client_label}s en riesgo de no volver y
              recibe sugerencias para recuperarlos. Disponible en el plan
              Premium.
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

  const supabase = await createClient();
  const { data: stats } = await supabase.rpc("client_risk_stats", {
    p_organization_id: organization.id,
  });

  const risks = rankClientRisks(
    (stats ?? []).map((s) => ({
      ...s,
      completed: Number(s.completed),
      no_shows: Number(s.no_shows),
      cancelled: Number(s.cancelled),
    })),
    organization.client_label
  );

  const altos = risks.filter((r) => r.level === "alto").length;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Riesgo de abandono</h1>
        <p className="text-muted-foreground">
          {risks.length === 0
            ? `Ningún ${organization.client_label} en riesgo detectado.`
            : `${risks.length} ${organization.client_label}s en riesgo · ${altos} con riesgo alto`}
        </p>
      </div>

      {risks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Todo en orden: no se detectan {organization.client_label}s en
            riesgo de abandono. El análisis usa el historial de citas
            (inasistencias, cancelaciones y tiempo sin volver).
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {organization.client_label.charAt(0).toUpperCase() +
                organization.client_label.slice(1)}
              s por contactar
            </CardTitle>
            <CardDescription>
              Score calculado con inasistencias, cancelaciones y tiempo sin
              volver respecto a su frecuencia habitual de visita.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Riesgo</TableHead>
                  <TableHead className="hidden md:table-cell">
                    Motivos y acción sugerida
                  </TableHead>
                  <TableHead className="text-right">Contacto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {risks.map((r) => (
                  <TableRow key={r.clientId}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/app/clientes/${r.clientId}`}
                        className="hover:underline"
                      >
                        {r.fullName}
                      </Link>
                      {r.daysSinceLastVisit !== null && (
                        <p className="text-xs text-muted-foreground">
                          Última visita:{" "}
                          {formatDateShort(
                            new Date(
                              Date.now() -
                                r.daysSinceLastVisit * 24 * 60 * 60 * 1000
                            ).toISOString()
                          )}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          r.level === "alto" ? "destructive" : "secondary"
                        }
                      >
                        {r.level === "alto" ? "Alto" : "Medio"} · {r.score}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden max-w-md whitespace-normal md:table-cell">
                      <ul className="list-disc pl-4 text-xs text-muted-foreground">
                        {r.reasons.map((reason) => (
                          <li key={reason}>{reason}</li>
                        ))}
                      </ul>
                      {r.suggestion && (
                        <p className="mt-1 text-xs font-medium">
                          → {r.suggestion}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {r.phone && (
                        <a
                          className="block hover:underline"
                          href={`https://wa.me/${r.phone.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          WhatsApp
                        </a>
                      )}
                      {r.email && (
                        <a
                          className="block hover:underline"
                          href={`mailto:${r.email}`}
                        >
                          {r.email}
                        </a>
                      )}
                      {!r.phone && !r.email && "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
