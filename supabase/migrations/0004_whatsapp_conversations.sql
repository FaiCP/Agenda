-- Memoria de conversaciones del bot de WhatsApp (1 por chat por org).
create table if not exists public.whatsapp_conversations (
  organization_id uuid not null
    references public.organizations (id) on delete cascade,
  chat_id    text not null,
  state      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (organization_id, chat_id)
);

alter table public.whatsapp_conversations enable row level security;
-- Solo el servidor (service_role) accede; sin políticas públicas.
