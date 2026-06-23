-- Fase 2 del Agente de Marketing: calendario semanal y reutilización 1→N.
alter type public.marketing_kind add value if not exists 'calendar';
alter type public.marketing_kind add value if not exists 'repurpose';
