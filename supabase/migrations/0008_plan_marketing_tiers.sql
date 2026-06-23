-- Reestructura de funciones de marketing por plan.
-- Flags granulares: mkt_ideas (Ideas), mkt_create (guion/calendario/reutilizar/
-- ideas->post), mkt_agenda (campañas desde la agenda, solo Premium).
-- ai_features se conserva para la IA clínica (dictado, documentos, riesgo).

update public.plans
  set features = features || '{"mkt_ideas": true, "marketing_ai_monthly": 10}'::jsonb
  where code = 'free';

update public.plans
  set features = features || '{"mkt_ideas": true, "mkt_create": true, "marketing_ai_monthly": 50}'::jsonb
  where code = 'pro';

update public.plans
  set features = features || '{"mkt_ideas": true, "mkt_create": true, "mkt_agenda": true, "marketing_ai_monthly": 200}'::jsonb
  where code = 'premium';
