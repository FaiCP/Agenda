import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mensaje?: string; next?: string }>;
}) {
  const { mensaje, next } = await searchParams;
  return <LoginForm mensaje={mensaje} next={next} />;
}
