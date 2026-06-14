"use client";

import { useActionState, useState } from "react";
import {
  createOrganization,
  type OnboardingState,
} from "@/lib/actions/onboarding";
import { VERTICALS, type Vertical } from "@/lib/verticals";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

const initialState: OnboardingState = { error: null };

export function OnboardingForm() {
  const [state, formAction, pending] = useActionState(
    createOrganization,
    initialState
  );
  const [vertical, setVertical] = useState<Vertical>("medical");

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Configura tu espacio de trabajo</CardTitle>
        <CardDescription>
          Cuéntanos sobre tu práctica para preparar tu agenda y expedientes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-6">
          <div className="space-y-2">
            <Label>¿A qué te dedicas?</Label>
            <input type="hidden" name="vertical" value={vertical} />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {(
                Object.entries(VERTICALS) as [
                  Vertical,
                  (typeof VERTICALS)[Vertical],
                ][]
              ).map(([key, v]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setVertical(key)}
                  className={cn(
                    "rounded-lg border p-3 text-left text-sm transition-colors hover:bg-accent",
                    vertical === key && "border-primary bg-accent"
                  )}
                >
                  <span className="text-xl">{v.icon}</span>
                  <p className="mt-1 font-medium">{v.label}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Nombre de tu consultorio / despacho</Label>
            <Input
              id="name"
              name="name"
              required
              placeholder="Ej: Consultorio Dra. Pérez"
            />
            <p className="text-xs text-muted-foreground">
              Con este nombre se creará tu página pública de reservas.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Teléfono de contacto (opcional)</Label>
            <Input id="phone" name="phone" placeholder="Ej: 0991234567" />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox id="create_examples" name="create_examples" defaultChecked />
            <Label htmlFor="create_examples" className="font-normal">
              Crear servicios de ejemplo y horario inicial (lun–vie, 09:00 a
              17:00)
            </Label>
          </div>

          {state.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Creando…" : "Crear mi espacio de trabajo"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
