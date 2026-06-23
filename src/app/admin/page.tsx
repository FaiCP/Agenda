import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminView } from "./admin-view";

export const metadata: Metadata = { title: "Administración" };

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_superadmin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_superadmin) redirect("/app");

  const [organizations, pendingPayments] = await Promise.all([
    supabase
      .from("organizations")
      .select("*, subscriptions(status, plans(name))")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("payments")
      .select("*, organizations(name), plans(name)")
      .eq("status", "pending_review")
      .order("created_at"),
  ]);

  // URLs firmadas para ver comprobantes
  const paymentsWithUrls = await Promise.all(
    (pendingPayments.data ?? []).map(async (p) => {
      let receiptUrl: string | null = null;
      if (p.receipt_path) {
        const { data } = await supabase.storage
          .from("receipts")
          .createSignedUrl(p.receipt_path, 60 * 30);
        receiptUrl = data?.signedUrl ?? null;
      }
      return { ...p, receiptUrl };
    })
  );

  // `subscriptions` es relación uno-a-uno (objeto), pero AdminView la consume
  // como arreglo; normalizamos para mantener esa forma.
  const orgs = (organizations.data ?? []).map((o) => ({
    ...o,
    subscriptions: o.subscriptions ? [o.subscriptions] : [],
  }));

  return (
    <AdminView organizations={orgs} pendingPayments={paymentsWithUrls} />
  );
}
