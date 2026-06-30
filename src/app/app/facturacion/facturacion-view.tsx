"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { submitBankTransferPayment } from "@/lib/actions/billing";
import { BANK_TRANSFER_INSTRUCTIONS } from "@/lib/payments/gateway";
import type { ActionState } from "@/lib/actions/appointments";
import type { Tables } from "@/lib/supabase/database.types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateShort } from "@/lib/dates";

type Plan = Tables<"plans">;
type Subscription = (Tables<"subscriptions"> & { plans: Plan | null }) | null;
type Payment = Tables<"payments"> & { plans: { name: string } | null };

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending_review: "En revisión",
  approved: "Aprobado",
  rejected: "Rechazado",
};

const initialState: ActionState = { error: null };

function planFeatures(plan: Plan): string[] {
  const f = (plan.features ?? {}) as Record<string, unknown>;
  const list = [
    `${plan.max_professionals} ${plan.max_professionals === 1 ? "profesional" : "profesionales"}`,
    plan.max_appointments_per_month
      ? `${plan.max_appointments_per_month} citas / mes`
      : "Citas ilimitadas",
  ];
  if (f.public_booking) list.push("Reservas online");
  if (f.whatsapp_bot) list.push("Bot de WhatsApp (recepcionista que agenda)");
  if (f.email_reminders) list.push("Recordatorios por correo");

  // Marketing por niveles (acumulativo)
  if (f.mkt_agenda)
    list.push("Marketing IA: campañas desde tu agenda");
  if (f.mkt_create)
    list.push("Marketing IA: guiones, calendario y reutilizar");
  if (f.mkt_ideas) list.push("Marketing IA: ideas de contenido");
  if (typeof f.marketing_ai_monthly === "number")
    list.push(`${f.marketing_ai_monthly} generaciones IA / mes`);

  if (f.ai_features)
    list.push("IA clínica: dictado por voz, documentos y análisis de riesgo");
  return list;
}

export function FacturacionView({
  subscription,
  plans,
  payments,
  isOwner,
}: {
  subscription: Subscription;
  plans: Plan[];
  payments: Payment[];
  isOwner: boolean;
}) {
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const currentPlan = subscription?.plans;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Plan y facturación
        </h1>
        <p className="text-muted-foreground">
          Tu plan actual:{" "}
          <span className="font-semibold text-primary">
            {currentPlan?.name ?? "Gratis"}
          </span>
          {subscription?.current_period_end &&
            ` · válido hasta ${formatDateShort(subscription.current_period_end)}`}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => {
          const isCurrent = currentPlan?.id === plan.id;
          const isPaid = Number(plan.price_monthly) > 0;
          return (
            <Card
              key={plan.id}
              className={
                "relative" +
                (isCurrent ? " ring-2 ring-primary" : "")
              }
            >
              {isCurrent && (
                <span className="absolute right-3 top-3 rounded-full bg-primary px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-primary-foreground">
                  Plan actual
                </span>
              )}
              <CardHeader>
                <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {plan.name}
                </CardTitle>
                <CardDescription>
                  <span
                    className={
                      "font-heading text-3xl font-bold " +
                      (isCurrent ? "text-primary" : "text-foreground")
                    }
                  >
                    ${Number(plan.price_monthly).toFixed(0)}
                  </span>{" "}
                  / mes
                </CardDescription>
              </CardHeader>
              <CardContent className="flex h-full flex-col">
                <ul className="mb-4 space-y-2">
                  {planFeatures(plan).map((feat) => (
                    <li
                      key={feat}
                      className="flex items-center gap-2 text-sm text-muted-foreground"
                    >
                      <Check className="size-4 shrink-0 text-emerald-600" />
                      {feat}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto">
                  {isCurrent ? (
                    <Button variant="secondary" className="w-full" disabled>
                      Plan actual
                    </Button>
                  ) : isPaid && isOwner ? (
                    <Button
                      className="w-full"
                      onClick={() => setSelectedPlan(plan)}
                    >
                      Cambiar a {plan.name}
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historial de pagos</CardTitle>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">
              Sin pagos registrados.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Fecha</th>
                    <th className="pb-2 pr-4 font-medium">Plan</th>
                    <th className="pb-2 pr-4 font-medium">Monto</th>
                    <th className="pb-2 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td className="py-3 pr-4">
                        {formatDateShort(p.created_at)}
                      </td>
                      <td className="py-3 pr-4">{p.plans?.name ?? "Plan"}</td>
                      <td className="py-3 pr-4">
                        ${Number(p.amount).toFixed(2)}
                      </td>
                      <td className="py-3">
                        <span
                          className={
                            "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold " +
                            (p.status === "approved"
                              ? "bg-emerald-50 text-emerald-700"
                              : p.status === "rejected"
                                ? "bg-red-50 text-red-700"
                                : "bg-amber-50 text-amber-700")
                          }
                        >
                          {PAYMENT_STATUS_LABELS[p.status] ?? p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={selectedPlan !== null}
        onOpenChange={(open) => !open && setSelectedPlan(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Pagar plan {selectedPlan?.name} — $
              {Number(selectedPlan?.price_monthly ?? 0).toFixed(2)}
            </DialogTitle>
          </DialogHeader>
          {selectedPlan && (
            <TransferForm
              plan={selectedPlan}
              onDone={() => setSelectedPlan(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TransferForm({ plan, onDone }: { plan: Plan; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(
    submitBankTransferPayment,
    initialState
  );

  useEffect(() => {
    if (state.success) {
      toast.success(
        "Comprobante enviado. Activaremos tu plan al verificar el pago."
      );
      onDone();
    }
  }, [state, onDone]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="plan_id" value={plan.id} />
      <div className="rounded-lg border bg-muted/40 p-4 text-sm">
        <p className="font-medium">Datos para la transferencia</p>
        <ul className="mt-2 space-y-1 text-muted-foreground">
          <li>Banco: {BANK_TRANSFER_INSTRUCTIONS.bank}</li>
          <li>
            {BANK_TRANSFER_INSTRUCTIONS.accountType}:{" "}
            {BANK_TRANSFER_INSTRUCTIONS.accountNumber}
          </li>
          <li>Titular: {BANK_TRANSFER_INSTRUCTIONS.holder}</li>
          <li>RUC: {BANK_TRANSFER_INSTRUCTIONS.holderId}</li>
          <li>Monto: ${Number(plan.price_monthly).toFixed(2)}</li>
        </ul>
      </div>
      <div className="space-y-2">
        <Label htmlFor="receipt">Comprobante (imagen o PDF, máx. 5 MB)</Label>
        <Input
          id="receipt"
          name="receipt"
          type="file"
          accept="image/png,image/jpeg,image/webp,application/pdf"
          required
        />
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Enviando…" : "Enviar comprobante"}
      </Button>
    </form>
  );
}
