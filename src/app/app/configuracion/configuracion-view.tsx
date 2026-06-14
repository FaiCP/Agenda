"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { updateOrganization } from "@/lib/actions/settings";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

const initialState: ActionState = { error: null };

export function ConfiguracionView({
  organization,
  isOwner,
}: {
  organization: Tables<"organizations">;
  isOwner: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    updateOrganization,
    initialState
  );

  useEffect(() => {
    if (state.success) toast.success("Configuración guardada");
  }, [state]);

  const bookingUrl =
    typeof window === "undefined"
      ? `/reservar/${organization.slug}`
      : `${window.location.origin}/reservar/${organization.slug}`;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Configuración</h1>
        <p className="text-muted-foreground">Datos de tu organización.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Página pública de reservas</CardTitle>
          <CardDescription>
            Comparte este enlace con tus pacientes o clientes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input readOnly value={bookingUrl} />
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(bookingUrl);
                toast.success("Enlace copiado");
              }}
            >
              Copiar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Datos de la organización</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                name="name"
                required
                disabled={!isOwner}
                defaultValue={organization.name}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono</Label>
                <Input
                  id="phone"
                  name="phone"
                  disabled={!isOwner}
                  defaultValue={organization.phone ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Dirección</Label>
                <Input
                  id="address"
                  name="address"
                  disabled={!isOwner}
                  defaultValue={organization.address ?? ""}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">
                Descripción (visible en tu página pública)
              </Label>
              <Textarea
                id="description"
                name="description"
                rows={3}
                disabled={!isOwner}
                defaultValue={organization.description ?? ""}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="booking_enabled"
                name="booking_enabled"
                disabled={!isOwner}
                defaultChecked={organization.booking_enabled}
              />
              <Label htmlFor="booking_enabled" className="font-normal">
                Permitir reservas online
              </Label>
            </div>
            {state.error && (
              <p className="text-sm text-destructive">{state.error}</p>
            )}
            {isOwner && (
              <Button type="submit" disabled={pending}>
                {pending ? "Guardando…" : "Guardar cambios"}
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
