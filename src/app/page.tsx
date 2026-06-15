import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  CalendarDays,
  FolderOpen,
  Globe,
  BellRing,
  Users,
  ShieldCheck,
} from "lucide-react";
import { VERTICALS } from "@/lib/verticals";

const FEATURES = [
  {
    icon: CalendarDays,
    title: "Agenda inteligente",
    description:
      "Calendario por profesional con citas, reagendados y control de estados.",
  },
  {
    icon: Globe,
    title: "Reservas online",
    description:
      "Tu propia página pública para que tus pacientes o clientes agenden solos, 24/7.",
  },
  {
    icon: FolderOpen,
    title: "Expedientes digitales",
    description:
      "Historias clínicas, expedientes legales o fichas de tratamiento según tu profesión.",
  },
  {
    icon: BellRing,
    title: "Recordatorios automáticos",
    description: "Reduce inasistencias con recordatorios por correo.",
  },
  {
    icon: Users,
    title: "Equipo y roles",
    description:
      "Profesionales y recepción con permisos separados en una sola cuenta.",
  },
  {
    icon: ShieldCheck,
    title: "Datos protegidos",
    description:
      "Aislamiento por organización y cifrado en reposo para datos sensibles.",
  },
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <CalendarDays className="h-5 w-5 text-primary" />
            AgendaPro
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2">
            <Button variant="ghost" className="hidden sm:inline-flex" asChild>
              <Link href="/precios">Precios</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/login">Iniciar sesión</Link>
            </Button>
            <Button asChild>
              <Link href="/registro">
                <span className="sm:hidden">Crear cuenta</span>
                <span className="hidden sm:inline">Crear cuenta gratis</span>
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto w-full max-w-6xl px-4 py-20 text-center">
          <h1 className="mx-auto max-w-3xl font-heading text-4xl font-bold tracking-tight sm:text-5xl">
            Citas y expedientes de tu consulta, en un solo lugar
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Para médicos, abogados, psicólogos, odontólogos y todo profesional
            que atiende con cita. Agenda online, expedientes digitales y
            recordatorios automáticos.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button size="lg" asChild>
              <Link href="/registro">Comenzar gratis</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/precios">Ver planes</Link>
            </Button>
          </div>
          <div className="mt-10 flex flex-wrap justify-center gap-2 text-sm text-muted-foreground">
            {Object.values(VERTICALS).map((v) => (
              <span key={v.label} className="rounded-full border px-3 py-1">
                {v.icon} {v.label}
              </span>
            ))}
          </div>
        </section>

        <section className="border-t bg-muted/40">
          <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-16 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <Card key={f.title}>
                <CardHeader>
                  <f.icon className="h-8 w-8 text-primary" />
                  <CardTitle className="mt-2">{f.title}</CardTitle>
                  <CardDescription>{f.description}</CardDescription>
                </CardHeader>
                <CardContent />
              </Card>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        AgendaPro — Hecho para profesionales en Ecuador 🇪🇨
      </footer>
    </div>
  );
}
