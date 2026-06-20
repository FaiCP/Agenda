-- Conexión WhatsApp por organización (multi-tenant).
-- Cada org conecta SU propio número escaneando un QR contra el gateway OpenWA.
-- El gateway guarda la sesión real (credenciales Baileys); aquí solo el estado.

create table if not exists public.whatsapp_connections (
  organization_id uuid primary key
    references public.organizations (id) on delete cascade,
  session_id   text not null,
  -- disconnected | connecting | connected | failed
  status       text not null default 'disconnected',
  phone        text,
  last_qr_at   timestamptz,
  connected_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- updated_at automático
create or replace function public.touch_whatsapp_connections()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_whatsapp_connections on public.whatsapp_connections;
create trigger trg_touch_whatsapp_connections
  before update on public.whatsapp_connections
  for each row execute function public.touch_whatsapp_connections();

-- RLS
alter table public.whatsapp_connections enable row level security;

-- Miembros de la org pueden ver el estado
drop policy if exists "members read whatsapp" on public.whatsapp_connections;
create policy "members read whatsapp"
  on public.whatsapp_connections for select
  using (
    exists (
      select 1 from public.organization_members m
      where m.organization_id = whatsapp_connections.organization_id
        and m.profile_id = auth.uid()
    )
  );

-- Solo el owner gestiona (insert/update/delete)
drop policy if exists "owner manage whatsapp" on public.whatsapp_connections;
create policy "owner manage whatsapp"
  on public.whatsapp_connections for all
  using (
    exists (
      select 1 from public.organization_members m
      where m.organization_id = whatsapp_connections.organization_id
        and m.profile_id = auth.uid()
        and m.role = 'owner'
    )
  )
  with check (
    exists (
      select 1 from public.organization_members m
      where m.organization_id = whatsapp_connections.organization_id
        and m.profile_id = auth.uid()
        and m.role = 'owner'
    )
  );
