import Link from "next/link";
import { ExternalLink, LogOut } from "lucide-react";
import { getOrgContext } from "@/lib/get-org";
import { logout } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { VERTICALS } from "@/lib/verticals";
import { Brand, NavLinks, MobileNav } from "./app-nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { organization, profile } = await getOrgContext();
  const vertical = VERTICALS[organization.vertical];
  const verticalLabel = `${vertical.icon} ${vertical.label}`;
  const reservarHref = `/reservar/${organization.slug}`;

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-64 flex-col border-r bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex h-16 items-center border-b px-4">
          <Brand />
        </div>
        <div className="px-4 py-3">
          <p className="truncate text-sm font-medium">{organization.name}</p>
          <p className="text-xs text-muted-foreground">{verticalLabel}</p>
        </div>
        <Separator />
        <NavLinks />
        <div className="space-y-2 border-t p-4">
          <Button variant="outline" size="sm" className="w-full" asChild>
            <Link href={reservarHref} target="_blank">
              <ExternalLink className="mr-2 size-4" />
              Mi página de reservas
            </Link>
          </Button>
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs text-muted-foreground">
              {profile.full_name}
            </span>
            <form action={logout}>
              <Button variant="ghost" size="sm" type="submit">
                <LogOut className="mr-1.5 size-4" />
                Salir
              </Button>
            </form>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-2 border-b bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/80 md:hidden">
          <div className="flex items-center gap-2">
            <MobileNav
              orgName={organization.name}
              vertical={verticalLabel}
              fullName={profile.full_name}
              reservarHref={reservarHref}
            />
            <Brand />
          </div>
        </header>
        <main className="min-w-0 flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
