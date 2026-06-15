"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Crown, ShieldCheck, CalendarCheck } from "lucide-react";
import {
  addProfessional,
  removeMember,
  type TeamActionState,
} from "@/lib/actions/team";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Member {
  id: string;
  role: string;
  name: string;
  acceptsAppointments: boolean;
  isSelf: boolean;
}

const ROLE_LABEL: Record<string, string> = {
  owner: "Dueño",
  professional: "Profesional",
  receptionist: "Recepción",
};

const initialState: TeamActionState = { error: null };

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function EquipoView({
  members,
  used,
  limit,
  planName,
}: {
  members: Member[];
  used: number;
  limit: number;
  planName: string;
}) {
  const [open, setOpen] = useState(false);
  const atLimit = used >= limit;
  const remaining = Math.max(0, limit - used);
  const pct = limit > 0 ? Math.round((used / limit) * 100) : 0;

  async function onRemove(id: string, name: string) {
    if (!confirm(`¿Quitar a ${name} del equipo?`)) return;
    const res = await removeMember(id);
    if (res.error) toast.error(res.error);
    else toast.success("Profesional quitado del equipo");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Equipo
          </p>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Gestión de profesionales
          </h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="size-4 text-primary" />
            Profesionales activos:{" "}
            <span className="font-semibold text-foreground">
              {used} de {limit}
            </span>
          </p>
        </div>
        <Button onClick={() => setOpen(true)} disabled={atLimit}>
          <Plus className="mr-1 size-4" /> Agregar profesional
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <Card className="min-w-0">
          <div className="border-b px-4 py-3">
            <p className="font-heading text-sm font-semibold">
              Listado del equipo
            </p>
          </div>
          <CardContent className="p-0">
            <ul className="divide-y">
              {members.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar size="lg">
                      <AvatarFallback className="bg-accent text-sm font-medium text-accent-foreground">
                        {initials(m.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 font-medium">
                        {m.name}
                        {m.role === "owner" && (
                          <Crown className="size-3.5 text-amber-500" />
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {m.role === "owner"
                          ? "Acceso total"
                          : "Gestión de agenda y expedientes"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={m.role === "owner" ? "default" : "secondary"}
                    >
                      {ROLE_LABEL[m.role] ?? m.role}
                    </Badge>
                    {m.role !== "owner" && !m.isSelf && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Quitar del equipo"
                        onClick={() => onRemove(m.id, m.name)}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => !atLimit && setOpen(true)}
              disabled={atLimit}
              className="flex w-full flex-col items-center gap-1 border-t border-dashed px-4 py-6 text-center text-muted-foreground transition-colors hover:bg-muted/40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            >
              <span className="flex size-9 items-center justify-center rounded-full border border-dashed">
                <Plus className="size-4" />
              </span>
              <span className="text-xs font-medium uppercase tracking-wide">
                Espacio disponible
              </span>
              <span className="text-xs">
                {remaining === 0
                  ? "Sin lugares en tu plan actual"
                  : `Quedan ${remaining} ${remaining === 1 ? "lugar" : "lugares"} en tu plan actual`}
              </span>
            </button>
          </CardContent>
        </Card>

        <aside className="space-y-4">
          <Card>
            <CardContent className="flex flex-col items-center gap-3 p-5 text-center">
              <p className="self-start text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Uso de licencias
              </p>
              <div
                className="relative size-32"
                style={{
                  background: `conic-gradient(var(--primary) ${pct * 3.6}deg, var(--muted) 0deg)`,
                  borderRadius: "9999px",
                }}
              >
                <div className="absolute inset-[10px] flex flex-col items-center justify-center rounded-full bg-card">
                  <span className="font-heading text-2xl font-bold">{pct}%</span>
                  <span className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                    Ocupado
                  </span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Has usado{" "}
                <span className="font-semibold text-foreground">
                  {used} profesional{used === 1 ? "" : "es"}
                </span>{" "}
                de los {limit} disponibles en el plan {planName}.
              </p>
              <Button variant="outline" size="sm" className="w-full" asChild>
                <Link href="/app/facturacion">Mejorar plan</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Roles de equipo
              </p>
              <RoleInfo
                icon={Crown}
                title="Dueño"
                desc="Control total sobre configuración, pagos y gestión de equipo."
              />
              <RoleInfo
                icon={CalendarCheck}
                title="Profesional"
                desc="Gestión de su propia agenda y expedientes de pacientes."
              />
            </CardContent>
          </Card>
        </aside>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar profesional</DialogTitle>
            <DialogDescription>
              Se gestiona desde tu cuenta. No necesita iniciar sesión para
              aparecer en la agenda y la página de reservas.
            </DialogDescription>
          </DialogHeader>
          <AddForm onDone={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RoleInfo({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ElementType;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}

function AddForm({ onDone }: { onDone: () => void }) {
  const [state, formAction, pending] = useActionState(
    addProfessional,
    initialState
  );

  useEffect(() => {
    if (state.success) {
      toast.success("Profesional agregado");
      onDone();
    }
  }, [state, onDone]);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="full_name">Nombre completo</Label>
        <Input
          id="full_name"
          name="full_name"
          required
          placeholder="Ej: Dra. Ana Gómez"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="display_name">
          Nombre para mostrar (opcional)
        </Label>
        <Input
          id="display_name"
          name="display_name"
          placeholder="Cómo aparece en la agenda y reservas"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Correo (opcional)</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="Solo si luego quieres darle acceso propio"
        />
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Agregando…" : "Agregar profesional"}
      </Button>
    </form>
  );
}
