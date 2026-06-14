"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Rule = Tables<"availability_rules">;

const initialState: ActionState = { error: null };

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
        <h1 className="text-2xl font-semibold">Disponibilidad</h1>
        <p className="text-muted-foreground">
          Horarios semanales en los que se pueden agendar citas.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Agregar franja horaria</CardTitle>
          <CardDescription>
            Se repetirá cada semana en el día seleccionado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action={formAction}
            className="grid items-end gap-3 sm:grid-cols-5"
          >
            <div className="space-y-2">
              <Label htmlFor="professional_id">Profesional</Label>
              <select
                id="professional_id"
                name="professional_id"
                defaultValue={currentUserId}
                className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
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
                className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
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
            <Button type="submit" disabled={pending}>
              {pending ? "Agregando…" : "Agregar"}
            </Button>
          </form>
          {state.error && (
            <p className="mt-2 text-sm text-destructive">{state.error}</p>
          )}
        </CardContent>
      </Card>

      {professionals.map((p) => {
        const profRules = byProfessional.get(p.id) ?? [];
        return (
          <Card key={p.id}>
            <CardHeader>
              <CardTitle className="text-base">{p.name}</CardTitle>
            </CardHeader>
            <CardContent>
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
                      className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                    >
                      <span>
                        <span className="font-medium">
                          {WEEKDAY_LABELS[r.weekday]}
                        </span>{" "}
                        · {r.start_time.slice(0, 5)} a {r.end_time.slice(0, 5)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(r.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
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
  );
}
