"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Search, UserPlus, Users, Phone } from "lucide-react";
import { upsertClient } from "@/lib/actions/clients";
import type { ActionState } from "@/lib/actions/appointments";
import type { Tables } from "@/lib/supabase/database.types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Client = Tables<"clients">;

interface Stats {
  total: number;
  newThisMonth: number;
  withPhone: number;
}

const initialState: ActionState = { error: null };

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function ClientesView({
  clients,
  clientLabel,
  q,
  stats,
}: {
  clients: Client[];
  clientLabel: string;
  q: string;
  stats: Stats;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold capitalize tracking-tight">
            {clientLabel}s
          </h1>
          <p className="text-muted-foreground">
            Directorio y acceso a expedientes.
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <form
            className="relative min-w-0 flex-1 sm:w-72 sm:flex-none"
            onSubmit={(e) => {
              e.preventDefault();
              const value = new FormData(e.currentTarget).get("q");
              router.push(
                `/app/clientes?q=${encodeURIComponent(String(value ?? ""))}`
              );
            }}
          >
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              name="q"
              defaultValue={q}
              placeholder="Buscar por nombre, correo o cédula…"
              className="pl-9"
            />
          </form>
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-1 size-4" /> Nuevo {clientLabel}
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Nombre
              </TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Contacto
              </TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Cédula / ID
              </TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="py-10 text-center text-muted-foreground"
                >
                  {q
                    ? "Sin resultados para la búsqueda."
                    : `Aún no tienes ${clientLabel}s registrados.`}
                </TableCell>
              </TableRow>
            )}
            {clients.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback className="bg-accent text-xs font-medium text-accent-foreground">
                        {initials(c.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{c.full_name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {[c.email, c.phone].filter(Boolean).join(" · ") || "—"}
                </TableCell>
                <TableCell>{c.document_id ?? "—"}</TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/app/clientes/${c.id}`}>Ver expediente</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={UserPlus}
          label="Nuevos este mes"
          value={`+${stats.newThisMonth}`}
        />
        <StatCard icon={Users} label="Total de registros" value={stats.total} />
        <StatCard
          icon={Phone}
          label="Con teléfono"
          value={stats.withPhone}
        />
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="capitalize">Nuevo {clientLabel}</DialogTitle>
          </DialogHeader>
          <ClientForm onDone={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="font-heading text-xl font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function ClientForm({
  client,
  onDone,
}: {
  client?: Client;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    upsertClient,
    initialState
  );

  useEffect(() => {
    if (state.success) {
      toast.success("Guardado");
      onDone();
    }
  }, [state, onDone]);

  return (
    <form action={formAction} className="space-y-4">
      {client && <input type="hidden" name="id" value={client.id} />}
      <div className="space-y-2">
        <Label htmlFor="full_name">Nombre completo</Label>
        <Input
          id="full_name"
          name="full_name"
          required
          defaultValue={client?.full_name ?? ""}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="email">Correo</Label>
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={client?.email ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Teléfono</Label>
          <Input id="phone" name="phone" defaultValue={client?.phone ?? ""} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="document_id">Cédula / ID</Label>
          <Input
            id="document_id"
            name="document_id"
            defaultValue={client?.document_id ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="birth_date">Fecha de nacimiento</Label>
          <Input
            id="birth_date"
            name="birth_date"
            type="date"
            defaultValue={client?.birth_date ?? ""}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="address">Dirección</Label>
        <Input id="address" name="address" defaultValue={client?.address ?? ""} />
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Guardando…" : "Guardar"}
      </Button>
    </form>
  );
}
