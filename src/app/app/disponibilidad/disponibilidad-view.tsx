"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";
import {
  addAvailabilityRule,
  deleteAvailabilityRule,
} from "@/lib/actions/availability";
import type { ActionState } from "@/lib/actions/appointments";
import type { Tables } from "@/lib/supabase/database.types";
import { WEEKDAY_LABELS } from "@/lib/verticals";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Rule = Tables<"availability_rules">;

const initialState: ActionState = { error: null };

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function DisponibilidadView({
  rules,
  professionals,
  currentUserId,
}: {
  rules: Rule[];
  professionals: { id: string; name: string }[];
  currentUserId: string;
}) {
  const [state, formAction, pending] = useActionState(
    addAvailabilityRule,
    initialState
  );

  useEffect(() => {
    if (state.success) toast.success("Horario agregado");
  }, [state]);

  async function onDelete(id: string) {
    const result = await deleteAvailabilityRule(id);
    if (result.error) toast.error(result.error);
    else toast.success("Horario eliminado");
  }

  const byProfessional = new Map<string, Rule[]>();
  for (const r of rules) {
    const list = byProfessional.get(r.professional_id) ?? [];
    list.push(r);
    byProfessional.set(r.professional_id, list);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Disponibilidad
        </h1>
        <p className="text-muted-foreground">
          Horarios semanales en los que se pueden agendar citas.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader>
            <CardTitle>Agregar franja horaria</CardTitle>
            <CardDescription>
              Se repetirá cada semana en el día seleccionado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={formAction} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="professional_id">Profesional</Label>
                  <select
                    id="professional_id"
                    name="professional_id"
                    defaultValue={currentUserId}
                    className="h-9 w-full rounded-lg border bg-transparent px-3 text-sm"
                  >
                    {professionals.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="weekday">Día</Label>
                  <select
                    id="weekday"
                    name="weekday"
                    className="h-9 w-full rounded-lg border bg-transparent px-3 text-sm"
                  >
                    {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                      <option key={d} value={d}>
                        {WEEKDAY_LABELS[d]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="start_time">Desde</Label>
                  <Input
                    id="start_time"
                    name="start_time"
                    type="time"
                    required
                    defaultValue="09:00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_time">Hasta</Label>
                  <Input
                    id="end_time"
                    name="end_time"
                    type="time"
                    required
                    defaultValue="17:00"
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={pending}>
                <Plus className="mr-1 size-4" />
                {pending ? "Agregando…" : "Agregar franja"}
              </Button>
            </form>
            {state.error && (
              <p className="mt-2 text-sm text-destructive">{state.error}</p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {professionals.map((p) => {
            const profRules = byProfessional.get(p.id) ?? [];
            const activeDays = new Set(profRules.map((r) => r.weekday)).size;
            return (
              <Card key={p.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-center gap-3 rounded-lg bg-foreground p-3 text-background">
                    <Avatar>
                      <AvatarFallback className="bg-background/20 text-xs font-medium text-background">
                        {initials(p.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{p.name}</p>
                      <p className="text-xs text-background/70">
                        {activeDays} {activeDays === 1 ? "día activo" : "días activos"}
                      </p>
                    </div>
                  </div>
                  {profRules.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Sin horarios configurados — no aparecerá en la página de
                      reservas.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {profRules.map((r) => (
                        <li
                          key={r.id}
                          className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2"
                        >
                          <div className="flex items-center gap-3">
                            <span className="h-8 w-1 shrink-0 rounded-full bg-primary" />
                            <div>
                              <p className="text-sm font-medium">
                                {WEEKDAY_LABELS[r.weekday]}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {r.start_time.slice(0, 5)} a{" "}
                                {r.end_time.slice(0, 5)}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Eliminar franja"
                            onClick={() => onDelete(r.id)}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
