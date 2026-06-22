"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, ImagePlus } from "lucide-react";
import { saveBranding } from "@/lib/actions/settings";
import type { ActionState } from "@/lib/actions/appointments";
import type { Tables } from "@/lib/supabase/database.types";
import {
  parseBranding,
  templatePreset,
  TEMPLATES,
  type BackgroundType,
} from "@/lib/branding";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const initialState: ActionState = { error: null };

export function BrandingEditor({
  organization,
  bookingUrl,
}: {
  organization: Tables<"organizations">;
  bookingUrl: string;
}) {
  const initial = parseBranding(organization.branding);
  const [state, formAction, pending] = useActionState(saveBranding, initialState);
  const [template, setTemplate] = useState(initial.template);
  const [color, setColor] = useState(
    initial.brand_color ?? templatePreset(initial.template).defaultColor
  );
  const [bgType, setBgType] = useState<BackgroundType>(initial.background.type);
  const [bgColor, setBgColor] = useState(
    initial.background.type === "color" && initial.background.value
      ? initial.background.value
      : "#f3f4f6"
  );

  useEffect(() => {
    if (state.success) toast.success("Página personalizada guardada");
  }, [state]);

  return (
    <Card>
      <CardContent className="space-y-8 pt-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-heading text-lg font-semibold">
              Personaliza tu página
            </h2>
            <p className="text-sm text-muted-foreground">
              Logo, colores, portada y fotos visibles para tus clientes.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <a href={bookingUrl} target="_blank" rel="noopener noreferrer">
              Ver mi página <ExternalLink className="ml-1 size-3.5" />
            </a>
          </Button>
        </div>

        <form action={formAction} className="space-y-8">
          {/* Plantilla */}
          <fieldset className="space-y-3">
            <Label>Plantilla</Label>
            <input type="hidden" name="template" value={template} />
            <div className="grid gap-3 sm:grid-cols-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setTemplate(t.id);
                    if (!initial.brand_color) setColor(t.defaultColor);
                  }}
                  className={cn(
                    "rounded-lg border p-3 text-left transition-colors hover:bg-accent",
                    template === t.id && "border-primary bg-accent"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="size-4 rounded-full border"
                      style={{ backgroundColor: t.defaultColor }}
                    />
                    <span className="font-medium">{t.name}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t.description}
                  </p>
                </button>
              ))}
            </div>
          </fieldset>

          {/* Color de marca */}
          <fieldset className="space-y-2">
            <Label htmlFor="brand_color">Color de marca</Label>
            <div className="flex items-center gap-3">
              <input
                id="brand_color"
                name="brand_color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-10 w-16 cursor-pointer rounded border bg-transparent"
              />
              <code className="text-sm text-muted-foreground">{color}</code>
            </div>
            <p className="text-xs text-muted-foreground">
              Tiñe botones y acentos de tu página.
            </p>
          </fieldset>

          {/* Logo */}
          <fieldset className="space-y-2">
            <Label htmlFor="logo">Logo</Label>
            {organization.logo_url && (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={organization.logo_url}
                  alt="Logo actual"
                  className="h-12 w-auto rounded border bg-white object-contain p-1"
                />
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input type="checkbox" name="logo_remove" /> Quitar logo
                </label>
              </div>
            )}
            <Input id="logo" name="logo" type="file" accept="image/png,image/jpeg,image/webp" />
            <p className="text-xs text-muted-foreground">
              Formato JPG, PNG o WebP. Peso máximo 6 MB. Recomendado: imagen
              cuadrada de al menos 256×256 px (ideal 512×512), PNG con fondo
              transparente para que se vea bien sobre cualquier color.
            </p>
          </fieldset>

          {/* Portada */}
          <fieldset className="space-y-2">
            <Label htmlFor="cover">Imagen de portada (banner)</Label>
            {initial.cover_url && (
              <div className="space-y-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={initial.cover_url}
                  alt="Portada actual"
                  className="aspect-[3/1] w-full max-w-md rounded-lg border object-cover"
                />
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input type="checkbox" name="cover_remove" /> Quitar portada
                </label>
              </div>
            )}
            <Input id="cover" name="cover" type="file" accept="image/png,image/jpeg,image/webp" />
            <p className="text-xs text-muted-foreground">
              Recomendado 1200×400 px. En plantillas Elegante y Moderno aparece
              a pantalla completa con tu nombre encima.
            </p>
          </fieldset>

          {/* Fondo */}
          <fieldset className="space-y-3">
            <Label htmlFor="bg_type">Fondo de la página</Label>
            <select
              id="bg_type"
              name="bg_type"
              value={bgType}
              onChange={(e) => setBgType(e.target.value as BackgroundType)}
              className="h-10 w-full max-w-xs rounded-md border bg-background px-3 text-sm"
            >
              <option value="default">Por defecto (gris claro)</option>
              <option value="color">Color sólido</option>
              <option value="image">Imagen</option>
            </select>
            {bgType === "color" && (
              <div className="flex items-center gap-3">
                <input
                  name="bg_color"
                  type="color"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="h-10 w-16 cursor-pointer rounded border bg-transparent"
                />
                <code className="text-sm text-muted-foreground">{bgColor}</code>
              </div>
            )}
            {bgType === "image" && (
              <Input
                name="bg_image"
                type="file"
                accept="image/png,image/jpeg,image/webp"
              />
            )}
          </fieldset>

          {/* Galería */}
          <fieldset className="space-y-3">
            <Label>Galería de fotos</Label>
            {initial.gallery.length > 0 && (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {initial.gallery.map((url, i) => (
                  <label key={i} className="group relative cursor-pointer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt=""
                      className="aspect-square w-full rounded-lg border object-cover transition group-has-[:checked]:opacity-100 opacity-40"
                    />
                    <input
                      type="checkbox"
                      name="gallery_keep"
                      value={url}
                      defaultChecked
                      className="absolute right-1.5 top-1.5 size-4"
                    />
                  </label>
                ))}
              </div>
            )}
            {initial.gallery.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Desmarca una foto para quitarla al guardar.
              </p>
            )}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ImagePlus className="size-4" />
              <Input
                name="gallery_new"
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Hasta 8 fotos del local. Máx 6 MB cada una.
            </p>
          </fieldset>

          {state.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}
          <div className="flex justify-end border-t pt-4">
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : "Guardar personalización"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
