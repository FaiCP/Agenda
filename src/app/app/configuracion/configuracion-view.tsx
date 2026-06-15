"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Copy, Link2 } from "lucide-react";
import { updateOrganization } from "@/lib/actions/settings";
import type { ActionState } from "@/lib/actions/appointments";
import type { Tables } from "@/lib/supabase/database.types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

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
    <div className="max-w-3xl space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Configuración de cuenta
        </p>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Datos de la organización
        </h1>
        <p className="text-muted-foreground">
          Configura la información visible para tus clientes.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-6 pt-6">
          <div className="space-y-2">
            <Label>Página pública de reservas</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Link2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input readOnly value={bookingUrl} className="pl-9 text-primary" />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(bookingUrl);
                  toast.success("Enlace copiado");
                }}
              >
                <Copy className="mr-1 size-4" /> Copiar
              </Button>
            </div>
          </div>

          <form action={formAction} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
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
              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono</Label>
                <Input
                  id="phone"
                  name="phone"
                  disabled={!isOwner}
                  defaultValue={organization.phone ?? ""}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Dirección</Label>
              <Input
                id="address"
                name="address"
                disabled={!isOwner}
                placeholder="Ej: Av. Principal 123, Piso 4"
                defaultValue={organization.address ?? ""}
              />
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
                placeholder="Cuéntale a tus pacientes sobre tu consultorio…"
                defaultValue={organization.description ?? ""}
              />
            </div>
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <Switch
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
              <div className="flex justify-end gap-2 border-t pt-4">
                <Button type="reset" variant="outline" disabled={pending}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? "Guardando…" : "Guardar cambios"}
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
