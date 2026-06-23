-- Agente de Marketing: persistencia del contenido generado por IA.
-- payload jsonb guarda la estructura según el tipo (guion+variaciones, lote de
-- ideas, post completo, o campaña basada en agenda).
create type public.marketing_kind as enum ('script', 'idea_batch', 'post', 'campaign');

create table public.marketing_content (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  kind public.marketing_kind not null,
  title text,
  platform text,
  goal text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  created_at timestamptz not null default now()
);

create index marketing_content_org_created_idx
  on public.marketing_content (organization_id, created_at desc);

alter table public.marketing_content enable row level security;

create policy marketing_content_select on public.marketing_content
  for select using (is_org_member(organization_id));
create policy marketing_content_insert on public.marketing_content
  for insert with check (is_org_member(organization_id));
create policy marketing_content_update on public.marketing_content
  for update using (is_org_member(organization_id))
  with check (is_org_member(organization_id));
create policy marketing_content_delete on public.marketing_content
  for delete using (is_org_member(organization_id));

-- Cuota mensual de generaciones IA del agente de marketing (plan Premium).
update public.plans
  set features = features || '{"marketing_ai_monthly": 60}'::jsonb
  where code = 'premium';
