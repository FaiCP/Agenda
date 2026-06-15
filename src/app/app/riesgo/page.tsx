import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Sparkles, Info, MessageCircle, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/get-org";
import { orgHasFeature } from "@/lib/features";
import { rankClientRisks } from "@/lib/churn";
import { formatDateShort } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function lastVisitLabel(daysSince: number) {
  const ms = Date.now() - daysSince * 24 * 60 * 60 * 1000;
  return formatDateShort(new Date(ms).toISOString());
}

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
  const medios = risks.length - altos;
  const labelCap =
    organization.client_label.charAt(0).toUpperCase() +
    organization.client_label.slice(1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Riesgo de abandono
        </h1>
        <p className="text-muted-foreground">
          Mantén a tus {organization.client_label}s comprometidos con
          recordatorios oportunos.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-[280px_1fr]">
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-lg bg-red-50 text-red-600">
                <AlertTriangle className="size-5" />
              </span>
              <p className="font-heading text-lg font-semibold">Resumen</p>
            </div>
            <div className="space-y-1">
              <ResumenRow
                label={`${labelCap}s en riesgo`}
                value={risks.length}
              />
              <ResumenRow label="Riesgo alto" value={altos} dot="bg-red-500" />
              <ResumenRow
                label="Riesgo medio"
                value={medios}
                dot="bg-amber-500"
              />
            </div>
          </CardContent>
        </Card>

        <div className="rounded-xl border border-primary/20 bg-accent p-5">
          <div className="flex items-center gap-2 text-accent-foreground">
            <Info className="size-4" />
            <p className="font-heading text-sm font-semibold uppercase tracking-wide">
              Metodología de riesgo
            </p>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            El score se calcula con un modelo basado en inasistencias,
            cancelaciones y el tiempo transcurrido desde la última visita en
            relación a la frecuencia habitual de cada {organization.client_label}.
            No usa datos externos: las reglas son explicables.
          </p>
        </div>
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
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {labelCap}s por contactar
            </CardTitle>
            <CardDescription>
              Score calculado con inasistencias, cancelaciones y tiempo sin
              volver respecto a su frecuencia habitual de visita.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Nombre
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Riesgo
                  </TableHead>
                  <TableHead className="hidden text-xs font-medium uppercase tracking-wide text-muted-foreground md:table-cell">
                    Motivos y acción sugerida
                  </TableHead>
                  <TableHead className="text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Contacto
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {risks.map((r) => (
                  <TableRow key={r.clientId}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback className="bg-accent text-xs font-medium text-accent-foreground">
                            {initials(r.fullName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <Link
                            href={`/app/clientes/${r.clientId}`}
                            className="font-medium hover:underline"
                          >
                            {r.fullName}
                          </Link>
                          {r.daysSinceLastVisit !== null && (
                            <p className="text-xs text-muted-foreground">
                              Última visita: {lastVisitLabel(r.daysSinceLastVisit)}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold " +
                          (r.level === "alto"
                            ? "bg-red-50 text-red-700"
                            : "bg-amber-50 text-amber-700")
                        }
                      >
                        {r.level === "alto" ? "Alto" : "Medio"} · {r.score}
                      </span>
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
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end gap-1">
                        {r.phone && (
                          <Button
                            size="sm"
                            asChild
                            className="border-transparent bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          >
                            <a
                              href={`https://wa.me/${r.phone.replace(/\D/g, "")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <MessageCircle className="mr-1 size-3.5" />
                              WhatsApp
                            </a>
                          </Button>
                        )}
                        {r.email && (
                          <a
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:underline"
                            href={`mailto:${r.email}`}
                          >
                            <Mail className="size-3" />
                            {r.email}
                          </a>
                        )}
                        {!r.phone && !r.email && (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
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

function ResumenRow({
  label,
  value,
  dot,
}: {
  label: string;
  value: number;
  dot?: string;
}) {
  return (
    <div className="flex items-center justify-between border-b py-2 last:border-0">
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        {dot && <span className={`size-2 rounded-full ${dot}`} />}
        {label}
      </span>
      <span className="font-heading text-lg font-semibold">{value}</span>
    </div>
  );
}
