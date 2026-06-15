"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Mail, Lock } from "lucide-react";
import { login, type AuthState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { IconInput, PasswordInput } from "../auth-ui";

const initialState: AuthState = { error: null };

export function LoginForm({
  mensaje,
}: {
  mensaje?: string;
  next?: string;
}) {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <Card className="p-2">
      <CardHeader>
        <CardTitle className="font-heading text-2xl">Iniciar sesión</CardTitle>
      </CardHeader>
      <CardContent>
        {mensaje === "confirma-correo" && (
          <Alert className="mb-4">
            <AlertDescription>
              Te enviamos un correo de confirmación. Revisa tu bandeja antes de
              iniciar sesión.
            </AlertDescription>
          </Alert>
        )}
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Correo electrónico</Label>
            <IconInput
              icon={Mail}
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="nombre@clinica.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <PasswordInput
              icon={Lock}
              id="password"
              name="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </div>
          {state.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}
          <Button
            type="submit"
            className="w-full rounded-full"
            size="lg"
            disabled={pending}
          >
            {pending ? "Ingresando…" : "Iniciar sesión"}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          ¿No tienes una cuenta?{" "}
          <Link href="/registro" className="font-semibold text-primary hover:underline">
            Crear cuenta
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
