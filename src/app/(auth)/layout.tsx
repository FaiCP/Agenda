import Link from "next/link";
import { CalendarDays } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <Link href="/" className="mb-6 flex flex-col items-center gap-3">
        <span className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <CalendarDays className="size-6" />
        </span>
        <span className="text-center">
          <span className="block font-heading text-2xl font-bold tracking-tight">
            AgendaPro
          </span>
          <span className="block text-sm text-muted-foreground">
            Gestiona tu agenda de forma profesional
          </span>
        </span>
      </Link>
      <div className="w-full max-w-md">{children}</div>
      <footer className="mt-6 text-xs text-muted-foreground">
        AgendaPro — Hecho para profesionales en Ecuador 🇪🇨
      </footer>
    </div>
  );
}
