-- Personalización de la página pública de reservas.
-- Todo el branding (plantilla, colores, portada, fondo, galería) vive en un
-- único JSON para no requerir migraciones por cada nuevo campo.
alter table public.organizations
  add column if not exists branding jsonb not null default '{}'::jsonb;

-- Reusamos el bucket público `logos` para todas las imágenes de branding
-- (logo, portada, galería). Falta permitir borrar (p.ej. quitar foto de galería).
drop policy if exists logos_delete_members on storage.objects;
create policy logos_delete_members on storage.objects
  for delete
  using (bucket_id = 'logos' and is_org_member(((storage.foldername(name))[1])::uuid));

-- RPC pública: añadimos `branding` al objeto organization (logo_url ya estaba).
create or replace function public.get_public_booking_info(org_slug text)
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select jsonb_build_object(
    'organization', jsonb_build_object(
      'id', o.id, 'name', o.name, 'slug', o.slug, 'vertical', o.vertical,
      'timezone', o.timezone, 'logo_url', o.logo_url, 'phone', o.phone,
      'address', o.address, 'description', o.description,
      'branding', coalesce(o.branding, '{}'::jsonb)
    ),
    'services', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'name', s.name, 'description', s.description,
        'duration_minutes', s.duration_minutes, 'price', s.price, 'modality', s.modality
      ) order by s.name)
      from services s
      where s.organization_id = o.id and s.active and s.allow_public_booking
    ), '[]'::jsonb),
    'professionals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.profile_id,
        'name', coalesce(nullif(m.display_name, ''), p.full_name)
      ) order by p.full_name)
      from organization_members m
      join profiles p on p.id = m.profile_id
      where m.organization_id = o.id and m.accepts_appointments
        and m.role in ('owner','professional')
    ), '[]'::jsonb)
  )
  from organizations o
  where o.slug = org_slug and o.booking_enabled;
$function$;
