"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  CalendarX2,
  CalendarRange,
  Sparkles,
} from "lucide-react";
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Agenda
          </h1>
          <p className="capitalize text-muted-foreground">{dateLabel}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg border bg-card p-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Día anterior"
              onClick={() => router.push(`/app?fecha=${shiftDate(date, -1)}`)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Input
              type="date"
              value={date}
              className="h-7 w-auto border-0 bg-transparent text-sm shadow-none focus-visible:ring-0"
              onChange={(e) => router.push(`/app?fecha=${e.target.value}`)}
            />
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Día siguiente"
              onClick={() => router.push(`/app?fecha=${shiftDate(date, 1)}`)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <Dialog open={newOpen} onOpenChange={setNewOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-1 size-4" /> Nueva cita
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

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          {appointments.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-4 px-6 py-16 text-center">
                <span className="flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <CalendarX2 className="size-7" />
                </span>
                <div className="space-y-1">
                  <p className="font-heading text-lg font-semibold">
                    No hay citas para este día.
                  </p>
                  <p className="mx-auto max-w-sm text-sm text-muted-foreground">
                    Aprovecha este tiempo para organizar tu consultorio o
                    actualizar tus expedientes.
                  </p>
                </div>
                <Button variant="outline" asChild>
                  <Link href="/app/disponibilidad">
                    <CalendarRange className="mr-2 size-4" />
                    Ver disponibilidad semanal
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {appointments.map((a) => (
                <Card key={a.id} className="transition-colors hover:border-primary/30">
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                    <div className="flex items-center gap-4">
                      <div className="w-14 shrink-0 rounded-lg bg-accent px-2 py-1.5 text-center text-accent-foreground">
                        <p className="text-base font-semibold leading-tight">
                          {formatTime(a.starts_at)}
                        </p>
                        <p className="text-xs opacity-70">
                          {formatTime(a.ends_at)}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium">
                          {a.clients?.full_name ?? "Sin cliente"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {a.services?.name ?? "Servicio"} ·{" "}
                          {a.profiles?.full_name ?? ""}
                          {a.origin === "public" && " · Reserva online"}
                        </p>
                        {a.notes && (
                          <p className="text-xs text-muted-foreground">
                            {a.notes}
                          </p>
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
        </div>

        <aside className="space-y-4">
          <MiniCalendar date={date} />
          <div className="rounded-xl bg-primary p-5 text-primary-foreground">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4" />
              <p className="font-heading text-sm font-semibold">Tip del día</p>
            </div>
            <p className="mt-2 text-sm text-primary-foreground/85">
              Mantén tus huecos de agenda actualizados para que tus pacientes
              puedan reservar 24/7 sin llamadas.
            </p>
          </div>
        </aside>
      </div>

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

const WEEKDAYS = ["D", "L", "M", "M", "J", "V", "S"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function MiniCalendar({ date }: { date: string }) {
  const router = useRouter();
  const [yStr, mStr] = date.split("-");
  const selectedYear = Number(yStr);
  const selectedMonth = Number(mStr) - 1;
  const [view, setView] = useState({ year: selectedYear, month: selectedMonth });

  const todayStr = useMemo(() => {
    const t = new Date();
    return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
  }, []);

  const cells = useMemo(() => {
    const firstWeekday = new Date(view.year, view.month, 1).getDay();
    const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
    const out: (number | null)[] = Array(firstWeekday).fill(null);
    for (let d = 1; d <= daysInMonth; d++) out.push(d);
    return out;
  }, [view]);

  const monthLabel = new Date(view.year, view.month, 1).toLocaleDateString(
    "es-EC",
    { month: "long", year: "numeric" }
  );

  function shiftMonth(delta: number) {
    setView((v) => {
      const d = new Date(v.year, v.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-heading text-sm font-semibold capitalize">
            {monthLabel}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Mes anterior"
              onClick={() => shiftMonth(-1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Mes siguiente"
              onClick={() => shiftMonth(1)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS.map((w, i) => (
            <span
              key={i}
              className="py-1 text-[0.7rem] font-medium text-muted-foreground"
            >
              {w}
            </span>
          ))}
          {cells.map((d, i) => {
            if (d === null) return <span key={i} />;
            const cellStr = `${view.year}-${pad(view.month + 1)}-${pad(d)}`;
            const isSelected = cellStr === date;
            const isToday = cellStr === todayStr;
            return (
              <button
                key={i}
                type="button"
                onClick={() => router.push(`/app?fecha=${cellStr}`)}
                aria-current={isSelected ? "date" : undefined}
                className={
                  "flex h-8 items-center justify-center rounded-md text-sm transition-colors " +
                  (isSelected
                    ? "bg-primary font-semibold text-primary-foreground"
                    : isToday
                      ? "bg-accent font-medium text-accent-foreground"
                      : "hover:bg-muted")
                }
              >
                {d}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
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
