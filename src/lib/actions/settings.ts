"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgContext } from "@/lib/get-org";
import {
  parseBranding,
  isHexColor,
  TEMPLATES,
  type Branding,
  type BackgroundType,
  type TemplateId,
} from "@/lib/branding";
import type { Json } from "@/lib/supabase/database.types";
import type { ActionState } from "./appointments";

// Las subidas a storage usan el cliente admin (service_role) porque la autz ya
// se valida en código (role === "owner") y el path va scoped a organization.id.
// El cliente de usuario (con sesión) se reserva para el UPDATE protegido por RLS.
type StorageClient = ReturnType<typeof createAdminClient>;

const BRANDING_BUCKET = "logos";
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const MAX_GALLERY = 8;
const IMAGE_RE = /^image\/(png|jpe?g|webp)$/;

function isImage(f: File): boolean {
  return f.size > 0 && f.size <= MAX_IMAGE_BYTES && IMAGE_RE.test(f.type);
}

/** Sube una imagen de branding al bucket público `logos` y devuelve su URL. */
async function uploadBrandingImage(
  supabase: StorageClient,
  orgId: string,
  file: File,
  kind: string
): Promise<{ url: string | null; error: string | null }> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${orgId}/branding/${kind}-${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(BRANDING_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true });
  if (error) {
    console.error(`[branding] upload ${kind} falló:`, error.message);
    return { url: null, error: error.message };
  }
  return {
    url: supabase.storage.from(BRANDING_BUCKET).getPublicUrl(path).data
      .publicUrl,
    error: null,
  };
}

/** Extrae el path interno desde una URL pública del bucket, o null si no es nuestra. */
function pathFromPublicUrl(url: string, orgId: string): string | null {
  const marker = `/${BRANDING_BUCKET}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;
  const path = decodeURIComponent(url.slice(i + marker.length));
  // Solo borramos archivos dentro de la carpeta de la propia organización.
  return path.startsWith(`${orgId}/`) ? path : null;
}

async function removeFiles(
  supabase: StorageClient,
  orgId: string,
  urls: string[]
): Promise<void> {
  const paths = urls
    .map((u) => pathFromPublicUrl(u, orgId))
    .filter((p): p is string => Boolean(p));
  if (paths.length > 0) {
    await supabase.storage.from(BRANDING_BUCKET).remove(paths);
  }
}

export async function saveBranding(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { organization, role } = await getOrgContext();
  if (role !== "owner")
    return { error: "Solo el propietario puede personalizar la página." };

  const supabase = await createClient();
  const storage = createAdminClient(); // solo para subir/borrar archivos
  const current = parseBranding(organization.branding);
  const orphan: string[] = []; // archivos a borrar al final (reemplazados/quitados)

  // Plantilla
  const tplRaw = String(formData.get("template") ?? "");
  const template: TemplateId = TEMPLATES.some((t) => t.id === tplRaw)
    ? (tplRaw as TemplateId)
    : current.template;

  // Color de marca (vacío = usar el de la plantilla)
  const colorRaw = String(formData.get("brand_color") ?? "").trim();
  const brand_color = isHexColor(colorRaw) ? colorRaw : null;

  // Logo (columna propia organizations.logo_url)
  let logoUrl = organization.logo_url;
  if (formData.get("logo_remove") === "on") {
    if (logoUrl) orphan.push(logoUrl);
    logoUrl = null;
  }
  const logoFile = formData.get("logo");
  if (logoFile instanceof File && logoFile.size > 0) {
    if (!isImage(logoFile))
      return { error: "El logo debe ser JPG, PNG o WebP (máx 6 MB)." };
    const up = await uploadBrandingImage(storage, organization.id, logoFile, "logo");
    if (!up.url) return { error: `No se pudo subir el logo: ${up.error}` };
    if (organization.logo_url) orphan.push(organization.logo_url);
    logoUrl = up.url;
  }

  // Portada (hero)
  let cover_url = current.cover_url;
  if (formData.get("cover_remove") === "on") {
    if (cover_url) orphan.push(cover_url);
    cover_url = null;
  }
  const coverFile = formData.get("cover");
  if (coverFile instanceof File && coverFile.size > 0) {
    if (!isImage(coverFile))
      return { error: "La portada debe ser JPG, PNG o WebP (máx 6 MB)." };
    const up = await uploadBrandingImage(storage, organization.id, coverFile, "cover");
    if (!up.url) return { error: `No se pudo subir la portada: ${up.error}` };
    if (current.cover_url) orphan.push(current.cover_url);
    cover_url = up.url;
  }

  // Fondo
  const bgTypeRaw = String(formData.get("bg_type") ?? "default");
  const bgType: BackgroundType =
    bgTypeRaw === "color" || bgTypeRaw === "image" ? bgTypeRaw : "default";
  let background: Branding["background"] = { type: "default", value: null };
  if (bgType === "color") {
    const bgColor = String(formData.get("bg_color") ?? "").trim();
    background = {
      type: "color",
      value: isHexColor(bgColor) ? bgColor : null,
    };
  } else if (bgType === "image") {
    let bgValue = current.background.type === "image" ? current.background.value : null;
    const bgFile = formData.get("bg_image");
    if (bgFile instanceof File && bgFile.size > 0) {
      if (!isImage(bgFile))
        return { error: "El fondo debe ser JPG, PNG o WebP (máx 6 MB)." };
      const up = await uploadBrandingImage(storage, organization.id, bgFile, "bg");
      if (!up.url) return { error: `No se pudo subir el fondo: ${up.error}` };
      if (current.background.type === "image" && current.background.value)
        orphan.push(current.background.value);
      bgValue = up.url;
    }
    background = { type: "image", value: bgValue };
  } else {
    // Cambió a default: descarta imagen de fondo anterior
    if (current.background.type === "image" && current.background.value)
      orphan.push(current.background.value);
  }

  // Galería: conserva las marcadas + agrega nuevas
  const kept = formData
    .getAll("gallery_keep")
    .map((v) => String(v))
    .filter((u) => current.gallery.includes(u));
  const removedGallery = current.gallery.filter((u) => !kept.includes(u));
  orphan.push(...removedGallery);

  const newPhotos = formData
    .getAll("gallery_new")
    .filter((f): f is File => f instanceof File && f.size > 0);
  if (newPhotos.length > 0 && !newPhotos.every(isImage))
    return { error: "Las fotos deben ser JPG, PNG o WebP (máx 6 MB)." };

  const gallery = [...kept];
  for (const photo of newPhotos) {
    if (gallery.length >= MAX_GALLERY) break;
    const up = await uploadBrandingImage(storage, organization.id, photo, "gallery");
    if (up.url) gallery.push(up.url);
  }

  const branding: Branding = {
    template,
    brand_color,
    cover_url,
    background,
    gallery,
  };

  const { error } = await supabase
    .from("organizations")
    .update({ branding: branding as unknown as Json, logo_url: logoUrl })
    .eq("id", organization.id);
  if (error) return { error: "No se pudo guardar la personalización." };

  // Borra archivos reemplazados/eliminados (best-effort, no bloquea el guardado)
  await removeFiles(storage, organization.id, orphan);

  revalidatePath("/app/configuracion");
  revalidatePath(`/reservar/${organization.slug}`);
  return { error: null, success: true };
}

export async function updateOrganization(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { organization, role } = await getOrgContext();
  if (role !== "owner")
    return { error: "Solo el propietario puede editar la organización." };

  const supabase = await createClient();
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const address = String(formData.get("address") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim() || null;
  const bookingEnabled = formData.get("booking_enabled") === "on";

  if (name.length < 3) return { error: "Nombre demasiado corto." };

  const { error } = await supabase
    .from("organizations")
    .update({ name, phone, address, description, booking_enabled: bookingEnabled })
    .eq("id", organization.id);

  if (error) return { error: "No se pudo guardar." };

  revalidatePath("/app/configuracion");
  return { error: null, success: true };
}
