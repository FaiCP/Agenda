import Link from "next/link";
import {
  CalendarDays,
  Users,
  Briefcase,
  Clock,
  CreditCard,
  Settings,
  ExternalLink,
  AlertTriangle,
  Megaphone,
} from "lucide-react";
import { getOrgContext } from "@/lib/get-org";
import { logout } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { VERTICALS } from "@/lib/verticals";

const NAV = [
  { href: "/app", label: "Agenda", icon: CalendarDays },
  { href: "/app/clientes", label: "Clientes", icon: Users },
  { href: "/app/riesgo", label: "Riesgo de abandono", icon: AlertTriangle },
  { href: "/app/marketing", label: "Marketing", icon: Megaphone },
  { href: "/app/servicios", label: "Servicios", icon: Briefcase },
  { href: "/app/disponibilidad", label: "Disponibilidad", icon: Clock },
  { href: "/app/facturacion", label: "Plan y facturación", icon: CreditCard },
  { href: "/app/configuracion", label: "Configuración", icon: Settings },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { organization, profile } = await getOrgContext();
  const vertical = VERTICALS[organization.vertical];

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 flex-col border-r bg-muted/30 md:flex">
        <div className="flex h-16 items-center gap-2 border-b px-4 font-semibold">
          <CalendarDays className="h-5 w-5 text-primary" />
          AgendaPro
        </div>
        <div className="px-4 py-3">
          <p className="truncate text-sm font-medium">{organization.name}</p>
          <p className="text-xs text-muted-foreground">
            {vertical.icon} {vertical.label}
          </p>
        </div>
        <Separator />
        <nav className="flex-1 space-y-1 p-2">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="space-y-2 border-t p-4">
          <Button variant="outline" size="sm" className="w-full" asChild>
            <Link href={`/reservar/${organization.slug}`} target="_blank">
              <ExternalLink className="mr-2 h-4 w-4" />
              Mi página de reservas
            </Link>
          </Button>
          <div className="flex items-center justify-between">
            <span className="truncate text-xs text-muted-foreground">
              {profile.full_name}
            </span>
            <form action={logout}>
              <Button variant="ghost" size="sm" type="submit">
                Salir
              </Button>
            </form>
          </div>
        </div>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b px-4 md:hidden">
          <span className="font-semibold">{organization.name}</span>
          <form action={logout}>
            <Button variant="ghost" size="sm" type="submit">
              Salir
            </Button>
          </form>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
