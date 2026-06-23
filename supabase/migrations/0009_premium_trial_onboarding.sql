-- Trial Premium de 1 mes para organizaciones nuevas.
--
-- Decisiones de diseño:
--  * La suscripción de trial se crea sobre el plan PREMIUM con status='active'
--    y current_period_end = now() + 1 mes. Se usa 'active' (no 'trialing')
--    a propósito: los helpers de src/lib/features.ts solo consideran activa una
--    feature cuando status='active', e ignoran current_period_end. Usar 'active'
--    hace que TODAS las funciones premium estén disponibles durante el trial sin
--    tener que tocar esos helpers (menor riesgo, sin choques con otros parches).
--  * La expiración se maneja en la base de datos con expire_trials() + pg_cron
--    (diario). Al pasar current_period_end, la suscripción se degrada al plan
--    'free' (status='active', current_period_end=null), igual que como lucen hoy
--    las orgs gratis. Así los helpers, que leen plan_id en vivo, devuelven las
--    features del plan free automáticamente. No depende del cron de la app
--    (Vercel) ni requiere modificar features.ts.
--  * No rompe orgs existentes: las suscripciones premium/pro vigentes tienen
--    current_period_end en el futuro y no se tocan hasta que realmente expiren;
--    las gratis tienen current_period_end=null y quedan excluidas del barrido.

-- 1) Onboarding: org nueva -> trial Premium de 1 mes.
create or replace function public.create_organization(
  p_name text,
  p_vertical vertical_type,
  p_phone text,
  p_client_label text,
  p_create_examples boolean,
  p_example_services jsonb
)
returns organizations
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user uuid := auth.uid();
  v_base_slug text;
  v_slug text;
  v_org organizations;
  v_premium_plan_id uuid;
  v_free_plan_id uuid;
  v_trial_plan_id uuid;
begin
  if v_user is null then
    raise exception 'No autenticado';
  end if;

  v_base_slug := regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g');
  v_base_slug := regexp_replace(v_base_slug, '^-+|-+$', '', 'g');
  if v_base_slug = '' then
    v_base_slug := 'consulta';
  end if;
  v_base_slug := substring(v_base_slug from 1 for 50);
  v_slug := v_base_slug;

  if exists (select 1 from organizations where slug = v_slug) then
    v_slug := v_base_slug || '-' || substr(md5(random()::text), 1, 4);
  end if;

  insert into organizations (name, slug, vertical, phone, client_label)
  values (p_name, v_slug, p_vertical, p_phone, p_client_label)
  returning * into v_org;

  insert into organization_members (organization_id, profile_id, role)
  values (v_org.id, v_user, 'owner');

  -- Trial: Premium por 1 mes. Si no existiera el plan premium, cae a free.
  select id into v_premium_plan_id from plans where code = 'premium';
  select id into v_free_plan_id from plans where code = 'free';
  v_trial_plan_id := coalesce(v_premium_plan_id, v_free_plan_id);

  if v_trial_plan_id is not null then
    insert into subscriptions (
      organization_id, plan_id, status,
      current_period_start, current_period_end
    )
    values (
      v_org.id,
      v_trial_plan_id,
      'active',
      now(),
      case when v_premium_plan_id is not null
           then now() + interval '1 month'
           else null end
    );
  end if;

  if p_create_examples then
    insert into services (organization_id, name, duration_minutes, price)
    select v_org.id, s->>'name', (s->>'duration_minutes')::int, (s->>'price')::numeric
    from jsonb_array_elements(p_example_services) s;

    insert into availability_rules (organization_id, professional_id, weekday, start_time, end_time)
    select v_org.id, v_user, w, '09:00', '17:00'
    from unnest(array[1,2,3,4,5]) as w;
  end if;

  return v_org;
end;
$function$;

-- 2) Expiración: degradar a Gratis las suscripciones cuyo periodo ya pasó.
--    Aplica a cualquier plan de pago (premium/pro) cuyo current_period_end
--    quedó en el pasado y que aún no esté en el plan free. Idempotente.
create or replace function public.expire_trials()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_free_plan_id uuid;
  v_count integer;
begin
  select id into v_free_plan_id from plans where code = 'free';
  if v_free_plan_id is null then
    return 0;
  end if;

  with downgraded as (
    update subscriptions s
       set plan_id = v_free_plan_id,
           status = 'active',
           current_period_start = now(),
           current_period_end = null
     where s.plan_id <> v_free_plan_id
       and s.current_period_end is not null
       and s.current_period_end <= now()
    returning s.id
  )
  select count(*) into v_count from downgraded;

  return v_count;
end;
$function$;

-- 3) Programar la degradación diaria (03:10 UTC). Reprogramable de forma segura.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'expire-trials-daily') then
    perform cron.unschedule('expire-trials-daily');
  end if;
  perform cron.schedule(
    'expire-trials-daily',
    '10 3 * * *',
    $cron$ select public.expire_trials(); $cron$
  );
end;
$$;
