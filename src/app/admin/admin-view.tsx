"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";
import { reviewPayment } from "@/lib/actions/admin";
import type { Tables } from "@/lib/supabase/database.types";
import { formatDateShort } from "@/lib/dates";
import { VERTICALS } from "@/lib/verticals";
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

type Organization = Tables<"organizations"> & {
  subscriptions: { status: string; plans: { name: string } | null }[];
};

type PendingPayment = Tables<"payments"> & {
  organizations: { name: string } | null;
  plans: { name: string } | null;
  receiptUrl: string | null;
};

export function AdminView({
  organizations,
  pendingPayments,
}: {
  organizations: Organization[];
  pendingPayments: PendingPayment[];
}) {
  const [busy, setBusy] = useState<string | null>(null);

  async function review(id: string, decision: "approved" | "rejected") {
    setBusy(id);
    const result = await reviewPayment(id, decision);
    setBusy(null);
    if (result.error) toast.error(result.error);
    else
      toast.success(
        decision === "approved" ? "Pago aprobado y plan activado" : "Pago rechazado"
      );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Administración del SaaS</h1>
        <p className="text-muted-foreground">
          {organizations.length} organizaciones · {pendingPayments.length} pagos
          por revisar
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pagos por verificar</CardTitle>
          <CardDescription>
            Comprueba la transferencia y aprueba para activar el plan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendingPayments.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">
              No hay pagos pendientes.
            </p>
          ) : (
            <div className="space-y-3">
              {pendingPayments.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
                >
                  <div>
                    <p className="font-medium">
                      {p.organizations?.name ?? "Organización"} — Plan{" "}
                      {p.plans?.name ?? ""}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      ${Number(p.amount).toFixed(2)} ·{" "}
                      {formatDateShort(p.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.receiptUrl && (
                      <Button variant="outline" size="sm" asChild>
                        <a
                          href={p.receiptUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="mr-1 h-4 w-4" />
                          Comprobante
                        </a>
                      </Button>
                    )}
                    <Button
                      size="sm"
                      disabled={busy === p.id}
                      onClick={() => review(p.id, "approved")}
                    >
                      Aprobar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={busy === p.id}
                      onClick={() => review(p.id, "rejected")}
                    >
                      Rechazar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Organizaciones</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Vertical</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Registro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {organizations.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">
                    {o.name}
                    <span className="ml-2 text-xs text-muted-foreground">
                      /{o.slug}
                    </span>
                  </TableCell>
                  <TableCell>
                    {VERTICALS[o.vertical]?.icon} {VERTICALS[o.vertical]?.label}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {o.subscriptions[0]?.plans?.name ?? "Sin plan"}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDateShort(o.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
