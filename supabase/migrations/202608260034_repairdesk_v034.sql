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

create table if not exists private.admin_audit_log (
  id bigint generated always as identity primary key,
  admin_user_id uuid references auth.users(id) on delete set null,
  action text not null check (char_length(action) between 1 and 80),
  target_type text not null default '' check (char_length(target_type) <= 40),
  target_id text not null default '' check (char_length(target_id) <= 120),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint admin_audit_details_are_object check (jsonb_typeof(details) = 'object')
);

create index if not exists feedback_user_created_idx on public.feedback (user_id, created_at desc);
create index if not exists feedback_status_created_idx on public.feedback (status, created_at desc);
create index if not exists analytics_user_created_idx on public.analytics_events (user_id, created_at desc);
create index if not exists analytics_event_created_idx on public.analytics_events (event_name, created_at desc);
create index if not exists analytics_session_idx on public.analytics_events (session_id);
create index if not exists admin_audit_created_idx on private.admin_audit_log (created_at desc);

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
alter table private.admin_audit_log enable row level security;

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

drop policy if exists "analytics_insert_own" on public.analytics_events;
create policy "analytics_insert_own" on public.analytics_events for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "analytics_select_admin" on public.analytics_events;
create policy "analytics_select_admin" on public.analytics_events for select to authenticated
using ((select private.is_app_admin()));

revoke all on public.profiles, public.app_data, public.feedback, public.analytics_events from anon;
revoke all on public.profiles, public.app_data, public.feedback, public.analytics_events from authenticated;
revoke all on private.admin_audit_log from public, anon, authenticated;
revoke insert (id, workshop_name, language, country, currency, onboarding_completed, last_seen_at) on public.profiles from authenticated;
revoke update (workshop_name, language, country, currency, onboarding_completed, last_seen_at, updated_at) on public.profiles from authenticated;
revoke update (status) on public.feedback from authenticated;
revoke usage, select on all sequences in schema public from authenticated;
revoke usage, select on all sequences in schema private from authenticated;
grant select on public.profiles to authenticated;
grant update (workshop_name, language, country, currency, onboarding_completed, last_seen_at) on public.profiles to authenticated;
grant select on public.app_data to authenticated;
grant select on public.feedback to authenticated;
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
  v_cloud_workspaces bigint;
  v_active_workspaces_24h bigint;
  v_stale_workspaces_30d bigint;
  v_total_repairs bigint;
  v_storage_bytes bigint;
  v_daily jsonb;
  v_feedback jsonb;
  v_event_breakdown jsonb;
  v_country_breakdown jsonb;
  v_audit jsonb;
begin
  if (select auth.uid()) is null or not coalesce(private.is_app_admin(), false) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  select
    count(*),
    count(*) filter (where created_at >= current_date - interval '29 days')
  into v_total_users, v_new_users_30d
  from public.profiles;

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

  select
    count(*),
    count(*) filter (where updated_at >= now() - interval '24 hours'),
    count(*) filter (where updated_at < now() - interval '30 days'),
    coalesce(sum(jsonb_array_length(repairs)), 0),
    coalesce(sum(
      pg_column_size(repairs)::bigint
      + pg_column_size(settings)::bigint
      + pg_column_size(deleted_repairs)::bigint
    ), 0)
  into v_cloud_workspaces, v_active_workspaces_24h, v_stale_workspaces_30d, v_total_repairs, v_storage_bytes
  from public.app_data;

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
        'workshop_name', feedback_row.workshop_name,
        'user_email', feedback_row.user_email
      ) order by feedback_row.created_at desc
    ),
    '[]'::jsonb
  ) into v_feedback
  from (
    select
      f.id,
      f.type,
      f.message,
      f.page,
      f.app_version,
      f.status,
      f.created_at,
      coalesce(p.workshop_name, '') as workshop_name,
      lower(coalesce(u.email, '')) as user_email
    from public.feedback f
    left join public.profiles p on p.id = f.user_id
    left join auth.users u on u.id = f.user_id
    order by f.created_at desc
    limit 100
  ) feedback_row;

  select coalesce(
    jsonb_agg(
      jsonb_build_object('name', event_row.event_name, 'count', event_row.event_count)
      order by event_row.event_count desc, event_row.event_name
    ),
    '[]'::jsonb
  ) into v_event_breakdown
  from (
    select event_name, count(*) as event_count
    from public.analytics_events
    where created_at >= current_date - interval '29 days'
    group by event_name
    order by event_count desc, event_name
    limit 10
  ) event_row;

  select coalesce(
    jsonb_agg(
      jsonb_build_object('country', country_row.country, 'count', country_row.user_count)
      order by country_row.user_count desc, country_row.country
    ),
    '[]'::jsonb
  ) into v_country_breakdown
  from (
    select upper(coalesce(nullif(country, ''), '--')) as country, count(*) as user_count
    from public.profiles
    group by upper(coalesce(nullif(country, ''), '--'))
    order by user_count desc, country
    limit 10
  ) country_row;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', audit_row.id,
        'action', audit_row.action,
        'target_type', audit_row.target_type,
        'target_id', audit_row.target_id,
        'details', audit_row.details,
        'created_at', audit_row.created_at,
        'admin_email', audit_row.admin_email
      ) order by audit_row.created_at desc
    ),
    '[]'::jsonb
  ) into v_audit
  from (
    select
      a.id,
      a.action,
      a.target_type,
      a.target_id,
      a.details,
      a.created_at,
      lower(coalesce(u.email, '')) as admin_email
    from private.admin_audit_log a
    left join auth.users u on u.id = a.admin_user_id
    order by a.created_at desc
    limit 30
  ) audit_row;

  return jsonb_build_object(
    'totals', jsonb_build_object(
      'total_users', v_total_users,
      'new_users_30d', v_new_users_30d,
      'active_today', v_active_today,
      'active_7d', v_active_7d,
      'returning_30d', v_returning_30d,
      'events_30d', v_events_30d,
      'open_feedback', v_open_feedback,
      'cloud_workspaces', v_cloud_workspaces,
      'active_workspaces_24h', v_active_workspaces_24h,
      'stale_workspaces_30d', v_stale_workspaces_30d,
      'total_repairs', v_total_repairs,
      'storage_bytes', v_storage_bytes
    ),
    'daily', v_daily,
    'feedback', v_feedback,
    'event_breakdown', v_event_breakdown,
    'country_breakdown', v_country_breakdown,
    'audit', v_audit,
    'generated_at', now()
  );
end;
$$;

revoke all on function public.get_admin_dashboard() from public, anon;
grant execute on function public.get_admin_dashboard() to authenticated;

create or replace function public.get_admin_users(
  p_query text default '',
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_query text := left(trim(coalesce(p_query, '')), 120);
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_offset integer := least(greatest(coalesce(p_offset, 0), 0), 10000);
  v_total bigint;
  v_users jsonb;
begin
  if (select auth.uid()) is null or not coalesce(private.is_app_admin(), false) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  select count(*) into v_total
  from auth.users u
  left join public.profiles p on p.id = u.id
  where v_query = ''
     or coalesce(u.email, '') ilike '%' || v_query || '%'
     or coalesce(p.workshop_name, '') ilike '%' || v_query || '%'
     or coalesce(p.country, '') ilike '%' || v_query || '%';

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', user_row.id,
        'email', user_row.email,
        'email_confirmed_at', user_row.email_confirmed_at,
        'created_at', user_row.created_at,
        'last_sign_in_at', user_row.last_sign_in_at,
        'workshop_name', user_row.workshop_name,
        'country', user_row.country,
        'language', user_row.language,
        'currency', user_row.currency,
        'onboarding_completed', user_row.onboarding_completed,
        'last_seen_at', user_row.last_seen_at,
        'last_sync_at', user_row.last_sync_at,
        'revision', user_row.revision,
        'repair_count', user_row.repair_count,
        'snapshot_bytes', user_row.snapshot_bytes
      ) order by user_row.activity_at desc, user_row.created_at desc
    ),
    '[]'::jsonb
  ) into v_users
  from (
    select
      u.id,
      lower(coalesce(u.email, '')) as email,
      u.email_confirmed_at,
      u.created_at,
      u.last_sign_in_at,
      coalesce(p.workshop_name, '') as workshop_name,
      upper(coalesce(nullif(p.country, ''), '--')) as country,
      coalesce(p.language, '') as language,
      coalesce(p.currency, '') as currency,
      coalesce(p.onboarding_completed, false) as onboarding_completed,
      p.last_seen_at,
      d.updated_at as last_sync_at,
      coalesce(d.revision, 0) as revision,
      coalesce(jsonb_array_length(d.repairs), 0) as repair_count,
      case when d.user_id is null then 0 else
        pg_column_size(d.repairs)::bigint
        + pg_column_size(d.settings)::bigint
        + pg_column_size(d.deleted_repairs)::bigint
      end as snapshot_bytes,
      coalesce(p.last_seen_at, u.last_sign_in_at, u.created_at) as activity_at
    from auth.users u
    left join public.profiles p on p.id = u.id
    left join public.app_data d on d.user_id = u.id
    where v_query = ''
       or coalesce(u.email, '') ilike '%' || v_query || '%'
       or coalesce(p.workshop_name, '') ilike '%' || v_query || '%'
       or coalesce(p.country, '') ilike '%' || v_query || '%'
    order by activity_at desc, u.created_at desc
    limit v_limit
    offset v_offset
  ) user_row;

  return jsonb_build_object(
    'total', v_total,
    'users', v_users,
    'limit', v_limit,
    'offset', v_offset,
    'generated_at', now()
  );
end;
$$;

revoke all on function public.get_admin_users(text, integer, integer) from public, anon;
grant execute on function public.get_admin_users(text, integer, integer) to authenticated;

create or replace function public.set_admin_feedback_status(
  p_id bigint,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_id uuid := (select auth.uid());
  v_previous_status text;
  v_updated_at timestamptz;
begin
  if v_admin_id is null or not coalesce(private.is_app_admin(), false) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_id is null or p_id < 1 then
    raise exception 'Invalid feedback identifier';
  end if;
  if p_status not in ('new', 'reviewing', 'planned', 'resolved', 'closed') then
    raise exception 'Invalid feedback status';
  end if;

  select status into v_previous_status
  from public.feedback
  where id = p_id
  for update;

  if not found then
    raise exception 'Feedback not found';
  end if;

  if v_previous_status <> p_status then
    update public.feedback
    set status = p_status
    where id = p_id
    returning updated_at into v_updated_at;

    insert into private.admin_audit_log (admin_user_id, action, target_type, target_id, details)
    values (
      v_admin_id,
      'feedback_status_changed',
      'feedback',
      p_id::text,
      jsonb_build_object('from', v_previous_status, 'to', p_status)
    );
  else
    select updated_at into v_updated_at from public.feedback where id = p_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'id', p_id,
    'status', p_status,
    'updated_at', v_updated_at
  );
end;
$$;

revoke all on function public.set_admin_feedback_status(bigint, text) from public, anon;
grant execute on function public.set_admin_feedback_status(bigint, text) to authenticated;

-- RepairDesk v0.3.4: shared workshops, operational records and owner controls.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
do $$
begin
  if (select n.nspname from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname = 'pgcrypto') <> 'extensions' then
    alter extension pgcrypto set schema extensions;
  end if;
end;
$$;

alter table public.profiles
  add column if not exists account_status text not null default 'active'
    check (account_status in ('active', 'suspended', 'deletion_requested')),
  add column if not exists active_workshop_id uuid;

alter table public.feedback
  add column if not exists priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  add column if not exists category text not null default 'general',
  add column if not exists admin_note text not null default '',
  add column if not exists release_version text not null default '';

create table if not exists public.workshops (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default '',
  country text not null default 'US',
  currency text not null default 'USD',
  timezone text not null default 'UTC',
  plan text not null default 'free',
  status text not null default 'active' check (status in ('active', 'suspended', 'archived')),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workshop_members (
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'technician' check (role in ('owner', 'manager', 'technician', 'viewer')),
  status text not null default 'active' check (status in ('active', 'suspended')),
  display_name text not null default '',
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workshop_id, user_id)
);

create table if not exists public.workshop_invites (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  email text not null,
  role text not null default 'technician' check (role in ('manager', 'technician', 'viewer')),
  token_hash text not null unique,
  invited_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.workshop_snapshots (
  workshop_id uuid primary key references public.workshops(id) on delete cascade,
  repairs jsonb not null default '[]'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  deleted_repairs jsonb not null default '[]'::jsonb,
  revision bigint not null default 1 check (revision > 0),
  last_device_id text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workshop_repairs_are_array check (jsonb_typeof(repairs) = 'array'),
  constraint workshop_settings_are_object check (jsonb_typeof(settings) = 'object'),
  constraint workshop_deleted_are_array check (jsonb_typeof(deleted_repairs) = 'array')
);

create table if not exists public.workshop_customers (
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  id text not null,
  name text not null default '',
  phone text not null default '',
  email text not null default '',
  address text not null default '',
  notes text not null default '',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workshop_id, id)
);

create table if not exists public.workshop_devices (
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  id text not null,
  customer_id text not null default '',
  category text not null default 'other',
  brand text not null default '',
  model text not null default '',
  serial text not null default '',
  imei text not null default '',
  warranty_until date,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workshop_id, id)
);

create table if not exists public.workshop_repairs (
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  id text not null,
  customer_id text not null default '',
  device_id text not null default '',
  status text not null default 'intake',
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  assigned_to text not null default '',
  received_on date,
  due_on date,
  completed_at timestamptz,
  total numeric(14,2) not null default 0,
  portal_token_hash text not null default '',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workshop_id, id)
);

create table if not exists public.workshop_parts (
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  id text not null,
  repair_id text not null,
  name text not null default '',
  sku text not null default '',
  quantity numeric(12,2) not null default 1,
  cost numeric(14,2) not null default 0,
  price numeric(14,2) not null default 0,
  order_status text not null default '',
  supplier_id text not null default '',
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (workshop_id, id)
);

create table if not exists public.workshop_inventory (
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  id text not null,
  name text not null default '',
  sku text not null default '',
  category text not null default '',
  compatible_models text not null default '',
  supplier_id text not null default '',
  quantity numeric(12,2) not null default 0,
  minimum_quantity numeric(12,2) not null default 0,
  cost numeric(14,2) not null default 0,
  price numeric(14,2) not null default 0,
  location text not null default '',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workshop_id, id)
);

create table if not exists public.workshop_suppliers (
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  id text not null,
  name text not null default '',
  contact_name text not null default '',
  email text not null default '',
  phone text not null default '',
  website text not null default '',
  notes text not null default '',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workshop_id, id)
);

create table if not exists public.workshop_purchase_orders (
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  id text not null,
  number text not null default '',
  supplier_id text not null default '',
  status text not null default 'ordered' check (status in ('ordered', 'shipped', 'received', 'cancelled')),
  tracking text not null default '',
  ordered_on date,
  received_at timestamptz,
  item_name text not null default '',
  sku text not null default '',
  quantity numeric(12,2) not null default 1,
  unit_cost numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workshop_id, id)
);

create table if not exists public.workshop_appointments (
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  id text not null,
  repair_id text not null default '',
  customer_id text not null default '',
  assigned_to text not null default '',
  title text not null default '',
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'scheduled',
  notes text not null default '',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workshop_id, id)
);

create table if not exists public.workshop_payments (
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  id text not null,
  repair_id text not null,
  amount numeric(14,2) not null default 0,
  method text not null default 'cash',
  status text not null default 'paid',
  reference text not null default '',
  paid_at timestamptz,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (workshop_id, id)
);

create table if not exists public.workshop_estimates (
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  id text not null,
  repair_id text not null,
  amount numeric(14,2) not null default 0,
  status text not null default 'draft' check (status in ('draft', 'sent', 'approved', 'rejected', 'expired')),
  note text not null default '',
  responded_at timestamptz,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workshop_id, id)
);

create table if not exists public.workshop_attachments (
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  id text not null,
  repair_id text not null,
  kind text not null default 'photo',
  file_name text not null default '',
  storage_path text not null default '',
  mime_type text not null default '',
  size_bytes bigint not null default 0,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (workshop_id, id)
);

create table if not exists public.workshop_activity (
  id bigint generated always as identity primary key,
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  target_type text not null default '',
  target_id text not null default '',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.sync_health_events (
  id bigint generated always as identity primary key,
  workshop_id uuid references public.workshops(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  device_id text not null default '',
  result text not null check (result in ('success', 'conflict', 'rejected')),
  revision bigint,
  duration_ms integer,
  app_version text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.app_feature_flags (
  key text primary key,
  enabled boolean not null default false,
  rollout_percent integer not null default 100 check (rollout_percent between 0 and 100),
  value text not null default '',
  description text not null default '',
  rules jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.app_feature_flags
  add column if not exists value text not null default '';

create table if not exists public.app_announcements (
  id bigint generated always as identity primary key,
  title text not null,
  message text not null,
  kind text not null default 'info' check (kind in ('info', 'success', 'warning', 'critical')),
  audience text not null default 'all' check (audience in ('all', 'admins', 'active', 'inactive')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.app_releases (
  version text primary key,
  title text not null,
  notes text not null default '',
  status text not null default 'released' check (status in ('planned', 'testing', 'released', 'paused')),
  released_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists private.admin_support_notes (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  admin_user_id uuid references auth.users(id) on delete set null,
  note text not null check (char_length(note) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table if not exists private.portal_events (
  id bigint generated always as identity primary key,
  token_hash text not null,
  event_type text not null,
  created_at timestamptz not null default now()
);

create index if not exists workshop_members_user_idx on public.workshop_members (user_id, status);
create index if not exists workshop_repairs_status_idx on public.workshop_repairs (workshop_id, status, updated_at desc);
create index if not exists workshop_repairs_portal_idx on public.workshop_repairs (portal_token_hash) where portal_token_hash <> '';
create index if not exists workshop_customers_search_idx on public.workshop_customers (workshop_id, name, email);
create index if not exists workshop_devices_search_idx on public.workshop_devices (workshop_id, serial, imei);
create index if not exists workshop_purchase_orders_status_idx on public.workshop_purchase_orders (workshop_id, status, ordered_on desc);
create index if not exists workshop_activity_created_idx on public.workshop_activity (workshop_id, created_at desc);
create index if not exists sync_health_created_idx on public.sync_health_events (created_at desc, result);
create index if not exists invite_token_idx on public.workshop_invites (token_hash, expires_at);

insert into public.app_feature_flags (key, enabled, value, description)
values
  ('customer_portal', true, '', 'Secure customer repair status links'),
  ('attachments', true, '', 'Repair photos and file attachments'),
  ('inventory', true, '', 'Inventory and supplier workspace'),
  ('maintenance_mode', false, '', 'Temporarily restrict normal workspace access'),
  ('minimum_app_version', false, '0.3.4', 'Minimum version allowed to edit cloud workspaces')
on conflict (key) do nothing;

insert into public.app_releases (version, title, notes, status, released_at)
values ('0.3.4', 'Workshop operations', 'Owner intelligence, CRM, devices, inventory, scheduling, team roles, customer portal and offline workflow.', 'released', now())
on conflict (version) do update set title = excluded.title, notes = excluded.notes;

insert into public.workshops (id, owner_user_id, name, country, currency)
select p.id, p.id, coalesce(nullif(p.workshop_name, ''), 'RepairDesk Workshop'), p.country, p.currency
from public.profiles p
on conflict (id) do nothing;

insert into public.workshop_members (workshop_id, user_id, role, display_name)
select p.id, p.id, 'owner', coalesce(nullif(p.workshop_name, ''), 'Owner')
from public.profiles p
on conflict (workshop_id, user_id) do update set role = 'owner', status = 'active';

update public.profiles set active_workshop_id = id where active_workshop_id is null;

insert into public.workshop_snapshots (workshop_id, repairs, settings, deleted_repairs, revision, last_device_id, created_at, updated_at)
select d.user_id, d.repairs, d.settings, d.deleted_repairs, d.revision, d.last_device_id, d.created_at, d.updated_at
from public.app_data d
join public.workshops w on w.id = d.user_id
on conflict (workshop_id) do nothing;

create or replace function private.safe_date(p_value text)
returns date
language plpgsql
immutable
set search_path = ''
as $$
begin
  return nullif(trim(coalesce(p_value, '')), '')::date;
exception when others then
  return null;
end;
$$;

create or replace function private.safe_timestamptz(p_value text)
returns timestamptz
language plpgsql
immutable
set search_path = ''
as $$
begin
  return nullif(trim(coalesce(p_value, '')), '')::timestamptz;
exception when others then
  return null;
end;
$$;

create or replace function private.safe_numeric(p_value text)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
begin
  return greatest(coalesce(nullif(trim(coalesce(p_value, '')), '')::numeric, 0), 0);
exception when others then
  return 0;
end;
$$;

create or replace function private.version_code(p_value text)
returns bigint
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_parts text[] := regexp_match(coalesce(p_value, ''), '^([0-9]+)[.]([0-9]+)[.]([0-9]+)');
begin
  if v_parts is null then return 0; end if;
  return least(v_parts[1]::bigint, 999999) * 1000000000000
    + least(v_parts[2]::bigint, 999999) * 1000000
    + least(v_parts[3]::bigint, 999999);
exception when others then
  return 0;
end;
$$;

create or replace function private.path_workshop_id(p_name text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return split_part(coalesce(p_name, ''), '/', 1)::uuid;
exception when others then
  return null;
end;
$$;

create or replace function private.current_workshop_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.active_workshop_id from public.profiles p where p.id = (select auth.uid())),
    (select m.workshop_id from public.workshop_members m where m.user_id = (select auth.uid()) and m.status = 'active' order by (m.role = 'owner') desc, m.joined_at limit 1)
  );
$$;

create or replace function private.is_workshop_member(p_workshop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workshop_members m
    join public.profiles p on p.id = m.user_id
    where m.workshop_id = p_workshop_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and p.account_status = 'active'
  );
$$;

create or replace function private.can_manage_workshop(p_workshop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workshop_members m
    join public.profiles p on p.id = m.user_id
    where m.workshop_id = p_workshop_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'manager')
      and m.status = 'active'
      and p.account_status = 'active'
  );
$$;

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
    where id = (select auth.uid()) and is_admin = true and account_status = 'active'
  );
$$;

revoke all on function private.safe_date(text) from public, anon, authenticated;
revoke all on function private.safe_timestamptz(text) from public, anon, authenticated;
revoke all on function private.safe_numeric(text) from public, anon, authenticated;
revoke all on function private.version_code(text) from public, anon, authenticated;
revoke all on function private.path_workshop_id(text) from public, anon;
revoke all on function private.current_workshop_id() from public, anon;
revoke all on function private.is_workshop_member(uuid) from public, anon;
revoke all on function private.can_manage_workshop(uuid) from public, anon;
grant execute on function private.path_workshop_id(text) to authenticated;
grant execute on function private.current_workshop_id() to authenticated;
grant execute on function private.is_workshop_member(uuid) to authenticated;
grant execute on function private.can_manage_workshop(uuid) to authenticated;

alter table public.workshops enable row level security;
alter table public.workshop_members enable row level security;
alter table public.workshop_invites enable row level security;
alter table public.workshop_snapshots enable row level security;
alter table public.workshop_customers enable row level security;
alter table public.workshop_devices enable row level security;
alter table public.workshop_repairs enable row level security;
alter table public.workshop_parts enable row level security;
alter table public.workshop_inventory enable row level security;
alter table public.workshop_suppliers enable row level security;
alter table public.workshop_purchase_orders enable row level security;
alter table public.workshop_appointments enable row level security;
alter table public.workshop_payments enable row level security;
alter table public.workshop_estimates enable row level security;
alter table public.workshop_attachments enable row level security;
alter table public.workshop_activity enable row level security;
alter table public.sync_health_events enable row level security;
alter table public.app_feature_flags enable row level security;
alter table public.app_announcements enable row level security;
alter table public.app_releases enable row level security;
alter table private.admin_support_notes enable row level security;
alter table private.portal_events enable row level security;

revoke all on public.workshops, public.workshop_members, public.workshop_invites, public.workshop_snapshots,
  public.workshop_customers, public.workshop_devices, public.workshop_repairs, public.workshop_parts,
  public.workshop_inventory, public.workshop_suppliers, public.workshop_purchase_orders, public.workshop_appointments, public.workshop_payments,
  public.workshop_estimates, public.workshop_attachments, public.workshop_activity, public.sync_health_events,
  public.app_feature_flags, public.app_announcements, public.app_releases from public, anon, authenticated;
revoke all on private.admin_support_notes, private.portal_events from public, anon, authenticated;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select to authenticated
using (id = (select auth.uid()));

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update to authenticated
using (id = (select auth.uid()) and account_status = 'active')
with check (id = (select auth.uid()) and account_status = 'active');

create or replace function private.rebuild_workshop_index(
  p_workshop_id uuid,
  p_repairs jsonb,
  p_settings jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customers jsonb := case when jsonb_typeof(p_settings #> '{workspace,customers}') = 'array' then p_settings #> '{workspace,customers}' else '[]'::jsonb end;
  v_devices jsonb := case when jsonb_typeof(p_settings #> '{workspace,devices}') = 'array' then p_settings #> '{workspace,devices}' else '[]'::jsonb end;
  v_inventory jsonb := case when jsonb_typeof(p_settings #> '{workspace,inventory}') = 'array' then p_settings #> '{workspace,inventory}' else '[]'::jsonb end;
  v_suppliers jsonb := case when jsonb_typeof(p_settings #> '{workspace,suppliers}') = 'array' then p_settings #> '{workspace,suppliers}' else '[]'::jsonb end;
  v_purchase_orders jsonb := case when jsonb_typeof(p_settings #> '{workspace,purchaseOrders}') = 'array' then p_settings #> '{workspace,purchaseOrders}' else '[]'::jsonb end;
  v_appointments jsonb := case when jsonb_typeof(p_settings #> '{workspace,appointments}') = 'array' then p_settings #> '{workspace,appointments}' else '[]'::jsonb end;
begin
  delete from public.workshop_customers where workshop_id = p_workshop_id;
  insert into public.workshop_customers (workshop_id, id, name, phone, email, address, notes, data, created_at, updated_at)
  select p_workshop_id,
    left(coalesce(nullif(item ->> 'id', ''), gen_random_uuid()::text), 120),
    left(coalesce(item ->> 'name', ''), 100), left(coalesce(item ->> 'phone', ''), 40),
    left(lower(coalesce(item ->> 'email', '')), 160), left(coalesce(item ->> 'address', ''), 200),
    left(coalesce(item ->> 'notes', ''), 2000), item,
    coalesce(private.safe_timestamptz(item ->> 'createdAt'), now()),
    coalesce(private.safe_timestamptz(item ->> 'updatedAt'), now())
  from jsonb_array_elements(v_customers) item
  where coalesce(item ->> 'id', '') <> ''
  on conflict (workshop_id, id) do update set name = excluded.name, phone = excluded.phone, email = excluded.email,
    address = excluded.address, notes = excluded.notes, data = excluded.data, updated_at = excluded.updated_at;

  insert into public.workshop_customers (workshop_id, id, name, phone, email, address, data, created_at, updated_at)
  select p_workshop_id, 'legacy-' || left(repair ->> 'id', 110),
    left(coalesce(repair #>> '{customer,name}', ''), 100), left(coalesce(repair #>> '{customer,phone}', ''), 40),
    left(lower(coalesce(repair #>> '{customer,email}', '')), 160), left(coalesce(repair #>> '{customer,address}', ''), 200),
    coalesce(repair -> 'customer', '{}'::jsonb),
    coalesce(private.safe_timestamptz(repair ->> 'createdAt'), now()), coalesce(private.safe_timestamptz(repair ->> 'updatedAt'), now())
  from jsonb_array_elements(p_repairs) repair
  where coalesce(repair ->> 'customerId', '') = ''
    and coalesce(repair #>> '{customer,name}', repair #>> '{customer,email}', repair #>> '{customer,phone}', '') <> ''
  on conflict (workshop_id, id) do nothing;

  delete from public.workshop_devices where workshop_id = p_workshop_id;
  insert into public.workshop_devices (workshop_id, id, customer_id, category, brand, model, serial, imei, warranty_until, data, created_at, updated_at)
  select p_workshop_id, left(item ->> 'id', 120), left(coalesce(item ->> 'customerId', ''), 120),
    left(coalesce(item ->> 'category', 'other'), 40), left(coalesce(item ->> 'brand', ''), 80),
    left(coalesce(item ->> 'model', ''), 120), left(coalesce(item ->> 'serial', ''), 100),
    left(coalesce(item ->> 'imei', ''), 40), private.safe_date(item ->> 'warrantyUntil'), item,
    coalesce(private.safe_timestamptz(item ->> 'createdAt'), now()), coalesce(private.safe_timestamptz(item ->> 'updatedAt'), now())
  from jsonb_array_elements(v_devices) item where coalesce(item ->> 'id', '') <> '';

  insert into public.workshop_devices (workshop_id, id, customer_id, category, model, serial, data, created_at, updated_at)
  select p_workshop_id, 'legacy-' || left(repair ->> 'id', 110), 'legacy-' || left(repair ->> 'id', 110),
    left(coalesce(repair ->> 'category', 'other'), 40), left(coalesce(repair ->> 'device', ''), 120),
    left(coalesce(repair ->> 'serial', ''), 100), repair,
    coalesce(private.safe_timestamptz(repair ->> 'createdAt'), now()), coalesce(private.safe_timestamptz(repair ->> 'updatedAt'), now())
  from jsonb_array_elements(p_repairs) repair where coalesce(repair ->> 'deviceId', '') = ''
  on conflict (workshop_id, id) do nothing;

  delete from public.workshop_repairs where workshop_id = p_workshop_id;
  insert into public.workshop_repairs (workshop_id, id, customer_id, device_id, status, priority, assigned_to,
    received_on, due_on, completed_at, total, portal_token_hash, data, created_at, updated_at)
  select p_workshop_id, left(repair ->> 'id', 120),
    left(coalesce(nullif(repair ->> 'customerId', ''), 'legacy-' || repair ->> 'id'), 120),
    left(coalesce(nullif(repair ->> 'deviceId', ''), 'legacy-' || repair ->> 'id'), 120),
    left(coalesce(repair ->> 'status', 'intake'), 40),
    case when repair ->> 'priority' in ('low','normal','high','urgent') then repair ->> 'priority' else 'normal' end,
    left(coalesce(repair ->> 'assignedTo', ''), 120), private.safe_date(repair ->> 'received'), private.safe_date(repair ->> 'target'),
    case when repair ->> 'status' = 'completed' then coalesce(private.safe_timestamptz(repair ->> 'completedAt'), private.safe_timestamptz(repair ->> 'updatedAt')) end,
    private.safe_numeric(repair ->> 'total'),
    case when coalesce(repair ->> 'portalToken', '') = '' then '' else encode(extensions.digest(repair ->> 'portalToken', 'sha256'), 'hex') end,
    repair, coalesce(private.safe_timestamptz(repair ->> 'createdAt'), now()), coalesce(private.safe_timestamptz(repair ->> 'updatedAt'), now())
  from jsonb_array_elements(p_repairs) repair where coalesce(repair ->> 'id', '') <> '';

  delete from public.workshop_parts where workshop_id = p_workshop_id;
  insert into public.workshop_parts (workshop_id, id, repair_id, name, sku, quantity, cost, price, order_status, supplier_id, data, updated_at)
  select p_workshop_id, left(coalesce(nullif(part ->> 'id', ''), gen_random_uuid()::text), 120), left(repair ->> 'id', 120),
    left(coalesce(part ->> 'name', ''), 120), left(coalesce(part ->> 'sku', ''), 80),
    greatest(private.safe_numeric(part ->> 'quantity'), 1), private.safe_numeric(part ->> 'cost'), private.safe_numeric(part ->> 'price'),
    left(coalesce(part #>> '{order,status}', ''), 30), left(coalesce(part ->> 'supplierId', ''), 120), part,
    coalesce(private.safe_timestamptz(repair ->> 'updatedAt'), now())
  from jsonb_array_elements(p_repairs) repair
  cross join lateral jsonb_array_elements(case when jsonb_typeof(repair -> 'parts') = 'array' then repair -> 'parts' else '[]'::jsonb end) part;

  delete from public.workshop_inventory where workshop_id = p_workshop_id;
  insert into public.workshop_inventory (workshop_id, id, name, sku, category, compatible_models, supplier_id, quantity,
    minimum_quantity, cost, price, location, data, created_at, updated_at)
  select p_workshop_id, left(item ->> 'id', 120), left(coalesce(item ->> 'name', ''), 120), left(coalesce(item ->> 'sku', ''), 80),
    left(coalesce(item ->> 'category', ''), 80), left(coalesce(item ->> 'compatibleModels', ''), 500),
    left(coalesce(item ->> 'supplierId', ''), 120), private.safe_numeric(item ->> 'quantity'), private.safe_numeric(item ->> 'minimumQuantity'),
    private.safe_numeric(item ->> 'cost'), private.safe_numeric(item ->> 'price'), left(coalesce(item ->> 'location', ''), 120), item,
    coalesce(private.safe_timestamptz(item ->> 'createdAt'), now()), coalesce(private.safe_timestamptz(item ->> 'updatedAt'), now())
  from jsonb_array_elements(v_inventory) item where coalesce(item ->> 'id', '') <> '';

  delete from public.workshop_suppliers where workshop_id = p_workshop_id;
  insert into public.workshop_suppliers (workshop_id, id, name, contact_name, email, phone, website, notes, data, created_at, updated_at)
  select p_workshop_id, left(item ->> 'id', 120), left(coalesce(item ->> 'name', ''), 120), left(coalesce(item ->> 'contactName', ''), 100),
    left(lower(coalesce(item ->> 'email', '')), 160), left(coalesce(item ->> 'phone', ''), 40), left(coalesce(item ->> 'website', ''), 300),
    left(coalesce(item ->> 'notes', ''), 2000), item, coalesce(private.safe_timestamptz(item ->> 'createdAt'), now()),
    coalesce(private.safe_timestamptz(item ->> 'updatedAt'), now())
  from jsonb_array_elements(v_suppliers) item where coalesce(item ->> 'id', '') <> '';

  delete from public.workshop_purchase_orders where workshop_id = p_workshop_id;
  insert into public.workshop_purchase_orders (workshop_id, id, number, supplier_id, status, tracking, ordered_on,
    received_at, item_name, sku, quantity, unit_cost, total, data, created_at, updated_at)
  select p_workshop_id, left(item ->> 'id', 120), left(coalesce(item ->> 'number', ''), 100),
    left(coalesce(item ->> 'supplierId', ''), 120),
    case when item ->> 'status' in ('ordered','shipped','received','cancelled') then item ->> 'status' else 'ordered' end,
    left(coalesce(item ->> 'tracking', ''), 240), private.safe_date(item ->> 'orderedOn'),
    private.safe_timestamptz(item ->> 'receivedAt'), left(coalesce(item ->> 'itemName', ''), 160),
    left(coalesce(item ->> 'sku', ''), 80), greatest(private.safe_numeric(item ->> 'quantity'), 1),
    private.safe_numeric(item ->> 'unitCost'), private.safe_numeric(item ->> 'total'), item,
    coalesce(private.safe_timestamptz(item ->> 'createdAt'), now()), coalesce(private.safe_timestamptz(item ->> 'updatedAt'), now())
  from jsonb_array_elements(v_purchase_orders) item where coalesce(item ->> 'id', '') <> '';

  delete from public.workshop_appointments where workshop_id = p_workshop_id;
  insert into public.workshop_appointments (workshop_id, id, repair_id, customer_id, assigned_to, title, starts_at, ends_at, status, notes, data, created_at, updated_at)
  select p_workshop_id, left(item ->> 'id', 120), left(coalesce(item ->> 'repairId', ''), 120), left(coalesce(item ->> 'customerId', ''), 120),
    left(coalesce(item ->> 'assignedTo', ''), 120), left(coalesce(item ->> 'title', ''), 160), private.safe_timestamptz(item ->> 'startsAt'),
    private.safe_timestamptz(item ->> 'endsAt'), left(coalesce(item ->> 'status', 'scheduled'), 40), left(coalesce(item ->> 'notes', ''), 2000), item,
    coalesce(private.safe_timestamptz(item ->> 'createdAt'), now()), coalesce(private.safe_timestamptz(item ->> 'updatedAt'), now())
  from jsonb_array_elements(v_appointments) item where coalesce(item ->> 'id', '') <> '';

  delete from public.workshop_payments where workshop_id = p_workshop_id;
  insert into public.workshop_payments (workshop_id, id, repair_id, amount, method, status, reference, paid_at, data, created_at)
  select p_workshop_id, left(coalesce(nullif(payment ->> 'id', ''), gen_random_uuid()::text), 120), left(repair ->> 'id', 120),
    private.safe_numeric(payment ->> 'amount'), left(coalesce(payment ->> 'method', 'cash'), 40), left(coalesce(payment ->> 'status', 'paid'), 40),
    left(coalesce(payment ->> 'reference', ''), 160), private.safe_timestamptz(payment ->> 'paidAt'), payment,
    coalesce(private.safe_timestamptz(payment ->> 'createdAt'), now())
  from jsonb_array_elements(p_repairs) repair
  cross join lateral jsonb_array_elements(case when jsonb_typeof(repair -> 'payments') = 'array' then repair -> 'payments' else '[]'::jsonb end) payment;

  delete from public.workshop_estimates where workshop_id = p_workshop_id;
  insert into public.workshop_estimates (workshop_id, id, repair_id, amount, status, note, responded_at, data, created_at, updated_at)
  select p_workshop_id, left(coalesce(nullif(repair #>> '{estimate,id}', ''), 'estimate-' || repair ->> 'id'), 120), left(repair ->> 'id', 120),
    private.safe_numeric(repair #>> '{estimate,amount}'),
    case when repair #>> '{estimate,status}' in ('draft','sent','approved','rejected','expired') then repair #>> '{estimate,status}' else 'draft' end,
    left(coalesce(repair #>> '{estimate,note}', ''), 2000), private.safe_timestamptz(repair #>> '{estimate,respondedAt}'),
    coalesce(repair -> 'estimate', '{}'::jsonb), coalesce(private.safe_timestamptz(repair #>> '{estimate,createdAt}'), now()),
    coalesce(private.safe_timestamptz(repair #>> '{estimate,updatedAt}'), now())
  from jsonb_array_elements(p_repairs) repair where jsonb_typeof(repair -> 'estimate') = 'object';

  delete from public.workshop_attachments where workshop_id = p_workshop_id;
  insert into public.workshop_attachments (workshop_id, id, repair_id, kind, file_name, storage_path, mime_type, size_bytes, uploaded_by, created_at)
  select p_workshop_id, left(coalesce(nullif(attachment ->> 'id', ''), gen_random_uuid()::text), 120), left(repair ->> 'id', 120),
    left(coalesce(attachment ->> 'kind', 'photo'), 40), left(coalesce(attachment ->> 'fileName', ''), 220),
    left(coalesce(attachment ->> 'storagePath', ''), 600), left(coalesce(attachment ->> 'mimeType', ''), 120),
    private.safe_numeric(attachment ->> 'size')::bigint, (select auth.uid()), coalesce(private.safe_timestamptz(attachment ->> 'createdAt'), now())
  from jsonb_array_elements(p_repairs) repair
  cross join lateral jsonb_array_elements(case when jsonb_typeof(repair -> 'attachments') = 'array' then repair -> 'attachments' else '[]'::jsonb end) attachment;
end;
$$;

revoke all on function private.rebuild_workshop_index(uuid, jsonb, jsonb) from public, anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workshop_name text := left(coalesce(new.raw_user_meta_data ->> 'workshop_name', ''), 100);
  v_language text := left(coalesce(new.raw_user_meta_data ->> 'language', 'en'), 10);
  v_country text := left(coalesce(new.raw_user_meta_data ->> 'country', 'US'), 2);
  v_currency text := left(coalesce(new.raw_user_meta_data ->> 'currency', 'USD'), 3);
begin
  insert into public.profiles (id, workshop_name, language, country, currency, active_workshop_id)
  values (new.id, v_workshop_name, v_language, v_country, v_currency, new.id)
  on conflict (id) do nothing;

  insert into public.workshops (id, owner_user_id, name, country, currency)
  values (new.id, new.id, coalesce(nullif(v_workshop_name, ''), 'RepairDesk Workshop'), v_country, v_currency)
  on conflict (id) do nothing;

  insert into public.workshop_members (workshop_id, user_id, role, display_name)
  values (new.id, new.id, 'owner', coalesce(nullif(v_workshop_name, ''), 'Owner'))
  on conflict (workshop_id, user_id) do nothing;

  insert into public.workshop_snapshots (workshop_id)
  values (new.id)
  on conflict (workshop_id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create or replace function public.get_my_workshop()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_workshop_id uuid := private.current_workshop_id();
  v_role text;
  v_workshop jsonb;
  v_members jsonb;
  v_invites jsonb := '[]'::jsonb;
begin
  if v_user_id is null or v_workshop_id is null or not private.is_workshop_member(v_workshop_id) then
    raise exception 'Active workshop access required' using errcode = '42501';
  end if;

  select m.role into v_role from public.workshop_members m
  where m.workshop_id = v_workshop_id and m.user_id = v_user_id and m.status = 'active';

  select jsonb_build_object(
    'id', w.id, 'name', w.name, 'country', w.country, 'currency', w.currency,
    'timezone', w.timezone, 'plan', w.plan, 'status', w.status, 'settings', w.settings,
    'created_at', w.created_at, 'updated_at', w.updated_at
  ) into v_workshop from public.workshops w where w.id = v_workshop_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'user_id', member_row.user_id, 'email', member_row.email, 'display_name', member_row.display_name,
    'role', member_row.role, 'status', member_row.status, 'joined_at', member_row.joined_at
  ) order by member_row.role, member_row.joined_at), '[]'::jsonb)
  into v_members
  from (
    select m.user_id, lower(coalesce(u.email, '')) as email,
      coalesce(nullif(m.display_name, ''), split_part(coalesce(u.email, ''), '@', 1)) as display_name,
      m.role, m.status, m.joined_at
    from public.workshop_members m
    left join auth.users u on u.id = m.user_id
    where m.workshop_id = v_workshop_id
  ) member_row;

  if v_role in ('owner', 'manager') then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', i.id, 'email', i.email, 'role', i.role, 'expires_at', i.expires_at,
      'accepted_at', i.accepted_at, 'created_at', i.created_at
    ) order by i.created_at desc), '[]'::jsonb)
    into v_invites
    from public.workshop_invites i
    where i.workshop_id = v_workshop_id and i.accepted_at is null and i.expires_at > now();
  end if;

  return jsonb_build_object('workshop', v_workshop, 'role', v_role, 'members', v_members, 'invites', v_invites);
end;
$$;

revoke all on function public.get_my_workshop() from public, anon;
grant execute on function public.get_my_workshop() to authenticated;

create or replace function public.get_workshop_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_workshop_id uuid := private.current_workshop_id();
  v_snapshot jsonb;
begin
  if (select auth.uid()) is null or v_workshop_id is null or not private.is_workshop_member(v_workshop_id) then
    raise exception 'Active workshop access required' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'workshop_id', s.workshop_id, 'repairs', s.repairs, 'settings', s.settings,
    'deleted_repairs', s.deleted_repairs, 'revision', s.revision,
    'last_device_id', s.last_device_id, 'updated_at', s.updated_at
  ) into v_snapshot
  from public.workshop_snapshots s where s.workshop_id = v_workshop_id;
  return v_snapshot;
end;
$$;

revoke all on function public.get_workshop_snapshot() from public, anon;
grant execute on function public.get_workshop_snapshot() to authenticated;

create or replace function public.save_workshop_data(
  p_repairs jsonb,
  p_settings jsonb,
  p_deleted_repairs jsonb,
  p_expected_revision bigint,
  p_device_id text,
  p_app_version text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_workshop_id uuid := private.current_workshop_id();
  v_role text;
  v_revision bigint;
  v_updated_at timestamptz;
begin
  if v_user_id is null or v_workshop_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  select m.role into v_role from public.workshop_members m
  join public.profiles p on p.id = m.user_id
  where m.workshop_id = v_workshop_id and m.user_id = v_user_id and m.status = 'active' and p.account_status = 'active';
  if v_role is null or v_role = 'viewer' then
    raise exception 'Workshop write access required' using errcode = '42501';
  end if;
  if not coalesce(private.is_app_admin(), false) and (
    exists (select 1 from public.app_feature_flags f where f.key = 'maintenance_mode' and f.enabled)
    or exists (
      select 1 from public.app_feature_flags f
      where f.key = 'minimum_app_version' and f.enabled
        and private.version_code(p_app_version) < private.version_code(f.value)
    )
  ) then
    raise exception 'Cloud workspace is temporarily read-only' using errcode = '42501';
  end if;
  if p_repairs is null or p_settings is null or p_deleted_repairs is null
    or jsonb_typeof(p_repairs) <> 'array' or jsonb_typeof(p_settings) <> 'object'
    or jsonb_typeof(p_deleted_repairs) <> 'array' then
    raise exception 'Invalid snapshot shape';
  end if;
  if octet_length(p_repairs::text) + octet_length(p_settings::text) + octet_length(p_deleted_repairs::text) > 8500000 then
    raise exception 'Snapshot is too large';
  end if;

  insert into public.workshop_snapshots (workshop_id)
  values (v_workshop_id)
  on conflict (workshop_id) do nothing;

  select revision, updated_at into v_revision, v_updated_at
  from public.workshop_snapshots where workshop_id = v_workshop_id for update;

  if p_expected_revision is not null and p_expected_revision <> v_revision then
    insert into public.sync_health_events (workshop_id, user_id, device_id, result, revision, app_version)
    values (v_workshop_id, v_user_id, left(coalesce(p_device_id, ''), 100), 'conflict', v_revision, left(coalesce(p_app_version, ''), 30));
    return jsonb_build_object('ok', false, 'conflict', true, 'revision', v_revision, 'updated_at', v_updated_at);
  end if;

  update public.workshop_snapshots
  set repairs = p_repairs, settings = p_settings, deleted_repairs = p_deleted_repairs,
      revision = revision + 1, last_device_id = left(coalesce(p_device_id, ''), 100), updated_at = now()
  where workshop_id = v_workshop_id
  returning revision, updated_at into v_revision, v_updated_at;

  insert into public.app_data (user_id, repairs, settings, deleted_repairs, revision, last_device_id, updated_at)
  values (v_user_id, p_repairs, p_settings, p_deleted_repairs, v_revision, left(coalesce(p_device_id, ''), 100), v_updated_at)
  on conflict (user_id) do update set repairs = excluded.repairs, settings = excluded.settings,
    deleted_repairs = excluded.deleted_repairs, revision = excluded.revision,
    last_device_id = excluded.last_device_id, updated_at = excluded.updated_at;

  perform private.rebuild_workshop_index(v_workshop_id, p_repairs, p_settings);

  insert into public.sync_health_events (workshop_id, user_id, device_id, result, revision, app_version)
  values (v_workshop_id, v_user_id, left(coalesce(p_device_id, ''), 100), 'success', v_revision, left(coalesce(p_app_version, ''), 30));
  insert into public.workshop_activity (workshop_id, actor_user_id, event_type, target_type, target_id, data)
  values (v_workshop_id, v_user_id, 'workspace_synced', 'workspace', v_workshop_id::text,
    jsonb_build_object('revision', v_revision, 'device_id', left(coalesce(p_device_id, ''), 100)));

  update public.workshops
  set name = left(coalesce(nullif(p_settings #>> '{workshop,name}', ''), name), 100),
      country = left(coalesce(nullif(p_settings ->> 'country', ''), country), 2),
      currency = left(coalesce(nullif(p_settings ->> 'currency', ''), currency), 3),
      updated_at = now()
  where id = v_workshop_id;

  return jsonb_build_object('ok', true, 'workshop_id', v_workshop_id, 'revision', v_revision, 'updated_at', v_updated_at);
end;
$$;

revoke all on function public.save_workshop_data(jsonb, jsonb, jsonb, bigint, text, text) from public, anon;
grant execute on function public.save_workshop_data(jsonb, jsonb, jsonb, bigint, text, text) to authenticated;

create or replace function public.save_user_data(
  p_repairs jsonb,
  p_settings jsonb,
  p_deleted_repairs jsonb,
  p_expected_revision bigint,
  p_device_id text
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.save_workshop_data(p_repairs, p_settings, p_deleted_repairs, p_expected_revision, p_device_id, 'legacy');
$$;

revoke all on function public.save_user_data(jsonb, jsonb, jsonb, bigint, text) from public, anon;
grant execute on function public.save_user_data(jsonb, jsonb, jsonb, bigint, text) to authenticated;

create or replace function public.create_workshop_invite(p_email text, p_role text default 'technician')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_workshop_id uuid := private.current_workshop_id();
  v_email text := lower(trim(coalesce(p_email, '')));
  v_token text := encode(extensions.gen_random_bytes(24), 'hex');
  v_id uuid;
  v_expires timestamptz := now() + interval '7 days';
begin
  if v_user_id is null or v_workshop_id is null or not private.can_manage_workshop(v_workshop_id) then
    raise exception 'Workshop manager access required' using errcode = '42501';
  end if;
  if v_email !~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then raise exception 'Valid email required'; end if;
  if p_role not in ('manager', 'technician', 'viewer') then raise exception 'Invalid workshop role'; end if;

  delete from public.workshop_invites where workshop_id = v_workshop_id and email = v_email and accepted_at is null;
  insert into public.workshop_invites (workshop_id, email, role, token_hash, invited_by, expires_at)
  values (v_workshop_id, v_email, p_role, encode(extensions.digest(v_token, 'sha256'), 'hex'), v_user_id, v_expires)
  returning id into v_id;
  insert into public.workshop_activity (workshop_id, actor_user_id, event_type, target_type, target_id, data)
  values (v_workshop_id, v_user_id, 'member_invited', 'invite', v_id::text, jsonb_build_object('email', v_email, 'role', p_role));
  return jsonb_build_object('id', v_id, 'token', v_token, 'email', v_email, 'role', p_role, 'expires_at', v_expires);
end;
$$;

revoke all on function public.create_workshop_invite(text, text) from public, anon;
grant execute on function public.create_workshop_invite(text, text) to authenticated;

create or replace function public.accept_workshop_invite(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_email text := lower(coalesce((select auth.jwt() ->> 'email'), ''));
  v_invite public.workshop_invites%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into v_invite from public.workshop_invites
  where token_hash = encode(extensions.digest(trim(coalesce(p_token, '')), 'sha256'), 'hex')
    and accepted_at is null and expires_at > now() for update;
  if not found then raise exception 'Invitation is invalid or expired'; end if;
  if lower(v_invite.email) <> v_email then raise exception 'Invitation belongs to another email address' using errcode = '42501'; end if;

  insert into public.workshop_members (workshop_id, user_id, role, display_name)
  values (v_invite.workshop_id, v_user_id, v_invite.role, split_part(v_email, '@', 1))
  on conflict (workshop_id, user_id) do update set role = excluded.role, status = 'active', updated_at = now();
  update public.profiles set active_workshop_id = v_invite.workshop_id where id = v_user_id;
  update public.workshop_invites set accepted_at = now() where id = v_invite.id;
  insert into public.workshop_activity (workshop_id, actor_user_id, event_type, target_type, target_id, data)
  values (v_invite.workshop_id, v_user_id, 'member_joined', 'member', v_user_id::text, jsonb_build_object('role', v_invite.role));
  return jsonb_build_object('ok', true, 'workshop_id', v_invite.workshop_id, 'role', v_invite.role);
end;
$$;

revoke all on function public.accept_workshop_invite(text) from public, anon;
grant execute on function public.accept_workshop_invite(text) to authenticated;

create or replace function public.update_workshop_member(p_user_id uuid, p_role text, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_workshop_id uuid := private.current_workshop_id();
begin
  if v_actor is null or v_workshop_id is null or not private.can_manage_workshop(v_workshop_id) then
    raise exception 'Workshop manager access required' using errcode = '42501';
  end if;
  if p_user_id = v_actor then raise exception 'Use another owner before changing your own access'; end if;
  if p_role not in ('manager','technician','viewer') or p_status not in ('active','suspended') then raise exception 'Invalid member update'; end if;
  update public.workshop_members set role = p_role, status = p_status, updated_at = now()
  where workshop_id = v_workshop_id and user_id = p_user_id and role <> 'owner';
  if not found then raise exception 'Member not found'; end if;
  insert into public.workshop_activity (workshop_id, actor_user_id, event_type, target_type, target_id, data)
  values (v_workshop_id, v_actor, 'member_updated', 'member', p_user_id::text, jsonb_build_object('role', p_role, 'status', p_status));
  return jsonb_build_object('ok', true, 'user_id', p_user_id, 'role', p_role, 'status', p_status);
end;
$$;

revoke all on function public.update_workshop_member(uuid, text, text) from public, anon;
grant execute on function public.update_workshop_member(uuid, text, text) to authenticated;

create or replace function public.get_runtime_config()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'flags', coalesce((select jsonb_object_agg(f.key, jsonb_build_object('enabled', f.enabled, 'rollout_percent', f.rollout_percent, 'value', f.value, 'description', f.description)) from public.app_feature_flags f), '{}'::jsonb),
    'announcements', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'title', a.title, 'message', a.message, 'kind', a.kind, 'starts_at', a.starts_at, 'ends_at', a.ends_at) order by a.created_at desc)
      from public.app_announcements a where a.active and a.starts_at <= now() and (a.ends_at is null or a.ends_at > now()) and (
        a.audience = 'all'
        or (a.audience = 'admins' and coalesce(private.is_app_admin(), false))
        or (a.audience = 'active' and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.account_status = 'active'))
        or (a.audience = 'inactive' and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.last_seen_at < now() - interval '30 days'))
      )), '[]'::jsonb),
    'latest_release', (select jsonb_build_object('version', r.version, 'title', r.title, 'notes', r.notes, 'released_at', r.released_at) from public.app_releases r where r.status = 'released' order by r.released_at desc nulls last limit 1)
  );
$$;

revoke all on function public.get_runtime_config() from public;
grant execute on function public.get_runtime_config() to anon, authenticated;

create or replace function public.get_public_repair_status(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash text := encode(extensions.digest(trim(coalesce(p_token, '')), 'sha256'), 'hex');
  v_recent integer;
  v_result jsonb;
begin
  select count(*) into v_recent from private.portal_events where token_hash = v_hash and created_at > now() - interval '10 minutes';
  if v_recent > 120 then raise exception 'Too many requests'; end if;
  insert into private.portal_events (token_hash, event_type) values (v_hash, 'status_viewed');
  select jsonb_build_object(
    'repair_id', r.id, 'workshop_name', w.name, 'currency', w.currency,
    'device', coalesce(nullif(r.data ->> 'device', ''), d.model),
    'category', coalesce(r.data ->> 'category', d.category),
    'status', r.status, 'priority', r.priority,
    'received_on', r.received_on, 'due_on', r.due_on, 'updated_at', r.updated_at,
    'issue', left(coalesce(r.data ->> 'issue', ''), 240),
    'estimate', case when e.id is null then null else jsonb_build_object('amount', e.amount, 'status', e.status, 'note', e.note, 'updated_at', e.updated_at) end,
    'paid', coalesce((select sum(p.amount) from public.workshop_payments p where p.workshop_id = r.workshop_id and p.repair_id = r.id and p.status = 'paid'), 0),
    'total', r.total,
    'documents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'kind', document_row.key, 'number', left(coalesce(document_row.value ->> 'number', ''), 100),
        'created_at', private.safe_timestamptz(document_row.value ->> 'createdAt')
      ) order by private.safe_timestamptz(document_row.value ->> 'createdAt') desc nulls last)
      from jsonb_each(case when jsonb_typeof(r.data -> 'documents') = 'object' then r.data -> 'documents' else '{}'::jsonb end) document_row
    ), '[]'::jsonb)
  ) into v_result
  from public.workshop_repairs r
  join public.workshops w on w.id = r.workshop_id
  left join public.workshop_devices d on d.workshop_id = r.workshop_id and d.id = r.device_id
  left join public.workshop_estimates e on e.workshop_id = r.workshop_id and e.repair_id = r.id
  where r.portal_token_hash = v_hash
  limit 1;
  if v_result is null then raise exception 'Repair link is invalid or expired' using errcode = 'P0002'; end if;
  return v_result;
end;
$$;

revoke all on function public.get_public_repair_status(text) from public;
grant execute on function public.get_public_repair_status(text) to anon, authenticated;

create or replace function public.respond_to_public_estimate(p_token text, p_response text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash text := encode(extensions.digest(trim(coalesce(p_token, '')), 'sha256'), 'hex');
  v_status text;
  v_workshop_id uuid;
  v_repair_id text;
begin
  if p_response not in ('approved','rejected') then raise exception 'Invalid estimate response'; end if;
  select workshop_id, id into v_workshop_id, v_repair_id from public.workshop_repairs where portal_token_hash = v_hash limit 1;
  if v_workshop_id is null then raise exception 'Repair link is invalid or expired' using errcode = 'P0002'; end if;
  update public.workshop_estimates set status = p_response, responded_at = now(), updated_at = now()
  where workshop_id = v_workshop_id and repair_id = v_repair_id and status in ('sent','draft')
  returning status into v_status;
  if v_status is null then raise exception 'Estimate is not awaiting a response'; end if;
  insert into private.portal_events (token_hash, event_type) values (v_hash, 'estimate_' || p_response);
  insert into public.workshop_activity (workshop_id, event_type, target_type, target_id, data)
  values (v_workshop_id, 'estimate_' || p_response, 'repair', v_repair_id, jsonb_build_object('source', 'customer_portal'));
  return jsonb_build_object('ok', true, 'status', v_status, 'responded_at', now());
end;
$$;

revoke all on function public.respond_to_public_estimate(text, text) from public;
grant execute on function public.respond_to_public_estimate(text, text) to anon, authenticated;

create or replace function public.get_portal_updates(p_repair_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_workshop_id uuid := private.current_workshop_id();
  v_result jsonb;
begin
  if (select auth.uid()) is null or not private.is_workshop_member(v_workshop_id) then raise exception 'Workshop access required' using errcode = '42501'; end if;
  select jsonb_build_object('estimate_status', e.status, 'responded_at', e.responded_at)
  into v_result from public.workshop_estimates e where e.workshop_id = v_workshop_id and e.repair_id = left(coalesce(p_repair_id, ''), 120);
  return coalesce(v_result, '{}'::jsonb);
end;
$$;

revoke all on function public.get_portal_updates(text) from public, anon;
grant execute on function public.get_portal_updates(text) to authenticated;

create or replace function public.get_admin_dashboard_v034(
  p_from date default (current_date - 29),
  p_to date default current_date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_from date := greatest(coalesce(p_from, current_date - 29), current_date - 364);
  v_to date := least(coalesce(p_to, current_date), current_date);
  v_days integer;
  v_previous_from date;
  v_previous_to date;
  v_totals jsonb;
  v_previous jsonb;
  v_funnel jsonb;
  v_retention jsonb;
  v_daily jsonb;
  v_repair_statuses jsonb;
  v_repair_categories jsonb;
  v_events jsonb;
  v_product_usage jsonb;
  v_versions jsonb;
  v_countries jsonb;
  v_feedback jsonb;
  v_audit jsonb;
  v_system jsonb;
  v_security jsonb;
  v_releases jsonb;
  v_flags jsonb;
  v_announcements jsonb;
begin
  if (select auth.uid()) is null or not coalesce(private.is_app_admin(), false) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if v_from > v_to then v_from := v_to; end if;
  v_days := (v_to - v_from) + 1;
  v_previous_to := v_from - 1;
  v_previous_from := v_previous_to - (v_days - 1);

  select jsonb_build_object(
    'total_users', (select count(*) from public.profiles),
    'registered', (select count(*) from public.profiles p where p.created_at >= v_from and p.created_at < v_to + 1),
    'confirmed', (select count(*) from auth.users u where u.email_confirmed_at is not null),
    'unconfirmed', (select count(*) from auth.users u where u.email_confirmed_at is null),
    'onboarded', (select count(*) from public.profiles p where p.onboarding_completed),
    'suspended', (select count(*) from public.profiles p where p.account_status = 'suspended'),
    'active_today', (select count(distinct e.user_id) from public.analytics_events e where e.created_at >= current_date),
    'active_7d', (select count(distinct e.user_id) from public.analytics_events e where e.created_at >= current_date - interval '6 days'),
    'active_30d', (select count(distinct e.user_id) from public.analytics_events e where e.created_at >= current_date - interval '29 days'),
    'active_period', (select count(distinct e.user_id) from public.analytics_events e where e.created_at >= v_from and e.created_at < v_to + 1),
    'returning_period', (select count(*) from (select e.user_id from public.analytics_events e where e.created_at >= v_from and e.created_at < v_to + 1 group by e.user_id having count(distinct e.created_at::date) >= 2) r),
    'churned_period', (select count(*) from (
      select distinct e.user_id from public.analytics_events e where e.created_at >= v_previous_from and e.created_at < v_previous_to + 1
      except
      select distinct e.user_id from public.analytics_events e where e.created_at >= v_from and e.created_at < v_to + 1
    ) churned),
    'workshops', (select count(*) from public.workshops w where w.status = 'active'),
    'team_members', (select count(*) from public.workshop_members m where m.status = 'active'),
    'repairs_total', (select count(*) from public.workshop_repairs),
    'repairs_created', (select count(*) from public.workshop_repairs r where r.created_at >= v_from and r.created_at < v_to + 1),
    'repairs_completed', (select count(*) from public.workshop_repairs r where r.completed_at >= v_from and r.completed_at < v_to + 1),
    'open_feedback', (select count(*) from public.feedback f where f.status in ('new','reviewing','planned')),
    'events', (select count(*) from public.analytics_events e where e.created_at >= v_from and e.created_at < v_to + 1),
    'gross_value', (select coalesce(sum(r.total),0) from public.workshop_repairs r where r.created_at >= v_from and r.created_at < v_to + 1),
    'payments', (select coalesce(sum(p.amount),0) from public.workshop_payments p where p.status = 'paid' and p.paid_at >= v_from and p.paid_at < v_to + 1)
  ) into v_totals;

  select jsonb_build_object(
    'registered', (select count(*) from public.profiles p where p.created_at >= v_previous_from and p.created_at < v_previous_to + 1),
    'active', (select count(distinct e.user_id) from public.analytics_events e where e.created_at >= v_previous_from and e.created_at < v_previous_to + 1),
    'repairs_created', (select count(*) from public.workshop_repairs r where r.created_at >= v_previous_from and r.created_at < v_previous_to + 1),
    'repairs_completed', (select count(*) from public.workshop_repairs r where r.completed_at >= v_previous_from and r.completed_at < v_previous_to + 1),
    'events', (select count(*) from public.analytics_events e where e.created_at >= v_previous_from and e.created_at < v_previous_to + 1)
  ) into v_previous;

  select jsonb_build_array(
    jsonb_build_object('key','registered','count',(select count(*) from public.profiles)),
    jsonb_build_object('key','confirmed','count',(select count(*) from auth.users where email_confirmed_at is not null)),
    jsonb_build_object('key','onboarded','count',(select count(*) from public.profiles where onboarding_completed)),
    jsonb_build_object('key','first_repair','count',(select count(distinct w.owner_user_id) from public.workshops w join public.workshop_repairs r on r.workshop_id = w.id)),
    jsonb_build_object('key','returned','count',(select count(*) from (select user_id from public.analytics_events group by user_id having count(distinct created_at::date) >= 2) x))
  ) into v_funnel;

  select coalesce(jsonb_agg(jsonb_build_object(
    'cohort', cohort_row.cohort, 'users', cohort_row.users,
    'd1', cohort_row.d1, 'd7', cohort_row.d7, 'd30', cohort_row.d30
  ) order by cohort_row.cohort), '[]'::jsonb)
  into v_retention
  from (
    select date_trunc('week', u.created_at)::date as cohort, count(*) as users,
      count(*) filter (where exists (select 1 from public.analytics_events e where e.user_id = u.id and e.created_at::date >= u.created_at::date + 1)) as d1,
      count(*) filter (where exists (select 1 from public.analytics_events e where e.user_id = u.id and e.created_at::date >= u.created_at::date + 7)) as d7,
      count(*) filter (where exists (select 1 from public.analytics_events e where e.user_id = u.id and e.created_at::date >= u.created_at::date + 30)) as d30
    from auth.users u
    where u.created_at >= current_date - interval '84 days'
    group by date_trunc('week', u.created_at)::date
  ) cohort_row;

  select coalesce(jsonb_agg(jsonb_build_object(
    'day', series.day, 'active_users', coalesce(day_events.active_users,0),
    'events', coalesce(day_events.events,0), 'repairs_created', coalesce(day_repairs.created,0),
    'repairs_completed', coalesce(day_repairs.completed,0)
  ) order by series.day), '[]'::jsonb)
  into v_daily
  from (select generate_series(v_from, v_to, interval '1 day')::date as day) series
  left join (
    select e.created_at::date as day, count(*) as events, count(distinct e.user_id) as active_users
    from public.analytics_events e where e.created_at >= v_from and e.created_at < v_to + 1 group by e.created_at::date
  ) day_events on day_events.day = series.day
  left join (
    select d.day, sum(d.created) as created, sum(d.completed) as completed from (
      select r.created_at::date as day, count(*) as created, 0 as completed from public.workshop_repairs r where r.created_at >= v_from and r.created_at < v_to + 1 group by r.created_at::date
      union all
      select r.completed_at::date as day, 0 as created, count(*) as completed from public.workshop_repairs r where r.completed_at >= v_from and r.completed_at < v_to + 1 group by r.completed_at::date
    ) d group by d.day
  ) day_repairs on day_repairs.day = series.day;

  select coalesce(jsonb_agg(jsonb_build_object('name', x.status, 'count', x.count) order by x.count desc), '[]'::jsonb)
  into v_repair_statuses from (select status, count(*) from public.workshop_repairs group by status) x;
  select coalesce(jsonb_agg(jsonb_build_object('name', x.category, 'count', x.count) order by x.count desc), '[]'::jsonb)
  into v_repair_categories from (select coalesce(nullif(data ->> 'category',''),'other') category, count(*) from public.workshop_repairs group by coalesce(nullif(data ->> 'category',''),'other')) x;
  select coalesce(jsonb_agg(jsonb_build_object('name', x.event_name, 'count', x.count) order by x.count desc), '[]'::jsonb)
  into v_events from (select event_name, count(*) from public.analytics_events where created_at >= v_from and created_at < v_to + 1 group by event_name order by count(*) desc limit 20) x;
  select jsonb_build_array(
    jsonb_build_object('name', 'repairs', 'count', (select count(*) from public.workshop_repairs)),
    jsonb_build_object('name', 'customers', 'count', (select count(*) from public.workshop_customers)),
    jsonb_build_object('name', 'devices', 'count', (select count(*) from public.workshop_devices)),
    jsonb_build_object('name', 'parts', 'count', (select count(*) from public.workshop_parts)),
    jsonb_build_object('name', 'inventory', 'count', (select count(*) from public.workshop_inventory)),
    jsonb_build_object('name', 'suppliers', 'count', (select count(*) from public.workshop_suppliers)),
    jsonb_build_object('name', 'purchase_orders', 'count', (select count(*) from public.workshop_purchase_orders)),
    jsonb_build_object('name', 'appointments', 'count', (select count(*) from public.workshop_appointments)),
    jsonb_build_object('name', 'estimates', 'count', (select count(*) from public.workshop_estimates)),
    jsonb_build_object('name', 'payments', 'count', (select count(*) from public.workshop_payments)),
    jsonb_build_object('name', 'attachments', 'count', (select count(*) from public.workshop_attachments)),
    jsonb_build_object('name', 'documents', 'count', (select coalesce(sum(case when jsonb_typeof(r.data -> 'documents') = 'object' then jsonb_object_length(r.data -> 'documents') else 0 end), 0) from public.workshop_repairs r))
  ) into v_product_usage;
  select coalesce(jsonb_agg(jsonb_build_object('name', x.app_version, 'count', x.count) order by x.count desc), '[]'::jsonb)
  into v_versions from (select coalesce(nullif(app_version,''),'unknown') app_version, count(distinct user_id) count from public.analytics_events where created_at >= v_from and created_at < v_to + 1 group by coalesce(nullif(app_version,''),'unknown')) x;
  select coalesce(jsonb_agg(jsonb_build_object('name', x.country, 'count', x.count) order by x.count desc), '[]'::jsonb)
  into v_countries from (select upper(coalesce(nullif(country,''),'--')) country, count(*) from public.profiles group by upper(coalesce(nullif(country,''),'--'))) x;

  select coalesce(jsonb_agg(to_jsonb(feedback_row) order by feedback_row.created_at desc), '[]'::jsonb)
  into v_feedback
  from (
    select f.id, f.user_id, lower(coalesce(u.email,'')) user_email, coalesce(p.workshop_name,'') workshop_name,
      f.type, f.category, f.priority, f.message, f.page, f.app_version, f.status,
      f.admin_note, f.release_version, f.created_at, f.updated_at
    from public.feedback f left join auth.users u on u.id = f.user_id left join public.profiles p on p.id = f.user_id
    order by f.created_at desc limit 200
  ) feedback_row;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id, 'action', a.action, 'target_type', a.target_type, 'target_id', a.target_id,
    'details', a.details, 'created_at', a.created_at, 'admin_email', lower(coalesce(u.email,''))
  ) order by a.created_at desc), '[]'::jsonb)
  into v_audit from private.admin_audit_log a left join auth.users u on u.id = a.admin_user_id
  where a.created_at >= current_date - interval '90 days';

  select jsonb_build_object(
    'sync_success_24h', (select count(*) from public.sync_health_events where result = 'success' and created_at >= now() - interval '24 hours'),
    'sync_conflicts_24h', (select count(*) from public.sync_health_events where result = 'conflict' and created_at >= now() - interval '24 hours'),
    'sync_success_rate_30d', (select case when count(*) = 0 then 100 else round(100.0 * count(*) filter (where result='success') / count(*), 1) end from public.sync_health_events where created_at >= now() - interval '30 days'),
    'stale_workspaces_30d', (select count(*) from public.workshop_snapshots where updated_at < now() - interval '30 days'),
    'snapshot_bytes', (select coalesce(sum(pg_column_size(repairs)::bigint + pg_column_size(settings)::bigint + pg_column_size(deleted_repairs)::bigint),0) from public.workshop_snapshots),
    'attachment_bytes', (select coalesce(sum((metadata ->> 'size')::bigint),0) from storage.objects where bucket_id = 'repair-attachments' and coalesce(metadata ->> 'size','') ~ '^[0-9]+$'),
    'database_bytes', pg_database_size(current_database()),
    'analytics_events', (select count(*) from public.analytics_events),
    'auth_users', (select count(*) from auth.users),
    'last_sync_at', (select max(created_at) from public.sync_health_events),
    'latest_event_at', (select max(created_at) from public.analytics_events)
  ) into v_system;

  select jsonb_build_object(
    'recent_devices_30d', (select count(*) from (select distinct s.user_id, s.device_id from public.sync_health_events s where s.created_at >= now() - interval '30 days' and s.device_id <> '') devices),
    'rejected_syncs_24h', (select count(*) from public.sync_health_events s where s.result in ('conflict', 'rejected') and s.created_at >= now() - interval '24 hours'),
    'suspended_accounts', (select count(*) from public.profiles p where p.account_status = 'suspended'),
    'admin_actions_24h', (select count(*) from private.admin_audit_log a where a.created_at >= now() - interval '24 hours')
  ) into v_security;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.released_at desc nulls last), '[]'::jsonb) into v_releases from public.app_releases r;
  select coalesce(jsonb_agg(to_jsonb(f) order by f.key), '[]'::jsonb) into v_flags from public.app_feature_flags f;
  select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at desc), '[]'::jsonb) into v_announcements from public.app_announcements a;

  return jsonb_build_object(
    'range', jsonb_build_object('from',v_from,'to',v_to,'days',v_days,'previous_from',v_previous_from,'previous_to',v_previous_to),
    'totals', v_totals, 'previous', v_previous, 'funnel', v_funnel, 'retention', v_retention,
    'daily', v_daily, 'repair_statuses', v_repair_statuses, 'repair_categories', v_repair_categories,
    'event_breakdown', v_events, 'product_usage', v_product_usage, 'version_breakdown', v_versions, 'country_breakdown', v_countries,
    'feedback', v_feedback, 'audit', v_audit, 'system', v_system, 'security', v_security,
    'releases', v_releases, 'flags', v_flags, 'announcements', v_announcements, 'generated_at', now()
  );
end;
$$;

revoke all on function public.get_admin_dashboard_v034(date, date) from public, anon;
grant execute on function public.get_admin_dashboard_v034(date, date) to authenticated;

create or replace function public.get_admin_users_v034(
  p_query text default '',
  p_filter text default 'all',
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_query text := left(trim(coalesce(p_query,'')),120);
  v_filter text := coalesce(p_filter,'all');
  v_limit integer := least(greatest(coalesce(p_limit,50),1),100);
  v_offset integer := least(greatest(coalesce(p_offset,0),0),10000);
  v_total bigint;
  v_users jsonb;
begin
  if (select auth.uid()) is null or not private.is_app_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
  if v_filter not in ('all','new','active','unconfirmed','no_repairs','inactive','sync_issues','suspended') then v_filter := 'all'; end if;

  with user_rows as (
    select u.id, u.email, u.email_confirmed_at, u.created_at, u.last_sign_in_at,
      p.workshop_name, p.country, p.language, p.currency, p.onboarding_completed, p.last_seen_at, p.account_status, p.is_admin,
      p.active_workshop_id, w.plan, w.status workshop_status,
      s.updated_at last_sync_at, coalesce(s.revision,0) revision,
      coalesce(jsonb_array_length(s.repairs),0) repair_count,
      case when s.workshop_id is null then 0 else pg_column_size(s.repairs)::bigint + pg_column_size(s.settings)::bigint + pg_column_size(s.deleted_repairs)::bigint end snapshot_bytes,
      coalesce((select count(*) from public.sync_health_events se where se.user_id=u.id and se.result='conflict' and se.created_at>=now()-interval '30 days'),0) sync_conflicts,
      coalesce((select count(*) from public.feedback f where f.user_id=u.id and f.status in ('new','reviewing','planned')),0) open_feedback
    from auth.users u
    left join public.profiles p on p.id=u.id
    left join public.workshops w on w.id=p.active_workshop_id
    left join public.workshop_snapshots s on s.workshop_id=p.active_workshop_id
  ), filtered as (
    select * from user_rows r where
      (v_query='' or coalesce(r.email,'') ilike '%'||v_query||'%' or coalesce(r.workshop_name,'') ilike '%'||v_query||'%' or coalesce(r.country,'') ilike '%'||v_query||'%')
      and case v_filter
        when 'new' then r.created_at>=now()-interval '7 days'
        when 'active' then coalesce(r.last_seen_at,r.last_sign_in_at)>=now()-interval '7 days'
        when 'unconfirmed' then r.email_confirmed_at is null
        when 'no_repairs' then r.repair_count=0
        when 'inactive' then coalesce(r.last_seen_at,r.last_sign_in_at,r.created_at)<now()-interval '30 days'
        when 'sync_issues' then r.sync_conflicts>0 or (r.last_sync_at is not null and r.last_sync_at<now()-interval '30 days')
        when 'suspended' then r.account_status='suspended'
        else true end
  )
  select count(*) into v_total from filtered;

  with user_rows as (
    select u.id, lower(coalesce(u.email,'')) email, u.email_confirmed_at, u.created_at, u.last_sign_in_at,
      p.workshop_name, p.country, p.language, p.currency, p.onboarding_completed, p.last_seen_at, p.account_status, p.is_admin,
      p.active_workshop_id, w.plan, w.status workshop_status,
      s.updated_at last_sync_at, coalesce(s.revision,0) revision, coalesce(jsonb_array_length(s.repairs),0) repair_count,
      case when s.workshop_id is null then 0 else pg_column_size(s.repairs)::bigint + pg_column_size(s.settings)::bigint + pg_column_size(s.deleted_repairs)::bigint end snapshot_bytes,
      coalesce((select count(*) from public.sync_health_events se where se.user_id=u.id and se.result='conflict' and se.created_at>=now()-interval '30 days'),0) sync_conflicts,
      coalesce((select count(*) from public.feedback f where f.user_id=u.id and f.status in ('new','reviewing','planned')),0) open_feedback
    from auth.users u left join public.profiles p on p.id=u.id left join public.workshops w on w.id=p.active_workshop_id left join public.workshop_snapshots s on s.workshop_id=p.active_workshop_id
  ), filtered as (
    select * from user_rows r where
      (v_query='' or r.email ilike '%'||v_query||'%' or coalesce(r.workshop_name,'') ilike '%'||v_query||'%' or coalesce(r.country,'') ilike '%'||v_query||'%')
      and case v_filter
        when 'new' then r.created_at>=now()-interval '7 days' when 'active' then coalesce(r.last_seen_at,r.last_sign_in_at)>=now()-interval '7 days'
        when 'unconfirmed' then r.email_confirmed_at is null when 'no_repairs' then r.repair_count=0
        when 'inactive' then coalesce(r.last_seen_at,r.last_sign_in_at,r.created_at)<now()-interval '30 days'
        when 'sync_issues' then r.sync_conflicts>0 or (r.last_sync_at is not null and r.last_sync_at<now()-interval '30 days')
        when 'suspended' then r.account_status='suspended' else true end
    order by coalesce(r.last_seen_at,r.last_sign_in_at,r.created_at) desc
    limit v_limit offset v_offset
  )
  select coalesce(jsonb_agg(to_jsonb(filtered)), '[]'::jsonb) into v_users from filtered;
  return jsonb_build_object('total',v_total,'users',v_users,'limit',v_limit,'offset',v_offset,'filter',v_filter,'generated_at',now());
end;
$$;

revoke all on function public.get_admin_users_v034(text, text, integer, integer) from public, anon;
grant execute on function public.get_admin_users_v034(text, text, integer, integer) to authenticated;

create or replace function public.get_admin_user_detail(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_result jsonb;
begin
  if (select auth.uid()) is null or not private.is_app_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
  select jsonb_build_object(
    'user', jsonb_build_object('id',u.id,'email',lower(coalesce(u.email,'')),'created_at',u.created_at,'confirmed_at',u.email_confirmed_at,'last_sign_in_at',u.last_sign_in_at),
    'profile', to_jsonb(p),
    'workshop', case when w.id is null then null else jsonb_build_object('id',w.id,'name',w.name,'plan',w.plan,'status',w.status,'created_at',w.created_at,'updated_at',w.updated_at) end,
    'workspace', case when s.workshop_id is null then null else jsonb_build_object('revision',s.revision,'last_sync_at',s.updated_at,'repairs',jsonb_array_length(s.repairs),'bytes',pg_column_size(s.repairs)::bigint+pg_column_size(s.settings)::bigint+pg_column_size(s.deleted_repairs)::bigint) end,
    'repair_summary', coalesce((select jsonb_build_object('total',count(*),'open',count(*) filter(where r.status not in ('completed','cancelled')),'completed',count(*) filter(where r.status='completed'),'value',coalesce(sum(r.total),0)) from public.workshop_repairs r where r.workshop_id=p.active_workshop_id), '{}'::jsonb),
    'recent_events', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (select event_name,properties,app_version,created_at from public.analytics_events where user_id=u.id order by created_at desc limit 40)x),'[]'::jsonb),
    'feedback', coalesce((select jsonb_agg(to_jsonb(f) order by f.created_at desc) from public.feedback f where f.user_id=u.id),'[]'::jsonb),
    'sync', coalesce((select jsonb_agg(to_jsonb(se) order by se.created_at desc) from (select result,revision,device_id,app_version,created_at from public.sync_health_events where user_id=u.id order by created_at desc limit 30)se),'[]'::jsonb),
    'support_notes', coalesce((select jsonb_agg(jsonb_build_object('id',n.id,'note',n.note,'created_at',n.created_at,'admin_email',lower(coalesce(au.email,''))) order by n.created_at desc) from private.admin_support_notes n left join auth.users au on au.id=n.admin_user_id where n.user_id=u.id),'[]'::jsonb)
  ) into v_result
  from auth.users u left join public.profiles p on p.id=u.id left join public.workshops w on w.id=p.active_workshop_id left join public.workshop_snapshots s on s.workshop_id=p.active_workshop_id
  where u.id=p_user_id;
  if v_result is null then raise exception 'User not found'; end if;
  return v_result;
end;
$$;

revoke all on function public.get_admin_user_detail(uuid) from public, anon;
grant execute on function public.get_admin_user_detail(uuid) to authenticated;

create or replace function public.get_admin_workspaces(p_query text default '', p_limit integer default 100, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb; v_total bigint;
begin
  if (select auth.uid()) is null or not private.is_app_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
  select count(*) into v_total
  from public.workshops w left join auth.users u on u.id=w.owner_user_id
  where trim(coalesce(p_query,''))='' or w.name ilike '%'||trim(p_query)||'%' or coalesce(u.email,'') ilike '%'||trim(p_query)||'%';
  select jsonb_build_object('total',v_total,'workspaces',coalesce(jsonb_agg(to_jsonb(x) order by x.updated_at desc),'[]'::jsonb)) into v_result
  from (
    select w.id,w.name,w.country,w.currency,w.plan,w.status,w.created_at,w.updated_at,
      lower(coalesce(u.email,'')) owner_email,count(distinct m.user_id) members,
      count(distinct r.id) repairs,count(distinct c.id) customers,count(distinct d.id) devices,
      s.revision,s.updated_at last_sync_at,
      case when s.workshop_id is null then 0 else pg_column_size(s.repairs)::bigint+pg_column_size(s.settings)::bigint+pg_column_size(s.deleted_repairs)::bigint end bytes
    from public.workshops w left join auth.users u on u.id=w.owner_user_id left join public.workshop_members m on m.workshop_id=w.id and m.status='active'
    left join public.workshop_repairs r on r.workshop_id=w.id left join public.workshop_customers c on c.workshop_id=w.id
    left join public.workshop_devices d on d.workshop_id=w.id left join public.workshop_snapshots s on s.workshop_id=w.id
    where trim(coalesce(p_query,''))='' or w.name ilike '%'||trim(p_query)||'%' or coalesce(u.email,'') ilike '%'||trim(p_query)||'%'
    group by w.id,u.email,s.workshop_id,s.revision,s.updated_at,s.repairs,s.settings,s.deleted_repairs
    order by w.updated_at desc limit least(greatest(coalesce(p_limit,100),1),200) offset greatest(coalesce(p_offset,0),0)
  ) x;
  return coalesce(v_result,jsonb_build_object('total',v_total,'workspaces','[]'::jsonb));
end; $$;

revoke all on function public.get_admin_workspaces(text, integer, integer) from public, anon;
grant execute on function public.get_admin_workspaces(text, integer, integer) to authenticated;

create or replace function public.admin_update_user_status(p_user_id uuid, p_status text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_admin uuid:=(select auth.uid()); v_previous text;
begin
  if v_admin is null or not private.is_app_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
  if p_user_id=v_admin then raise exception 'The active owner account cannot be suspended'; end if;
  if p_status not in ('active','suspended','deletion_requested') then raise exception 'Invalid account status'; end if;
  select account_status into v_previous from public.profiles where id=p_user_id for update;
  if not found then raise exception 'User not found'; end if;
  update public.profiles set account_status=p_status where id=p_user_id;
  insert into private.admin_audit_log(admin_user_id,action,target_type,target_id,details)
  values(v_admin,'account_status_changed','user',p_user_id::text,jsonb_build_object('from',v_previous,'to',p_status));
  return jsonb_build_object('ok',true,'user_id',p_user_id,'status',p_status);
end; $$;

revoke all on function public.admin_update_user_status(uuid, text) from public, anon;
grant execute on function public.admin_update_user_status(uuid, text) to authenticated;

create or replace function public.admin_delete_user(p_user_id uuid, p_email_confirmation text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_admin uuid:=(select auth.uid()); v_email text;
begin
  if v_admin is null or not private.is_app_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
  if p_user_id=v_admin then raise exception 'The active owner account cannot be deleted'; end if;
  select lower(coalesce(email,'')) into v_email from auth.users where id=p_user_id;
  if v_email='' or v_email<>lower(trim(coalesce(p_email_confirmation,''))) then raise exception 'Email confirmation does not match'; end if;
  insert into private.admin_audit_log(admin_user_id,action,target_type,target_id,details)
  values(v_admin,'account_deleted','user',p_user_id::text,jsonb_build_object('email',v_email));
  delete from auth.users where id=p_user_id;
  return jsonb_build_object('ok',true,'deleted',p_user_id);
end; $$;

revoke all on function public.admin_delete_user(uuid, text) from public, anon;
grant execute on function public.admin_delete_user(uuid, text) to authenticated;

create or replace function public.admin_export_user_data(p_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb;
begin
  if (select auth.uid()) is null or not private.is_app_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
  select jsonb_build_object('exported_at',now(),'user',jsonb_build_object('id',u.id,'email',u.email,'created_at',u.created_at),
    'profile',to_jsonb(p),'workshop',to_jsonb(w),'snapshot',case when s.workshop_id is null then null else jsonb_build_object('repairs',s.repairs,'settings',s.settings,'deleted_repairs',s.deleted_repairs,'revision',s.revision,'updated_at',s.updated_at) end,
    'feedback',coalesce((select jsonb_agg(to_jsonb(f)) from public.feedback f where f.user_id=u.id),'[]'::jsonb),
    'analytics',coalesce((select jsonb_agg(to_jsonb(e)) from public.analytics_events e where e.user_id=u.id),'[]'::jsonb)) into v_result
  from auth.users u left join public.profiles p on p.id=u.id left join public.workshops w on w.id=p.active_workshop_id left join public.workshop_snapshots s on s.workshop_id=p.active_workshop_id where u.id=p_user_id;
  if v_result is null then raise exception 'User not found'; end if;
  return v_result;
end; $$;

revoke all on function public.admin_export_user_data(uuid) from public, anon;
grant execute on function public.admin_export_user_data(uuid) to authenticated;

create or replace function public.admin_add_support_note(p_user_id uuid, p_note text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_admin uuid:=(select auth.uid()); v_id bigint; v_note text:=left(trim(coalesce(p_note,'')),2000);
begin
  if v_admin is null or not private.is_app_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
  if char_length(v_note)<1 then raise exception 'Support note is required'; end if;
  insert into private.admin_support_notes(user_id,admin_user_id,note) values(p_user_id,v_admin,v_note) returning id into v_id;
  insert into private.admin_audit_log(admin_user_id,action,target_type,target_id,details) values(v_admin,'support_note_added','user',p_user_id::text,jsonb_build_object('note_id',v_id));
  return jsonb_build_object('ok',true,'id',v_id,'created_at',now());
end; $$;

revoke all on function public.admin_add_support_note(uuid, text) from public, anon;
grant execute on function public.admin_add_support_note(uuid, text) to authenticated;

create or replace function public.admin_update_feedback(p_id bigint,p_status text,p_priority text,p_category text,p_admin_note text,p_release_version text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_admin uuid:=(select auth.uid()); v_before jsonb; v_after jsonb;
begin
  if v_admin is null or not private.is_app_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
  if p_status not in ('new','reviewing','planned','resolved','closed') or p_priority not in ('low','normal','high','urgent') then raise exception 'Invalid feedback update'; end if;
  select to_jsonb(f) into v_before from public.feedback f where f.id=p_id for update;
  if v_before is null then raise exception 'Feedback not found'; end if;
  update public.feedback f set status=p_status,priority=p_priority,category=left(trim(coalesce(p_category,'general')),60),
    admin_note=left(trim(coalesce(p_admin_note,'')),2000),release_version=left(trim(coalesce(p_release_version,'')),30)
  where f.id=p_id returning to_jsonb(f) into v_after;
  insert into private.admin_audit_log(admin_user_id,action,target_type,target_id,details)
  values(v_admin,'feedback_updated','feedback',p_id::text,jsonb_build_object('before',v_before-'message','after',v_after-'message'));
  return v_after;
end; $$;

revoke all on function public.admin_update_feedback(bigint, text, text, text, text, text) from public, anon;
grant execute on function public.admin_update_feedback(bigint, text, text, text, text, text) to authenticated;

drop function if exists public.admin_set_feature_flag(text, boolean, integer, text);

create or replace function public.admin_set_feature_flag(p_key text,p_enabled boolean,p_rollout integer,p_description text default '',p_value text default '')
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_admin uuid:=(select auth.uid()); v_result jsonb;
begin
  if v_admin is null or not private.is_app_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
  insert into public.app_feature_flags as f(key,enabled,rollout_percent,description,value,updated_by,updated_at)
  values(left(trim(p_key),80),coalesce(p_enabled,false),least(greatest(coalesce(p_rollout,100),0),100),left(coalesce(p_description,''),500),left(trim(coalesce(p_value,'')),120),v_admin,now())
  on conflict(key) do update set enabled=excluded.enabled,rollout_percent=excluded.rollout_percent,description=excluded.description,value=excluded.value,updated_by=v_admin,updated_at=now()
  returning to_jsonb(f) into v_result;
  insert into private.admin_audit_log(admin_user_id,action,target_type,target_id,details) values(v_admin,'feature_flag_updated','feature_flag',p_key,v_result);
  return v_result;
end; $$;

revoke all on function public.admin_set_feature_flag(text, boolean, integer, text, text) from public, anon;
grant execute on function public.admin_set_feature_flag(text, boolean, integer, text, text) to authenticated;

create or replace function public.admin_publish_announcement(p_title text,p_message text,p_kind text,p_audience text,p_ends_at timestamptz default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_admin uuid:=(select auth.uid()); v_result jsonb;
begin
  if v_admin is null or not private.is_app_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
  if p_kind not in ('info','success','warning','critical') or p_audience not in ('all','admins','active','inactive') then raise exception 'Invalid announcement'; end if;
  insert into public.app_announcements as a(title,message,kind,audience,ends_at,created_by)
  values(left(trim(p_title),160),left(trim(p_message),2000),p_kind,p_audience,p_ends_at,v_admin)
  returning to_jsonb(a) into v_result;
  insert into private.admin_audit_log(admin_user_id,action,target_type,target_id,details) values(v_admin,'announcement_published','announcement',v_result->>'id',v_result-'message');
  return v_result;
end; $$;

revoke all on function public.admin_publish_announcement(text, text, text, text, timestamptz) from public, anon;
grant execute on function public.admin_publish_announcement(text, text, text, text, timestamptz) to authenticated;

create or replace function public.admin_record_action(p_action text,p_target_type text,p_target_id text,p_details jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_admin uuid:=(select auth.uid()); v_id bigint;
begin
  if v_admin is null or not private.is_app_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
  insert into private.admin_audit_log(admin_user_id,action,target_type,target_id,details)
  values(v_admin,left(regexp_replace(coalesce(p_action,''),'[^a-zA-Z0-9_.-]','','g'),80),left(coalesce(p_target_type,''),40),left(coalesce(p_target_id,''),120),coalesce(p_details,'{}'::jsonb)) returning id into v_id;
  return jsonb_build_object('ok',true,'id',v_id);
end; $$;

revoke all on function public.admin_record_action(text, text, text, jsonb) from public, anon;
grant execute on function public.admin_record_action(text, text, text, jsonb) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('repair-attachments', 'repair-attachments', false, 5242880, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','application/pdf'];

drop policy if exists "repair_attachments_member_select" on storage.objects;
create policy "repair_attachments_member_select" on storage.objects for select to authenticated
using (bucket_id = 'repair-attachments' and private.is_workshop_member(private.path_workshop_id(name)));
drop policy if exists "repair_attachments_member_insert" on storage.objects;
create policy "repair_attachments_member_insert" on storage.objects for insert to authenticated
with check (bucket_id = 'repair-attachments' and private.is_workshop_member(private.path_workshop_id(name)));
drop policy if exists "repair_attachments_member_update" on storage.objects;
create policy "repair_attachments_member_update" on storage.objects for update to authenticated
using (bucket_id = 'repair-attachments' and private.can_manage_workshop(private.path_workshop_id(name)))
with check (bucket_id = 'repair-attachments' and private.can_manage_workshop(private.path_workshop_id(name)));
drop policy if exists "repair_attachments_member_delete" on storage.objects;
create policy "repair_attachments_member_delete" on storage.objects for delete to authenticated
using (bucket_id = 'repair-attachments' and private.can_manage_workshop(private.path_workshop_id(name)));

do $$
declare
  snapshot_row record;
begin
  for snapshot_row in select workshop_id, repairs, settings from public.workshop_snapshots loop
    perform private.rebuild_workshop_index(snapshot_row.workshop_id, snapshot_row.repairs, snapshot_row.settings);
  end loop;
end;
$$;

commit;
