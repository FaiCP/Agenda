"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";
import {
  upsertService,
  toggleServiceActive,
} from "@/lib/actions/services";
import type { ActionState } from "@/lib/actions/appointments";
import type { Tables } from "@/lib/supabase/database.types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Service = Tables<"services">;

const initialState: ActionState = { error: null };

export function ServiciosView({ services }: { services: Service[] }) {
  const [editing, setEditing] = useState<Service | null>(null);
  const [open, setOpen] = useState(false);

  function openNew() {
    setEditing(null);
    setOpen(true);
  }

  function openEdit(s: Service) {
    setEditing(s);
    setOpen(true);
  }

  async function onToggle(s: Service, active: boolean) {
    const result = await toggleServiceActive(s.id, active);
    if (result.error) toast.error(result.error);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Servicios
          </h1>
          <p className="text-muted-foreground">
            Lo que ofreces y puede reservarse.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-1 size-4" /> Nuevo servicio
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Nombre
              </TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Duración
              </TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Precio
              </TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Reserva online
              </TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Activo
              </TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {services.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-10 text-center text-muted-foreground"
                >
                  Aún no tienes servicios. Crea el primero.
                </TableCell>
              </TableRow>
            )}
            {services.map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <span className="h-8 w-1 shrink-0 rounded-full bg-primary" />
                    <span className="font-medium">{s.name}</span>
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {s.duration_minutes} min
                </TableCell>
                <TableCell className="whitespace-nowrap font-semibold text-primary">
                  ${Number(s.price).toFixed(2)}
                </TableCell>
                <TableCell>
                  {s.allow_public_booking ? (
                    <Badge className="border-transparent bg-emerald-50 text-emerald-700">
                      Sí
                    </Badge>
                  ) : (
                    <Badge variant="outline">No</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Switch
                    checked={s.active}
                    onCheckedChange={(v) => onToggle(s, v)}
                  />
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                    <Pencil className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar servicio" : "Nuevo servicio"}
            </DialogTitle>
          </DialogHeader>
          <ServiceForm
            key={editing?.id ?? "new"}
            service={editing}
            onDone={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ServiceForm({
  service,
  onDone,
}: {
  service: Service | null;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    upsertService,
    initialState
  );

  useEffect(() => {
    if (state.success) {
      toast.success("Servicio guardado");
      onDone();
    }
  }, [state, onDone]);

  return (
    <form action={formAction} className="space-y-4">
      {service && <input type="hidden" name="id" value={service.id} />}
      <div className="space-y-2">
        <Label htmlFor="name">Nombre</Label>
        <Input
          id="name"
          name="name"
          required
          defaultValue={service?.name ?? ""}
          placeholder="Ej: Consulta general"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Descripción (opcional)</Label>
        <Textarea
          id="description"
          name="description"
          rows={2}
          defaultValue={service?.description ?? ""}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="duration_minutes">Duración (minutos)</Label>
          <Input
            id="duration_minutes"
            name="duration_minutes"
            type="number"
            min={5}
            step={5}
            required
            defaultValue={service?.duration_minutes ?? 30}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="price">Precio (USD)</Label>
          <Input
            id="price"
            name="price"
            type="number"
            min={0}
            step="0.01"
            required
            defaultValue={service ? Number(service.price) : 0}
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="allow_public_booking"
          name="allow_public_booking"
          defaultChecked={service?.allow_public_booking ?? true}
        />
        <Label htmlFor="allow_public_booking" className="font-normal">
          Permitir reserva desde la página pública
        </Label>
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Guardando…" : "Guardar"}
      </Button>
    </form>
  );
}
