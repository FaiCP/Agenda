import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { BookingFlow, type BookingInfo } from "./booking-flow";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_public_booking_info", {
    org_slug: slug,
  });
  const info = data as unknown as BookingInfo | null;
  return {
    title: info?.organization
      ? `Reservar cita — ${info.organization.name}`
      : "Reservar cita",
  };
}

export default async function ReservarPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data } = await supabase.rpc("get_public_booking_info", {
    org_slug: slug,
  });
  const info = data as unknown as BookingInfo | null;
  if (!info?.organization) notFound();

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center gap-2 px-4 font-semibold">
          <CalendarDays className="h-5 w-5 text-primary" />
          {info.organization.name}
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        {info.organization.description && (
          <p className="mb-6 text-muted-foreground">
            {info.organization.description}
          </p>
        )}
        <BookingFlow slug={slug} info={info} />
        <p className="mt-8 text-center text-xs text-muted-foreground">
          Al reservar aceptas que tus datos de contacto se usen para gestionar
          tu cita. · Agenda creada con AgendaPro
        </p>
      </main>
    </div>
  );
}
