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

commit;
