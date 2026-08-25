begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  workshop_name text not null default '',
  language text not null default 'en',
  country text not null default 'US',
  currency text not null default 'USD',
  onboarding_completed boolean not null default false,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz
);

create table if not exists public.app_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  repairs jsonb not null default '[]'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  deleted_repairs jsonb not null default '[]'::jsonb,
  revision bigint not null default 1 check (revision > 0),
  last_device_id text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint repairs_are_array check (jsonb_typeof(repairs) = 'array'),
  constraint settings_are_object check (jsonb_typeof(settings) = 'object'),
  constraint deleted_repairs_are_array check (jsonb_typeof(deleted_repairs) = 'array')
);

create table if not exists public.feedback (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null default 'feedback' check (char_length(type) between 1 and 30),
  message text not null check (char_length(message) between 3 and 3000),
  page text not null default 'overview',
  app_version text not null default '',
  status text not null default 'new' check (status in ('new', 'reviewing', 'planned', 'resolved', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.analytics_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id text not null check (char_length(session_id) between 1 and 100),
  device_id text not null check (char_length(device_id) between 1 and 100),
  event_name text not null check (event_name ~ '^[A-Za-z0-9_.-]{1,60}$'),
  properties jsonb not null default '{}'::jsonb,
  app_version text not null default '',
  created_at timestamptz not null default now(),
  constraint analytics_properties_are_object check (jsonb_typeof(properties) = 'object')
);

create index if not exists feedback_user_created_idx on public.feedback (user_id, created_at desc);
create index if not exists feedback_status_created_idx on public.feedback (status, created_at desc);
create index if not exists analytics_user_created_idx on public.analytics_events (user_id, created_at desc);
create index if not exists analytics_event_created_idx on public.analytics_events (event_name, created_at desc);
create index if not exists analytics_session_idx on public.analytics_events (session_id);

create or replace function private.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid()) and is_admin = true
  );
$$;

revoke all on function private.is_app_admin() from public;
grant usage on schema private to authenticated;
grant execute on function private.is_app_admin() to authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.set_updated_at() from public, anon, authenticated;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists feedback_set_updated_at on public.feedback;
create trigger feedback_set_updated_at before update on public.feedback
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, workshop_name, language, country, currency)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'workshop_name', ''), 100),
    left(coalesce(new.raw_user_meta_data ->> 'language', 'en'), 10),
    left(coalesce(new.raw_user_meta_data ->> 'country', 'US'), 2),
    left(coalesce(new.raw_user_meta_data ->> 'currency', 'USD'), 3)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.app_data enable row level security;
alter table public.feedback enable row level security;
alter table public.analytics_events enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select to authenticated
using (id = (select auth.uid()));

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles for insert to authenticated
with check (id = (select auth.uid()) and is_admin = false);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

drop policy if exists "app_data_select_own" on public.app_data;
create policy "app_data_select_own" on public.app_data for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "app_data_insert_own" on public.app_data;
create policy "app_data_insert_own" on public.app_data for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "app_data_update_own" on public.app_data;
create policy "app_data_update_own" on public.app_data for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "feedback_insert_own" on public.feedback;
create policy "feedback_insert_own" on public.feedback for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "feedback_select_own_or_admin" on public.feedback;
create policy "feedback_select_own_or_admin" on public.feedback for select to authenticated
using (user_id = (select auth.uid()) or (select private.is_app_admin()));

drop policy if exists "feedback_update_admin" on public.feedback;
create policy "feedback_update_admin" on public.feedback for update to authenticated
using ((select private.is_app_admin()))
with check ((select private.is_app_admin()));

drop policy if exists "analytics_insert_own" on public.analytics_events;
create policy "analytics_insert_own" on public.analytics_events for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "analytics_select_admin" on public.analytics_events;
create policy "analytics_select_admin" on public.analytics_events for select to authenticated
using ((select private.is_app_admin()));

revoke all on public.profiles, public.app_data, public.feedback, public.analytics_events from anon;
revoke all on public.profiles, public.app_data, public.feedback, public.analytics_events from authenticated;
revoke insert (id, workshop_name, language, country, currency, onboarding_completed, last_seen_at) on public.profiles from authenticated;
revoke update (workshop_name, language, country, currency, onboarding_completed, last_seen_at, updated_at) on public.profiles from authenticated;
revoke usage, select on all sequences in schema public from authenticated;
grant select on public.profiles to authenticated;
grant update (workshop_name, language, country, currency, onboarding_completed, last_seen_at) on public.profiles to authenticated;
grant select on public.app_data to authenticated;
grant select on public.feedback to authenticated;
grant update (status) on public.feedback to authenticated;
grant select on public.analytics_events to authenticated;

create or replace function public.submit_user_feedback(
  p_type text,
  p_message text,
  p_page text,
  p_app_version text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_id bigint;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_type not in ('idea', 'bug', 'other') then
    raise exception 'Invalid feedback type';
  end if;
  if char_length(trim(coalesce(p_message, ''))) not between 3 and 3000 then
    raise exception 'Feedback message must contain 3 to 3000 characters';
  end if;
  if (select count(*) from public.feedback where user_id = v_user_id and created_at >= now() - interval '1 day') >= 20 then
    raise exception 'Feedback rate limit exceeded';
  end if;

  insert into public.feedback (user_id, type, message, page, app_version)
  values (
    v_user_id,
    p_type,
    left(trim(p_message), 3000),
    left(coalesce(p_page, 'overview'), 60),
    left(coalesce(p_app_version, ''), 30)
  )
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.submit_user_feedback(text, text, text, text) from public, anon;
grant execute on function public.submit_user_feedback(text, text, text, text) to authenticated;

create or replace function public.track_product_event(
  p_session_id text,
  p_device_id text,
  p_event_name text,
  p_properties jsonb,
  p_app_version text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if char_length(coalesce(p_session_id, '')) not between 1 and 100
     or char_length(coalesce(p_device_id, '')) not between 1 and 100 then
    raise exception 'Invalid session or device identifier';
  end if;
  if coalesce(p_event_name, '') !~ '^[A-Za-z0-9_.-]{1,60}$' then
    raise exception 'Invalid event name';
  end if;
  if p_properties is null or jsonb_typeof(p_properties) <> 'object' or octet_length(p_properties::text) > 4000 then
    raise exception 'Invalid event properties';
  end if;
  if (select count(*) from public.analytics_events where user_id = v_user_id and created_at >= now() - interval '1 hour') >= 500 then
    raise exception 'Analytics rate limit exceeded';
  end if;

  insert into public.analytics_events (user_id, session_id, device_id, event_name, properties, app_version)
  values (
    v_user_id,
    left(p_session_id, 100),
    left(p_device_id, 100),
    p_event_name,
    p_properties,
    left(coalesce(p_app_version, ''), 30)
  );
end;
$$;

revoke all on function public.track_product_event(text, text, text, jsonb, text) from public, anon;
grant execute on function public.track_product_event(text, text, text, jsonb, text) to authenticated;

create or replace function public.save_user_data(
  p_repairs jsonb,
  p_settings jsonb,
  p_deleted_repairs jsonb,
  p_expected_revision bigint,
  p_device_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_revision bigint;
  v_updated_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_repairs is null or p_settings is null or p_deleted_repairs is null
     or jsonb_typeof(p_repairs) <> 'array'
     or jsonb_typeof(p_settings) <> 'object'
     or jsonb_typeof(p_deleted_repairs) <> 'array' then
    raise exception 'Invalid snapshot shape';
  end if;
  if octet_length(p_repairs::text) + octet_length(p_settings::text) + octet_length(p_deleted_repairs::text) > 4500000 then
    raise exception 'Snapshot is too large';
  end if;

  select revision, updated_at into v_revision, v_updated_at
  from public.app_data
  where user_id = v_user_id
  for update;

  if not found then
    insert into public.app_data (user_id, repairs, settings, deleted_repairs, revision, last_device_id)
    values (v_user_id, p_repairs, p_settings, p_deleted_repairs, 1, left(coalesce(p_device_id, ''), 100))
    on conflict (user_id) do nothing
    returning revision, updated_at into v_revision, v_updated_at;
    if found then
      return jsonb_build_object('ok', true, 'revision', v_revision, 'updated_at', v_updated_at, 'created', true);
    end if;
    select revision, updated_at into v_revision, v_updated_at
    from public.app_data
    where user_id = v_user_id
    for update;
  end if;

  if p_expected_revision is not null and p_expected_revision <> v_revision then
    return jsonb_build_object('ok', false, 'conflict', true, 'revision', v_revision, 'updated_at', v_updated_at);
  end if;

  update public.app_data
  set repairs = p_repairs,
      settings = p_settings,
      deleted_repairs = p_deleted_repairs,
      revision = revision + 1,
      last_device_id = left(coalesce(p_device_id, ''), 100),
      updated_at = now()
  where user_id = v_user_id
  returning revision, updated_at into v_revision, v_updated_at;

  return jsonb_build_object('ok', true, 'revision', v_revision, 'updated_at', v_updated_at, 'created', false);
end;
$$;

revoke all on function public.save_user_data(jsonb, jsonb, jsonb, bigint, text) from public, anon;
grant execute on function public.save_user_data(jsonb, jsonb, jsonb, bigint, text) to authenticated;

create or replace view public.admin_daily_metrics
with (security_invoker = true)
as
select
  created_at::date as day,
  count(*) as events,
  count(distinct user_id) as active_users,
  count(distinct session_id) as sessions,
  count(*) filter (where event_name = 'repair_created') as repairs_created,
  count(*) filter (where event_name = 'feedback_sent') as feedback_sent
from public.analytics_events
group by created_at::date
order by day desc;

revoke all on public.admin_daily_metrics from public, anon;
grant select on public.admin_daily_metrics to authenticated;

create or replace function public.get_admin_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_total_users bigint;
  v_new_users_30d bigint;
  v_active_today bigint;
  v_active_7d bigint;
  v_returning_30d bigint;
  v_events_30d bigint;
  v_open_feedback bigint;
  v_daily jsonb;
  v_feedback jsonb;
begin
  if (select auth.uid()) is null or not coalesce(private.is_app_admin(), false) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  select count(*) into v_total_users from public.profiles;
  select count(*) into v_new_users_30d from public.profiles where created_at >= current_date - interval '29 days';
  select count(distinct user_id) into v_active_today from public.analytics_events where created_at >= current_date;
  select count(distinct user_id) into v_active_7d from public.analytics_events where created_at >= current_date - interval '6 days';
  select count(*) into v_returning_30d
  from (
    select user_id
    from public.analytics_events
    where created_at >= current_date - interval '29 days'
    group by user_id
    having count(distinct created_at::date) >= 2
  ) returning_users;
  select count(*) into v_events_30d from public.analytics_events where created_at >= current_date - interval '29 days';
  select count(*) into v_open_feedback from public.feedback where status in ('new', 'reviewing', 'planned');

  select coalesce(jsonb_agg(to_jsonb(day_row) order by day_row.day), '[]'::jsonb) into v_daily
  from (
    select
      created_at::date as day,
      count(*) as events,
      count(distinct user_id) as active_users,
      count(distinct session_id) as sessions,
      count(*) filter (where event_name = 'repair_created') as repairs_created,
      count(*) filter (where event_name = 'feedback_sent') as feedback_sent
    from public.analytics_events
    where created_at >= current_date - interval '29 days'
    group by created_at::date
  ) day_row;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', feedback_row.id,
        'type', feedback_row.type,
        'message', feedback_row.message,
        'page', feedback_row.page,
        'app_version', feedback_row.app_version,
        'status', feedback_row.status,
        'created_at', feedback_row.created_at,
        'workshop_name', feedback_row.workshop_name
      ) order by feedback_row.created_at desc
    ),
    '[]'::jsonb
  ) into v_feedback
  from (
    select f.id, f.type, f.message, f.page, f.app_version, f.status, f.created_at, coalesce(p.workshop_name, '') as workshop_name
    from public.feedback f
    left join public.profiles p on p.id = f.user_id
    order by f.created_at desc
    limit 50
  ) feedback_row;

  return jsonb_build_object(
    'totals', jsonb_build_object(
      'total_users', v_total_users,
      'new_users_30d', v_new_users_30d,
      'active_today', v_active_today,
      'active_7d', v_active_7d,
      'returning_30d', v_returning_30d,
      'events_30d', v_events_30d,
      'open_feedback', v_open_feedback
    ),
    'daily', v_daily,
    'feedback', v_feedback,
    'generated_at', now()
  );
end;
$$;

revoke all on function public.get_admin_dashboard() from public, anon;
grant execute on function public.get_admin_dashboard() to authenticated;

commit;
