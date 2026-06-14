"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { submitBankTransferPayment } from "@/lib/actions/billing";
import { BANK_TRANSFER_INSTRUCTIONS } from "@/lib/payments/gateway";
import type { ActionState } from "@/lib/actions/appointments";
import type { Tables } from "@/lib/supabase/database.types";
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
        <h1 className="text-2xl font-semibold">Plan y facturación</h1>
        <p className="text-muted-foreground">
          Tu plan actual:{" "}
          <span className="font-medium text-foreground">
            {currentPlan?.name ?? "Gratis"}
          </span>
          {subscription?.current_period_end &&
            ` · válido hasta ${formatDateShort(subscription.current_period_end)}`}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = currentPlan?.id === plan.id;
          return (
            <Card key={plan.id} className={isCurrent ? "border-primary" : ""}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {plan.name}
                  {isCurrent && <Badge>Actual</Badge>}
                </CardTitle>
                <CardDescription>
                  <span className="text-2xl font-bold text-foreground">
                    ${Number(plan.price_monthly).toFixed(0)}
                  </span>{" "}
                  / mes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-sm text-muted-foreground">
                  {plan.max_professionals}{" "}
                  {plan.max_professionals === 1 ? "profesional" : "profesionales"}
                  {plan.max_appointments_per_month
                    ? ` · ${plan.max_appointments_per_month} citas/mes`
                    : " · citas ilimitadas"}
                </p>
                {!isCurrent && Number(plan.price_monthly) > 0 && isOwner && (
                  <Button
                    className="w-full"
                    onClick={() => setSelectedPlan(plan)}
                  >
                    Pagar por transferencia
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historial de pagos</CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          {payments.length === 0 && (
            <p className="py-6 text-center text-muted-foreground">
              Sin pagos registrados.
            </p>
          )}
          {payments.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between py-3 text-sm"
            >
              <span>
                {formatDateShort(p.created_at)} · {p.plans?.name ?? "Plan"} · $
                {Number(p.amount).toFixed(2)}
              </span>
              <Badge
                variant={
                  p.status === "approved"
                    ? "secondary"
                    : p.status === "rejected"
                      ? "destructive"
                      : "outline"
                }
              >
                {PAYMENT_STATUS_LABELS[p.status] ?? p.status}
              </Badge>
            </div>
          ))}
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
