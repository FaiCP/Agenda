import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Configura tu consulta" };

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Si ya tiene organización, directo al panel
  const { data: membership } = await supabase
    .from("organization_members")
    .select("id")
    .eq("profile_id", user.id)
    .limit(1)
    .maybeSingle();
  if (membership) redirect("/app");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 px-4 py-10">
      <div className="mb-6 flex items-center gap-2 text-xl font-semibold">
        <CalendarDays className="h-6 w-6 text-primary" />
        AgendaPro
      </div>
      <OnboardingForm />
    </div>
  );
}
