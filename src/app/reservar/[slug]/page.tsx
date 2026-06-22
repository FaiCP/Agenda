import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  parseBranding,
  templatePreset,
  pageStyle,
  cssUrl,
} from "@/lib/branding";
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

  const org = info.organization;
  const branding = parseBranding(org.branding);
  const preset = templatePreset(branding.template);
  const centered = preset.heroLayout === "centered" && Boolean(branding.cover_url);

  return (
    <div className="min-h-screen bg-muted/40" style={pageStyle(branding)}>
      {centered ? (
        <header className="relative isolate overflow-hidden">
          <div
            className="absolute inset-0 -z-10 bg-cover bg-center"
            style={{ backgroundImage: `url(${cssUrl(branding.cover_url!)})` }}
          />
          <div className="absolute inset-0 -z-10 bg-black/45" />
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 px-4 py-16 text-center text-white">
            {org.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={org.logo_url}
                alt={org.name}
                className="h-16 w-auto rounded-lg bg-white/90 p-1.5 shadow"
              />
            )}
            <h1 className="font-heading text-3xl font-semibold tracking-tight">
              {org.name}
            </h1>
            {org.description && (
              <p className="max-w-prose text-white/90">{org.description}</p>
            )}
          </div>
        </header>
      ) : (
        <>
          <header className="border-b bg-background/80 backdrop-blur">
            <div className="mx-auto flex h-16 w-full max-w-3xl items-center gap-3 px-4 font-semibold">
              {org.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={org.logo_url}
                  alt={org.name}
                  className="h-9 w-auto rounded object-contain"
                />
              ) : (
                <CalendarDays className="h-5 w-5 text-primary" />
              )}
              {org.name}
            </div>
          </header>
          {branding.cover_url && (
            <div className="mx-auto w-full max-w-3xl px-4 pt-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={branding.cover_url}
                alt=""
                className="aspect-[3/1] w-full rounded-xl object-cover shadow-sm"
              />
            </div>
          )}
        </>
      )}

      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        {!centered && org.description && (
          <p className="mb-6 text-muted-foreground">{org.description}</p>
        )}

        {branding.gallery.length > 0 && (
          <div className="mb-8 flex snap-x gap-3 overflow-x-auto pb-2">
            {branding.gallery.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={url}
                alt=""
                className="h-40 w-60 flex-none snap-start rounded-xl object-cover shadow-sm"
              />
            ))}
          </div>
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
