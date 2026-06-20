"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { notifyPublicBooking } from "@/lib/actions/appointments";
import { todayInEcuador } from "@/lib/dates";
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
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface BookingInfo {
  organization: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
    description: string | null;
    phone: string | null;
    address: string | null;
  };
  services: {
    id: string;
    name: string;
    description: string | null;
    duration_minutes: number;
    price: number;
    modality: string;
  }[];
  professionals: { id: string; name: string }[];
}

interface Slot {
  starts_at: string;
  ends_at: string;
  label: string;
}

export function BookingFlow({
  slug,
  info,
}: {
  slug: string;
  info: BookingInfo;
}) {
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [professionalId, setProfessionalId] = useState<string | null>(
    info.professionals.length === 1 ? info.professionals[0].id : null
  );
  const [date, setDate] = useState(todayInEcuador());
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState<Slot | null>(null);

  const loadSlots = useCallback(async () => {
    if (!serviceId || !professionalId || !date) return;
    setLoadingSlots(true);
    setSelectedSlot(null);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("get_available_slots", {
      org_slug: slug,
      p_professional_id: professionalId,
      p_service_id: serviceId,
      p_date: date,
    });
    setLoadingSlots(false);
    if (error) {
      toast.error("No se pudieron cargar los horarios.");
      setSlots([]);
      return;
    }
    setSlots((data as unknown as Slot[]) ?? []);
  }, [slug, serviceId, professionalId, date]);

  useEffect(() => {
    // Sincroniza los horarios con el backend al cambiar servicio, profesional
    // o fecha. El estado de carga se marca de forma intencional para mostrar el
    // skeleton mientras llega la respuesta.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSlots();
  }, [loadSlots]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!serviceId || !professionalId || !selectedSlot) return;
    const form = new FormData(e.currentTarget);
    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("create_public_appointment", {
      org_slug: slug,
      p_professional_id: professionalId,
      p_service_id: serviceId,
      p_starts_at: selectedSlot.starts_at,
      p_client_name: String(form.get("name") ?? ""),
      p_client_email: String(form.get("email") ?? ""),
      p_client_phone: String(form.get("phone") ?? ""),
      p_notes: String(form.get("notes") ?? "") || undefined,
    });
    setSubmitting(false);
    if (error) {
      toast.error(
        error.message.includes("disponible")
          ? "Ese horario acaba de ocuparse. Elige otro."
          : "No se pudo crear la reserva. Verifica tus datos."
      );
      loadSlots();
      return;
    }

    // Confirmación por WhatsApp (best-effort, no bloquea la confirmación visual)
    const bookedService = info.services.find((s) => s.id === serviceId);
    void notifyPublicBooking({
      slug,
      clientName: String(form.get("name") ?? ""),
      phone: String(form.get("phone") ?? ""),
      serviceName: bookedService?.name ?? "tu servicio",
      startsAt: selectedSlot.starts_at,
    });

    setConfirmed(selectedSlot);
  }

  if (confirmed) {
    const service = info.services.find((s) => s.id === serviceId);
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <CheckCircle2 className="h-12 w-12 text-green-600" />
          <h2 className="text-xl font-semibold">¡Cita reservada!</h2>
          <p className="text-muted-foreground">
            {service?.name} ·{" "}
            {new Date(confirmed.starts_at).toLocaleString("es-EC", {
              dateStyle: "full",
              timeStyle: "short",
              timeZone: "America/Guayaquil",
            })}
          </p>
          <p className="text-sm text-muted-foreground">
            {info.organization.name}
            {info.organization.address && ` · ${info.organization.address}`}
            {info.organization.phone && ` · Tel: ${info.organization.phone}`}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>1. Elige un servicio</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {info.services.length === 0 && (
            <p className="text-muted-foreground sm:col-span-2">
              No hay servicios disponibles para reserva online.
            </p>
          )}
          {info.services.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setServiceId(s.id)}
              className={cn(
                "rounded-lg border p-3 text-left transition-colors hover:bg-accent",
                serviceId === s.id && "border-primary bg-accent"
              )}
            >
              <p className="font-medium">{s.name}</p>
              <p className="text-sm text-muted-foreground">
                {s.duration_minutes} min · ${Number(s.price).toFixed(2)}
              </p>
              {s.description && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {s.description}
                </p>
              )}
            </button>
          ))}
        </CardContent>
      </Card>

      {serviceId && (
        <Card>
          <CardHeader>
            <CardTitle>2. Elige profesional, fecha y hora</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {info.professionals.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {info.professionals.map((p) => (
                  <Button
                    key={p.id}
                    type="button"
                    variant={professionalId === p.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setProfessionalId(p.id)}
                  >
                    {p.name}
                  </Button>
                ))}
              </div>
            )}
            <div className="max-w-xs space-y-2">
              <Label htmlFor="booking-date">Fecha</Label>
              <Input
                id="booking-date"
                type="date"
                min={todayInEcuador()}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            {professionalId && (
              <div>
                <Label>Horarios disponibles</Label>
                {loadingSlots ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <Skeleton key={i} className="h-9 w-16" />
                    ))}
                  </div>
                ) : slots && slots.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {slots.map((slot) => (
                      <Button
                        key={slot.starts_at}
                        type="button"
                        size="sm"
                        variant={
                          selectedSlot?.starts_at === slot.starts_at
                            ? "default"
                            : "outline"
                        }
                        onClick={() => setSelectedSlot(slot)}
                      >
                        {slot.label}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    No hay horarios disponibles ese día. Prueba otra fecha.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {selectedSlot && (
        <Card>
          <CardHeader>
            <CardTitle>3. Tus datos</CardTitle>
            <CardDescription>
              Para confirmar la cita y poder contactarte.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre completo</Label>
                <Input id="name" name="name" required />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email">Correo electrónico</Label>
                  <Input id="email" name="email" type="email" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Teléfono / WhatsApp</Label>
                  <Input id="phone" name="phone" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Motivo o comentario (opcional)</Label>
                <Textarea id="notes" name="notes" rows={2} />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting
                  ? "Reservando…"
                  : `Confirmar cita — ${selectedSlot.label}`}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
