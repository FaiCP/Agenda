"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import {
  createAppointment,
  rescheduleAppointment,
  updateAppointmentStatus,
  type ActionState,
} from "@/lib/actions/appointments";
import { APPOINTMENT_STATUS_LABELS } from "@/lib/verticals";
import { formatTime } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Option {
  id: string;
  name: string;
}

interface AppointmentRow {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  origin: string;
  notes: string | null;
  clients: { id: string; full_name: string; phone: string | null } | null;
  services: { id: string; name: string } | null;
  profiles: { id: string; full_name: string } | null;
}

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "outline",
  confirmed: "default",
  completed: "secondary",
  cancelled: "destructive",
  no_show: "destructive",
};

const initialState: ActionState = { error: null };

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function AgendaView({
  date,
  clientLabel,
  appointments,
  clients,
  services,
  professionals,
}: {
  date: string;
  clientLabel: string;
  appointments: AppointmentRow[];
  clients: { id: string; full_name: string }[];
  services: { id: string; name: string; duration_minutes: number }[];
  professionals: Option[];
}) {
  const router = useRouter();
  const [newOpen, setNewOpen] = useState(false);
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);

  const dateLabel = new Date(`${date}T12:00:00-05:00`).toLocaleDateString(
    "es-EC",
    {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "America/Guayaquil",
    }
  );

  async function setStatus(id: string, status: string) {
    const result = await updateAppointmentStatus(
      id,
      status as Parameters<typeof updateAppointmentStatus>[1]
    );
    if (result.error) toast.error(result.error);
    else toast.success("Cita actualizada");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Agenda</h1>
          <p className="capitalize text-muted-foreground">{dateLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push(`/app?fecha=${shiftDate(date, -1)}`)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Input
            type="date"
            value={date}
            className="w-auto"
            onChange={(e) => router.push(`/app?fecha=${e.target.value}`)}
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push(`/app?fecha=${shiftDate(date, 1)}`)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Dialog open={newOpen} onOpenChange={setNewOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-1 h-4 w-4" /> Nueva cita
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nueva cita</DialogTitle>
              </DialogHeader>
              <NewAppointmentForm
                date={date}
                clientLabel={clientLabel}
                clients={clients}
                services={services}
                professionals={professionals}
                onDone={() => setNewOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {appointments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No hay citas para este día.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {appointments.map((a) => (
            <Card key={a.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className="text-lg font-semibold">
                      {formatTime(a.starts_at)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatTime(a.ends_at)}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium">
                      {a.clients?.full_name ?? "Sin cliente"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {a.services?.name ?? "Servicio"} ·{" "}
                      {a.profiles?.full_name ?? ""}
                      {a.origin === "public" && " · Reserva online"}
                    </p>
                    {a.notes && (
                      <p className="text-xs text-muted-foreground">{a.notes}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={STATUS_VARIANT[a.status] ?? "outline"}>
                    {APPOINTMENT_STATUS_LABELS[a.status] ?? a.status}
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        Acciones
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setStatus(a.id, "confirmed")}>
                        Confirmar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setStatus(a.id, "completed")}>
                        Marcar completada
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setStatus(a.id, "no_show")}>
                        No asistió
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setRescheduleId(a.id)}>
                        Reagendar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => setStatus(a.id, "cancelled")}
                      >
                        Cancelar cita
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={rescheduleId !== null}
        onOpenChange={(open) => !open && setRescheduleId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reagendar cita</DialogTitle>
          </DialogHeader>
          {rescheduleId && (
            <RescheduleForm
              appointmentId={rescheduleId}
              date={date}
              onDone={() => setRescheduleId(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NewAppointmentForm({
  date,
  clientLabel,
  clients,
  services,
  professionals,
  onDone,
}: {
  date: string;
  clientLabel: string;
  clients: { id: string; full_name: string }[];
  services: { id: string; name: string; duration_minutes: number }[];
  professionals: Option[];
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    createAppointment,
    initialState
  );

  useEffect(() => {
    if (state.success) {
      toast.success("Cita creada");
      onDone();
    }
  }, [state, onDone]);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="client_id" className="capitalize">
          {clientLabel}
        </Label>
        <select
          id="client_id"
          name="client_id"
          required
          className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
        >
          <option value="">Seleccionar…</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.full_name}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          ¿No existe aún? Créalo primero en la sección Clientes.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="service_id">Servicio</Label>
        <select
          id="service_id"
          name="service_id"
          required
          className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
        >
          <option value="">Seleccionar…</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.duration_minutes} min)
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="professional_id">Profesional</Label>
        <select
          id="professional_id"
          name="professional_id"
          required
          className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
        >
          {professionals.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="date">Fecha</Label>
          <Input id="date" name="date" type="date" defaultValue={date} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="time">Hora</Label>
          <Input id="time" name="time" type="time" required />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notas (opcional)</Label>
        <Textarea id="notes" name="notes" rows={2} />
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Guardando…" : "Crear cita"}
      </Button>
    </form>
  );
}

function RescheduleForm({
  appointmentId,
  date,
  onDone,
}: {
  appointmentId: string;
  date: string;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    rescheduleAppointment,
    initialState
  );

  useEffect(() => {
    if (state.success) {
      toast.success("Cita reagendada");
      onDone();
    }
  }, [state, onDone]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="appointment_id" value={appointmentId} />
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="re-date">Nueva fecha</Label>
          <Input id="re-date" name="date" type="date" defaultValue={date} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="re-time">Nueva hora</Label>
          <Input id="re-time" name="time" type="time" required />
        </div>
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Guardando…" : "Reagendar"}
      </Button>
    </form>
  );
}
