-- Reestructura de precios basada en el costo real del bot de WhatsApp.
--
-- Driver de costo: el bot usa OpenWA (WhatsApp Web + Chromium en Google Cloud),
-- una instancia persistente por negocio conectado (~$10/mes/sesión). El LLM es
-- marginal. Por eso el bot se gatea con una feature nueva y vive en planes pagos.
--
-- Niveles resultantes:
--   * Gratis   $0  — solo página pública de reservas, 1 prof, 20 citas/mes. SIN bot.
--   * Inicial  $8  — bot WhatsApp + reservas + Marketing IA ideas (10/mes). 1 prof.
--   * Pro      $25 — + 3 prof, recordatorios por correo, Marketing IA crear (50/mes).
--   * Premium  $49 — + 10 prof, IA clínica, campañas desde agenda (200/mes), renders.
--
-- Nueva feature: "whatsapp_bot" (boolean). Gatea conexión y procesamiento del bot.
-- NOTA: max_appointments_per_month es informativo (no se fuerza aún en la creación
-- de citas). El límite de profesionales sí se aplica (lib/actions/team.ts).

-- Gratis: sin bot, sin marketing, 20 citas/mes.
update public.plans set
  price_monthly = 0,
  max_professionals = 1,
  max_appointments_per_month = 20,
  features = (features - 'mkt_create' - 'mkt_agenda')
    || '{"public_booking": true, "whatsapp_bot": false, "ai_features": false, "email_reminders": false, "mkt_ideas": false, "marketing_ai_monthly": 0}'::jsonb
where code = 'free';

-- Inicial $8: plan gancho con bot WhatsApp + ideas de marketing.
insert into public.plans
  (code, name, price_monthly, max_professionals, max_appointments_per_month, active, features)
values (
  'inicial', 'Inicial', 8, 1, null, true,
  '{"public_booking": true, "whatsapp_bot": true, "ai_features": false, "email_reminders": false, "mkt_ideas": true, "mkt_create": false, "mkt_agenda": false, "marketing_ai_monthly": 10}'::jsonb
)
on conflict (code) do update set
  name = excluded.name,
  price_monthly = excluded.price_monthly,
  max_professionals = excluded.max_professionals,
  max_appointments_per_month = excluded.max_appointments_per_month,
  active = excluded.active,
  features = public.plans.features || excluded.features;

-- Pro $25: incluye bot.
update public.plans set
  price_monthly = 25,
  features = features || '{"whatsapp_bot": true}'::jsonb
where code = 'pro';

-- Premium $49: incluye bot.
update public.plans set
  price_monthly = 49,
  features = features || '{"whatsapp_bot": true}'::jsonb
where code = 'premium';
