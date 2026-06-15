"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Users,
  UsersRound,
  Briefcase,
  Clock,
  CreditCard,
  Settings,
  ExternalLink,
  AlertTriangle,
  Megaphone,
  Menu,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import { logout } from "@/lib/actions/auth";

export const NAV = [
  { href: "/app", label: "Agenda", icon: CalendarDays },
  { href: "/app/clientes", label: "Clientes", icon: Users },
  { href: "/app/riesgo", label: "Riesgo de abandono", icon: AlertTriangle },
  { href: "/app/marketing", label: "Marketing", icon: Megaphone },
  { href: "/app/servicios", label: "Servicios", icon: Briefcase },
  { href: "/app/disponibilidad", label: "Disponibilidad", icon: Clock },
  { href: "/app/equipo", label: "Equipo", icon: UsersRound },
  { href: "/app/facturacion", label: "Plan y facturación", icon: CreditCard },
  { href: "/app/configuracion", label: "Configuración", icon: Settings },
];

function isActive(pathname: string, href: string) {
  return href === "/app" ? pathname === "/app" : pathname.startsWith(href);
}

export function Brand() {
  return (
    <Link href="/app" className="flex items-center gap-2.5">
      <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <CalendarDays className="size-5" />
      </span>
      <span className="font-heading text-lg font-bold tracking-tight">
        AgendaPro
      </span>
    </Link>
  );
}

export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex-1 space-y-1 p-3">
      {NAV.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
            )}
          >
            <item.icon className="size-5 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileNav({
  orgName,
  vertical,
  fullName,
  reservarHref,
}: {
  orgName: string;
  vertical: string;
  fullName: string;
  reservarHref: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Abrir menú">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <SheetTitle className="sr-only">Menú de navegación</SheetTitle>
        <div className="flex h-16 items-center border-b px-4">
          <Brand />
        </div>
        <div className="px-4 py-3">
          <p className="truncate text-sm font-medium">{orgName}</p>
          <p className="text-xs text-muted-foreground">{vertical}</p>
        </div>
        <NavLinks onNavigate={() => setOpen(false)} />
        <div className="space-y-2 border-t p-4">
          <Button variant="outline" size="sm" className="w-full" asChild>
            <Link href={reservarHref} target="_blank">
              <ExternalLink className="mr-2 size-4" />
              Mi página de reservas
            </Link>
          </Button>
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs text-muted-foreground">
              {fullName}
            </span>
            <form action={logout}>
              <Button variant="ghost" size="sm" type="submit">
                <LogOut className="mr-1.5 size-4" />
                Salir
              </Button>
            </form>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
