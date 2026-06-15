"use client";

import Link from "next/link";
import { useActionState } from "react";
import { User, Mail, Lock } from "lucide-react";
import { signup, type AuthState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { IconInput, PasswordInput } from "../auth-ui";

const initialState: AuthState = { error: null };

export function RegistroForm() {
  const [state, formAction, pending] = useActionState(signup, initialState);

  return (
    <Card className="p-2">
      <CardHeader className="items-center text-center">
        <CardTitle className="font-heading text-2xl">Crear cuenta</CardTitle>
        <CardDescription>
          Únete a la plataforma de gestión más eficiente.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="full_name">Nombre completo</Label>
            <IconInput
              icon={User}
              id="full_name"
              name="full_name"
              required
              autoComplete="name"
              placeholder="Dra. María Pérez"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Correo electrónico</Label>
            <IconInput
              icon={Mail}
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="ejemplo@agendapro.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Contraseña</Label>
            <PasswordInput
              icon={Lock}
              id="password"
              name="password"
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="••••••••"
            />
            <p className="text-xs text-muted-foreground">Mínimo 8 caracteres</p>
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
            {pending ? "Creando cuenta…" : "Crear cuenta"}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          ¿Ya tienes una cuenta?{" "}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            Inicia sesión
          </Link>
        </p>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Al registrarte obtienes acceso inmediato. Sin tarjeta de crédito, sin
          compromisos.
        </p>
      </CardContent>
    </Card>
  );
}
