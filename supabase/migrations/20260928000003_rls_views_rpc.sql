-- =============================================================================
-- Row-level security, grants, read views and RPC functions.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Baseline privileges: anonymous users get nothing.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon, public;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from anon, public;
revoke all on schema app from anon, public;

-- Server-maintained tables: end users may read (through RLS) but never write.
revoke insert, update, delete, truncate on public.audit_logs from authenticated;
revoke insert, update, delete, truncate on public.reminder_deliveries from authenticated;
revoke insert, update, delete, truncate on public.notification_deliveries from authenticated;
revoke insert, update, delete, truncate on public.app_roles from authenticated;
revoke insert, truncate on public.profiles from authenticated;
revoke insert, delete, truncate on public.profile_private from authenticated;
revoke insert, delete, truncate on public.notification_preferences from authenticated;
revoke usage, select, update on sequence public.dummy_opponent_seq from authenticated;

-- Notifications: only the read marker is writable by the recipient.
revoke insert, update, truncate on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
alter table public.app_roles enable row level security;
alter table public.profiles enable row level security;
alter table public.profile_private enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.teams enable row level security;
alter table public.team_memberships enable row level security;
alter table public.venues enable row level security;
alter table public.opponents enable row level security;
alter table public.tournaments enable row level security;
alter table public.tournament_enrollments enable row level security;
alter table public.matches enable row level security;
alter table public.match_participants enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_deliveries enable row level security;
alter table public.reminder_deliveries enable row level security;
alter table public.audit_logs enable row level security;

-- app_roles ------------------------------------------------------------------
create policy app_roles_read on public.app_roles for select to authenticated using (true);

-- profiles -------------------------------------------------------------------
create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or app.is_admin() or (app.is_active() and status = 'active'));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid() and status <> 'inactive')
  with check (id = auth.uid());
create policy profiles_update_admin on public.profiles for update to authenticated
  using (app.is_admin()) with check (app.is_admin());

-- profile_private (email, phone) ----------------------------------------------
create policy profile_private_read on public.profile_private for select to authenticated
  using (profile_id = auth.uid() or app.is_admin());
create policy profile_private_update on public.profile_private for update to authenticated
  using ((profile_id = auth.uid() and app.is_active()) or app.is_admin())
  with check ((profile_id = auth.uid() and app.is_active()) or app.is_admin());

-- notification_preferences -------------------------------------------------------
create policy notification_preferences_read on public.notification_preferences for select to authenticated
  using (profile_id = auth.uid() or app.is_admin());
create policy notification_preferences_update on public.notification_preferences for update to authenticated
  using (profile_id = auth.uid() and app.is_active())
  with check (profile_id = auth.uid());

-- Reference data readable by all approved members, writable by administrators.
create policy teams_read on public.teams for select to authenticated using (app.is_active());
create policy teams_admin_write on public.teams for all to authenticated
  using (app.is_admin()) with check (app.is_admin());

create policy team_memberships_read on public.team_memberships for select to authenticated using (app.is_active());
create policy team_memberships_admin_write on public.team_memberships for all to authenticated
  using (app.is_admin()) with check (app.is_admin());

create policy venues_read on public.venues for select to authenticated using (app.is_active());
create policy venues_admin_write on public.venues for all to authenticated
  using (app.is_admin()) with check (app.is_admin());

create policy opponents_read on public.opponents for select to authenticated using (app.is_active());
create policy opponents_admin_write on public.opponents for all to authenticated
  using (app.is_admin()) with check (app.is_admin());

create policy tournaments_read on public.tournaments for select to authenticated using (app.is_active());
create policy tournaments_admin_write on public.tournaments for all to authenticated
  using (app.is_admin()) with check (app.is_admin());

create policy tournament_enrollments_read on public.tournament_enrollments for select to authenticated using (app.is_active());
create policy tournament_enrollments_admin_write on public.tournament_enrollments for all to authenticated
  using (app.is_admin()) with check (app.is_admin());

-- matches ----------------------------------------------------------------------
create policy matches_read on public.matches for select to authenticated using (app.is_active());
create policy matches_insert on public.matches for insert to authenticated
  with check (
    app.is_admin()
    or (app.is_active() and created_by = auth.uid() and app.is_team_member(our_team_id))
  );
create policy matches_update on public.matches for update to authenticated
  using (app.is_admin() or (app.is_active() and created_by = auth.uid()))
  with check (app.is_admin() or (app.is_active() and created_by = auth.uid()));
create policy matches_delete on public.matches for delete to authenticated
  using (
    app.is_admin()
    or (
      app.is_active()
      and created_by = auth.uid()
      and status in ('draft', 'scheduled', 'confirmed')
      and not app.match_has_other_participants(id, auth.uid())
    )
  );

-- match_participants -------------------------------------------------------------
create policy participants_read on public.match_participants for select to authenticated using (app.is_active());
create policy participants_insert on public.match_participants for insert to authenticated
  with check (
    app.is_admin()
    or (app.is_active() and profile_id = auth.uid() and app.can_respond_to_match(match_id))
  );
create policy participants_update on public.match_participants for update to authenticated
  using (app.is_admin() or (app.is_active() and profile_id = auth.uid()))
  with check (app.is_admin() or (app.is_active() and profile_id = auth.uid()));
create policy participants_delete on public.match_participants for delete to authenticated
  using (app.is_admin() or (app.is_active() and profile_id = auth.uid()));

-- push_subscriptions: strictly owner-only (administrators cannot read endpoints) --------
create policy push_subscriptions_owner on public.push_subscriptions for all to authenticated
  using (profile_id = auth.uid() and app.is_active())
  with check (profile_id = auth.uid() and app.is_active());

-- notifications --------------------------------------------------------------------
create policy notifications_read on public.notifications for select to authenticated
  using (recipient_id = auth.uid() or app.is_admin());
create policy notifications_mark_read on public.notifications for update to authenticated
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
create policy notifications_delete_own on public.notifications for delete to authenticated
  using (recipient_id = auth.uid());

-- Delivery records and audit history: administrators only --------------------------
create policy notification_deliveries_admin_read on public.notification_deliveries for select to authenticated
  using (app.is_admin());
create policy reminder_deliveries_admin_read on public.reminder_deliveries for select to authenticated
  using (app.is_admin());
create policy audit_logs_admin_read on public.audit_logs for select to authenticated
  using (app.is_admin());

-- ---------------------------------------------------------------------------
-- Read model: match overview with readiness counts (RLS of the caller applies)
-- ---------------------------------------------------------------------------
create or replace view public.match_overview
with (security_invoker = true)
as
select
  m.id,
  m.title,
  m.category,
  m.tournament_id,
  t.name as tournament_name,
  m.match_date,
  m.start_time,
  m.reporting_time,
  m.timezone,
  m.starts_at,
  m.reporting_at,
  m.venue_id,
  v.name as venue_name,
  v.city as venue_city,
  v.maps_url as venue_maps_url,
  m.our_team_id,
  tm.name as our_team_name,
  m.opponent_id,
  o.name as opponent_name,
  o.is_dummy as opponent_is_dummy,
  m.created_by,
  creator.display_name as created_by_name,
  m.notes,
  m.cricheroes_url,
  m.status,
  m.result_summary,
  m.allow_duplicate,
  m.cancelled_at,
  m.cancellation_reason,
  m.created_at,
  m.updated_at,
  coalesce(c.invited_count, 0)::int as invited_count,
  coalesce(c.not_responded_count, 0)::int as not_responded_count,
  coalesce(c.available_count, 0)::int as available_count,
  coalesce(c.maybe_count, 0)::int as maybe_count,
  coalesce(c.unavailable_count, 0)::int as unavailable_count,
  coalesce(c.confirmed_count, 0)::int as confirmed_count,
  coalesce(c.playing_count, 0)::int as playing_count,
  greatest(0, 11 - coalesce(c.confirmed_count, 0))::int as players_needed,
  (
    select count(*)::int
    from public.team_memberships tms
    join public.profiles p on p.id = tms.profile_id
    where tms.team_id = m.our_team_id and tms.is_active and p.status = 'active'
  ) as squad_count
from public.matches m
join public.teams tm on tm.id = m.our_team_id
join public.opponents o on o.id = m.opponent_id
left join public.tournaments t on t.id = m.tournament_id
left join public.venues v on v.id = m.venue_id
left join public.profiles creator on creator.id = m.created_by
left join lateral (
  select
    count(*) as invited_count,
    count(*) filter (where mp.status = 'not_responded') as not_responded_count,
    count(*) filter (where mp.status = 'available') as available_count,
    count(*) filter (where mp.status = 'maybe') as maybe_count,
    count(*) filter (where mp.status = 'unavailable') as unavailable_count,
    count(*) filter (where mp.status in ('confirmed', 'playing')) as confirmed_count,
    count(*) filter (where mp.status = 'playing') as playing_count
  from public.match_participants mp
  where mp.match_id = m.id
) c on true;

grant select on public.match_overview to authenticated;
revoke all on public.match_overview from anon;

-- ---------------------------------------------------------------------------
-- RPC: create a unique dummy opponent ("Dummy Team 001", ...)
-- ---------------------------------------------------------------------------
create or replace function public.create_dummy_opponent()
returns public.opponents
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
  v_row public.opponents;
begin
  if not (app.is_active() or app.is_privileged()) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  loop
    v_n := nextval('public.dummy_opponent_seq');
    begin
      insert into public.opponents (name, is_dummy, dummy_number, created_by)
      values (format('Dummy Team %s', lpad(v_n::text, 3, '0')), true, v_n, auth.uid())
      returning * into v_row;
      return v_row;
    exception when unique_violation then
      -- A real team happens to use this name; try the next number.
      continue;
    end;
  end loop;
end;
$$;
grant execute on function public.create_dummy_opponent() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RPC: administrators post a general announcement to all active members
-- ---------------------------------------------------------------------------
create or replace function public.post_announcement(p_title text, p_body text, p_match_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not app.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_title, ''))) not between 1 and 140
     or char_length(btrim(coalesce(p_body, ''))) not between 1 and 1000 then
    raise exception 'INVALID_INPUT' using errcode = '22023';
  end if;
  insert into public.notifications (recipient_id, type, title, body, match_id, link_path, created_by)
  select p.id, 'general_announcement', btrim(p_title), btrim(p_body), p_match_id,
         case when p_match_id is null then '/notifications' else '/matches/' || p_match_id end,
         auth.uid()
  from public.profiles p
  where p.status = 'active';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
grant execute on function public.post_announcement(text, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: a user sends a test push notification to their own devices
-- ---------------------------------------------------------------------------
create or replace function public.send_test_notification()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not app.is_active() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  insert into public.notifications (recipient_id, type, title, body, link_path, created_by)
  values (auth.uid(), 'test', 'Test notification',
          'Notifications are working on this device.', '/notifications', auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;
grant execute on function public.send_test_notification() to authenticated;

-- ---------------------------------------------------------------------------
-- Scheduler RPCs (service role only)
-- ---------------------------------------------------------------------------

-- Atomically records a reminder and its in-app notification exactly once.
-- Returns the new notification id, or NULL when this reminder already exists.
create or replace function public.record_reminder(
  p_match_id uuid,
  p_recipient_id uuid,
  p_reminder_kind text,
  p_occurrence timestamptz,
  p_conditions text[],
  p_type public.notification_type,
  p_title text,
  p_body text,
  p_link_path text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reminder_id uuid;
  v_notification_id uuid;
begin
  insert into public.reminder_deliveries (match_id, recipient_id, reminder_kind, occurrence, conditions)
  values (p_match_id, p_recipient_id, p_reminder_kind, p_occurrence, p_conditions)
  on conflict on constraint reminder_deliveries_unique do nothing
  returning id into v_reminder_id;

  if v_reminder_id is null then
    return null;
  end if;

  insert into public.notifications (recipient_id, type, title, body, match_id, link_path, dedupe_key)
  values (
    p_recipient_id, p_type, p_title, p_body, p_match_id, p_link_path,
    format('%s:%s:%s:%s', p_reminder_kind, p_match_id, p_recipient_id, extract(epoch from p_occurrence)::bigint)
  )
  returning id into v_notification_id;

  update public.reminder_deliveries set notification_id = v_notification_id where id = v_reminder_id;
  return v_notification_id;
end;
$$;
revoke all on function public.record_reminder(uuid, uuid, text, timestamptz, text[], public.notification_type, text, text, text) from public, anon, authenticated;
grant execute on function public.record_reminder(uuid, uuid, text, timestamptz, text[], public.notification_type, text, text, text) to service_role;

-- Claims due push deliveries with SKIP LOCKED so concurrent scheduler runs
-- never send the same delivery twice. Stale "sending" claims are reclaimed.
create or replace function public.claim_push_deliveries(p_limit integer, p_now timestamptz default now())
returns table (
  delivery_id uuid,
  attempts integer,
  max_attempts integer,
  subscription_id uuid,
  endpoint text,
  p256dh text,
  auth text,
  notification_id uuid,
  notification_type public.notification_type,
  title text,
  body text,
  link_path text,
  match_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with due as (
    select d.id
    from public.notification_deliveries d
    where d.channel = 'web_push'
      and d.attempts < d.max_attempts
      and (
        (d.status in ('pending', 'failed_temporary') and d.next_attempt_at <= p_now)
        or (d.status = 'sending' and d.last_attempt_at < p_now - interval '10 minutes')
      )
    order by d.next_attempt_at
    limit greatest(1, least(p_limit, 500))
    for update skip locked
  ), claimed as (
    update public.notification_deliveries d
    set status = 'sending', attempts = d.attempts + 1, last_attempt_at = p_now
    from due
    where d.id = due.id
    returning d.*
  )
  select c.id, c.attempts, c.max_attempts, s.id, s.endpoint, s.p256dh, s.auth,
         n.id, n.type, n.title, n.body, n.link_path, n.match_id
  from claimed c
  join public.notifications n on n.id = c.notification_id
  left join public.push_subscriptions s on s.id = c.subscription_id;
end;
$$;
revoke all on function public.claim_push_deliveries(integer, timestamptz) from public, anon, authenticated;
grant execute on function public.claim_push_deliveries(integer, timestamptz) to service_role;
