-- =============================================================================
-- Authorization helpers, business-rule triggers, audit logging and
-- notification fan-out. These rules apply to every caller, including direct
-- PostgREST requests made with the public anon key and a user JWT.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Authorization helpers
-- ---------------------------------------------------------------------------

-- True for trusted server contexts: the service-role key, or a direct database
-- session (migrations, seed, psql) with no end-user JWT.
create or replace function app.is_privileged()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'role', '') = 'service_role'
      or (auth.uid() is null and session_user not in ('authenticator', 'anon', 'authenticated'));
$$;

create or replace function app.is_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.status = 'active'
  );
$$;

create or replace function app.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.status = 'active' and p.role = 'admin'
  );
$$;

create or replace function app.can_manage()
returns boolean
language sql
stable
set search_path = ''
as $$
  select app.is_privileged() or app.is_admin();
$$;

create or replace function app.is_team_member(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.team_memberships tm
    join public.profiles p on p.id = tm.profile_id
    where tm.team_id = p_team_id
      and tm.profile_id = auth.uid()
      and tm.is_active
      and p.status = 'active'
  );
$$;

-- A teammate may respond to matches of a team they belong to.
create or replace function app.can_respond_to_match(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.matches m
    where m.id = p_match_id and app.is_team_member(m.our_team_id)
  );
$$;

create or replace function app.match_has_other_participants(p_match_id uuid, p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.match_participants mp
    where mp.match_id = p_match_id and mp.profile_id <> p_profile_id
  );
$$;

grant usage on schema app to authenticated, service_role;
grant execute on all functions in schema app to authenticated, service_role;

-- IST formatting used in database-generated notification text.
create or replace function app.format_ist(p_ts timestamptz)
returns text
language sql
immutable
set search_path = ''
as $$
  select to_char(p_ts at time zone 'Asia/Kolkata', 'DD Mon YYYY, HH12:MI AM') || ' IST';
$$;

-- ---------------------------------------------------------------------------
-- New users -> profile, private contact row and notification preferences
-- ---------------------------------------------------------------------------
create or replace function app.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  v_name := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), '');
  if v_name is null then
    v_name := split_part(coalesce(new.email, 'player'), '@', 1);
  end if;
  v_name := left(v_name, 80);

  -- Role and status are never taken from user-controlled metadata.
  insert into public.profiles (id, display_name) values (new.id, v_name);
  insert into public.profile_private (profile_id, email) values (new.id, lower(new.email));
  insert into public.notification_preferences (profile_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_user();

create or replace function app.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profile_private set email = lower(new.email) where profile_id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function app.handle_user_email_change();

-- ---------------------------------------------------------------------------
-- Profiles: privileged-column protection (prevents mass assignment)
-- ---------------------------------------------------------------------------
create or replace function app.profiles_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id <> old.id or new.created_at <> old.created_at then
    raise exception 'IMMUTABLE_FIELD' using errcode = '42501';
  end if;

  if not app.can_manage() then
    if new.role is distinct from old.role
       or new.status is distinct from old.status
       or new.approved_at is distinct from old.approved_at
       or new.approved_by is distinct from old.approved_by
       or new.deactivated_at is distinct from old.deactivated_at then
      raise exception 'FORBIDDEN_FIELD' using errcode = '42501',
        detail = 'Only administrators can change role or account status.';
    end if;
  end if;

  if new.role = 'admin' and new.status <> 'active' then
    raise exception 'ADMIN_MUST_BE_ACTIVE' using errcode = 'P0001';
  end if;

  if old.role = 'admin' and old.status = 'active'
     and (new.role <> 'admin' or new.status <> 'active')
     and not exists (
       select 1 from public.profiles p
       where p.id <> old.id and p.role = 'admin' and p.status = 'active'
     ) then
    raise exception 'LAST_ADMIN' using errcode = 'P0001',
      detail = 'At least one active administrator is required.';
  end if;

  if new.status = 'active' and old.status <> 'active' then
    new.approved_at := now();
    new.approved_by := auth.uid();
    new.deactivated_at := null;
  elsif new.status = 'inactive' and old.status <> 'inactive' then
    new.deactivated_at := now();
  end if;

  return new;
end;
$$;

create trigger profiles_before_update
  before update on public.profiles
  for each row execute function app.profiles_before_update();

-- Deactivated accounts stop receiving push notifications immediately.
create or replace function app.profiles_after_deactivate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.push_subscriptions where profile_id = new.id;
  update public.notification_preferences set push_enabled = false where profile_id = new.id;
  return null;
end;
$$;

create trigger profiles_after_deactivate
  after update of status on public.profiles
  for each row when (new.status = 'inactive' and old.status <> 'inactive')
  execute function app.profiles_after_deactivate();

create or replace function app.profile_private_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.profile_id <> old.profile_id then
    raise exception 'IMMUTABLE_FIELD' using errcode = '42501';
  end if;
  if new.email is distinct from old.email and not app.is_privileged() then
    raise exception 'FORBIDDEN_FIELD' using errcode = '42501',
      detail = 'Email is managed by the authentication service.';
  end if;
  return new;
end;
$$;

create trigger profile_private_before_update
  before update on public.profile_private
  for each row execute function app.profile_private_before_update();

create or replace function app.notification_preferences_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.profile_id <> old.profile_id then
    raise exception 'IMMUTABLE_FIELD' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger notification_preferences_before_update
  before update on public.notification_preferences
  for each row execute function app.notification_preferences_before_update();

-- ---------------------------------------------------------------------------
-- Matches
-- ---------------------------------------------------------------------------
create or replace function app.matches_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_manage boolean := app.can_manage();
  v_key_changed boolean;
begin
  -- Practice matches never store tournament information.
  if new.category = 'practice' then
    new.tournament_id := null;
  end if;

  -- Derive unambiguous instants from the IST business values.
  new.starts_at := (new.match_date + new.start_time) at time zone new.timezone;
  new.reporting_at := case
    when new.reporting_time is null then null
    else (new.match_date + new.reporting_time) at time zone new.timezone
  end;

  if tg_op = 'INSERT' then
    if not v_manage then
      if new.created_by is distinct from auth.uid() then
        raise exception 'FORBIDDEN' using errcode = '42501', detail = 'created_by must be the current user.';
      end if;
      if new.status not in ('draft', 'scheduled') then
        raise exception 'FORBIDDEN_FIELD' using errcode = '42501', detail = 'Only administrators can set this status.';
      end if;
      if new.allow_duplicate then
        raise exception 'FORBIDDEN_FIELD' using errcode = '42501', detail = 'Only administrators can override duplicates.';
      end if;
      new.result_summary := null;
    end if;
  else
    if new.id <> old.id or new.created_at <> old.created_at then
      raise exception 'IMMUTABLE_FIELD' using errcode = '42501';
    end if;
    if not v_manage then
      if old.created_by is distinct from auth.uid() then
        raise exception 'FORBIDDEN' using errcode = '42501';
      end if;
      if old.status in ('in_progress', 'completed', 'cancelled') then
        raise exception 'MATCH_LOCKED' using errcode = 'P0001';
      end if;
      if new.category is distinct from old.category
         or new.tournament_id is distinct from old.tournament_id
         or new.our_team_id is distinct from old.our_team_id
         or new.opponent_id is distinct from old.opponent_id
         or new.status is distinct from old.status
         or new.result_summary is distinct from old.result_summary
         or new.created_by is distinct from old.created_by
         or new.allow_duplicate is distinct from old.allow_duplicate
         or new.cancellation_reason is distinct from old.cancellation_reason then
        raise exception 'FORBIDDEN_FIELD' using errcode = '42501',
          detail = 'Teammates may edit only the basic details of matches they created.';
      end if;
    end if;
  end if;

  -- Cancellation bookkeeping.
  if new.status = 'cancelled' then
    if tg_op = 'INSERT' or old.status <> 'cancelled' then
      new.cancelled_at := now();
    end if;
  else
    new.cancelled_at := null;
  end if;

  -- Tournament matches require a current enrolment of our team.
  if new.category = 'tournament'
     and (tg_op = 'INSERT'
          or new.tournament_id is distinct from old.tournament_id
          or new.our_team_id is distinct from old.our_team_id) then
    if not exists (
      select 1
      from public.tournament_enrollments te
      join public.tournaments t on t.id = te.tournament_id
      where te.tournament_id = new.tournament_id
        and te.team_id = new.our_team_id
        and te.status = 'enrolled'
        and t.archived_at is null
    ) then
      raise exception 'TEAM_NOT_ENROLLED' using errcode = 'P0001',
        detail = 'Select a tournament in which this team is enrolled.';
    end if;
  end if;

  -- Duplicate-fixture protection (administrators may override explicitly).
  v_key_changed := tg_op = 'INSERT'
    or (new.our_team_id, new.opponent_id, new.match_date, new.start_time, new.tournament_id, new.status)
       is distinct from (old.our_team_id, old.opponent_id, old.match_date, old.start_time, old.tournament_id, old.status);
  if v_key_changed and new.status <> 'cancelled' and not new.allow_duplicate then
    if exists (
      select 1 from public.matches m
      where m.id <> new.id
        and m.status <> 'cancelled'
        and m.our_team_id = new.our_team_id
        and m.opponent_id = new.opponent_id
        and m.match_date = new.match_date
        and m.start_time = new.start_time
        and m.tournament_id is not distinct from new.tournament_id
    ) then
      raise exception 'DUPLICATE_MATCH' using errcode = 'P0001',
        hint = 'A match with the same team, opponent, date, time and tournament already exists.';
    end if;
  end if;

  return new;
end;
$$;

create trigger matches_before_write
  before insert or update on public.matches
  for each row execute function app.matches_before_write();

-- A teammate-created match automatically includes its creator.
create or replace function app.matches_after_insert_add_creator()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.created_by is not null and not exists (
    select 1 from public.profiles p where p.id = new.created_by and p.role = 'admin'
  ) then
    insert into public.match_participants (match_id, profile_id, status)
    values (new.id, new.created_by, 'confirmed')
    on conflict (match_id, profile_id) do nothing;
  end if;
  return null;
end;
$$;

create trigger matches_after_insert_add_creator
  after insert on public.matches
  for each row execute function app.matches_after_insert_add_creator();

-- Verified at commit time: a teammate-created match must include its creator.
create or replace function app.matches_check_creator_participant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.created_by is null
     or exists (select 1 from public.profiles p where p.id = new.created_by and p.role = 'admin')
     or not exists (select 1 from public.matches m where m.id = new.id) then
    return null;
  end if;
  if not exists (
    select 1 from public.match_participants mp
    where mp.match_id = new.id and mp.profile_id = new.created_by
  ) then
    raise exception 'CREATOR_MUST_PARTICIPATE' using errcode = 'P0001';
  end if;
  return null;
end;
$$;

create constraint trigger matches_creator_participant
  after insert on public.matches
  deferrable initially deferred
  for each row execute function app.matches_check_creator_participant();

-- ---------------------------------------------------------------------------
-- Match participants
-- ---------------------------------------------------------------------------
create or replace function app.participants_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_manage boolean := app.can_manage();
  v_match_status public.match_status;
begin
  if tg_op = 'UPDATE' and (new.match_id <> old.match_id or new.profile_id <> old.profile_id) then
    raise exception 'IMMUTABLE_FIELD' using errcode = '42501';
  end if;

  if not v_manage then
    if new.profile_id is distinct from auth.uid() then
      raise exception 'FORBIDDEN' using errcode = '42501',
        detail = 'Teammates may only change their own participation.';
    end if;
    if new.status = 'playing' and (tg_op = 'INSERT' or old.status <> 'playing') then
      raise exception 'FORBIDDEN_FIELD' using errcode = '42501',
        detail = 'Only administrators finalise the playing list.';
    end if;
    select m.status into v_match_status from public.matches m where m.id = new.match_id;
    if v_match_status in ('completed', 'cancelled') then
      raise exception 'MATCH_LOCKED' using errcode = 'P0001';
    end if;
  end if;

  if tg_op = 'INSERT' or new.status is distinct from old.status then
    new.status_updated_by := auth.uid();
    new.responded_at := case when new.status = 'not_responded' then null else now() end;
  else
    new.status_updated_by := old.status_updated_by;
    new.responded_at := old.responded_at;
  end if;
  return new;
end;
$$;

create trigger participants_before_write
  before insert or update on public.match_participants
  for each row execute function app.participants_before_write();

create or replace function app.participants_before_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not app.can_manage() then
    if old.profile_id is distinct from auth.uid() then
      raise exception 'FORBIDDEN' using errcode = '42501';
    end if;
    -- When the whole match is being deleted the parent row is already gone.
    if exists (
      select 1 from public.matches m
      where m.id = old.match_id and m.created_by = old.profile_id
    ) then
      raise exception 'CREATOR_MUST_PARTICIPATE' using errcode = 'P0001',
        detail = 'The creator of a match cannot leave it. Ask an administrator to take ownership or cancel it.';
    end if;
  end if;
  return old;
end;
$$;

create trigger participants_before_delete
  before delete on public.match_participants
  for each row execute function app.participants_before_delete();

-- ---------------------------------------------------------------------------
-- Opponents: dummy numbering is server-controlled
-- ---------------------------------------------------------------------------
create or replace function app.opponents_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.is_dummy is distinct from old.is_dummy or new.dummy_number is distinct from old.dummy_number then
      raise exception 'IMMUTABLE_FIELD' using errcode = '42501',
        detail = 'Replace a dummy opponent on the match instead of converting it.';
    end if;
  elsif new.is_dummy and not app.is_privileged() and current_user <> 'postgres' then
    raise exception 'FORBIDDEN' using errcode = '42501',
      detail = 'Use create_dummy_opponent() to create placeholders.';
  end if;
  return new;
end;
$$;

create trigger opponents_before_write
  before insert or update on public.opponents
  for each row execute function app.opponents_before_write();

-- ---------------------------------------------------------------------------
-- Audit logging
-- ---------------------------------------------------------------------------
create or replace function app.audit_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entity text := tg_argv[0];
  v_before jsonb;
  v_after jsonb;
  v_action text;
  v_id uuid;
  v_old jsonb;
  v_new jsonb;
begin
  if tg_op = 'INSERT' then
    v_new := to_jsonb(new) - 'created_at' - 'updated_at';
    v_after := v_new;
    v_id := new.id;
    v_action := v_entity || '.created';
    if v_entity = 'participant' then v_action := 'participant.added'; end if;
  elsif tg_op = 'DELETE' then
    v_old := to_jsonb(old) - 'created_at' - 'updated_at';
    v_before := v_old;
    v_id := old.id;
    v_action := v_entity || '.deleted';
    if v_entity = 'participant' then v_action := 'participant.removed'; end if;
  else
    v_old := to_jsonb(old) - 'created_at' - 'updated_at';
    v_new := to_jsonb(new) - 'created_at' - 'updated_at';
    select jsonb_object_agg(o.key, o.value) into v_before
      from jsonb_each(v_old) o where o.value is distinct from v_new -> o.key;
    select jsonb_object_agg(n.key, n.value) into v_after
      from jsonb_each(v_new) n where n.value is distinct from v_old -> n.key;
    if v_after is null then
      return null;
    end if;
    v_id := new.id;
    v_action := v_entity || '.updated';

    if v_entity = 'match' then
      if (v_new ->> 'status') = 'cancelled' and (v_old ->> 'status') <> 'cancelled' then
        v_action := 'match.cancelled';
      elsif (v_new ->> 'opponent_id') <> (v_old ->> 'opponent_id') then
        v_before := v_before || jsonb_build_object('opponent_name',
          (select o.name from public.opponents o where o.id = (v_old ->> 'opponent_id')::uuid));
        v_after := v_after || jsonb_build_object('opponent_name',
          (select o.name from public.opponents o where o.id = (v_new ->> 'opponent_id')::uuid));
        if exists (select 1 from public.opponents o where o.id = (v_old ->> 'opponent_id')::uuid and o.is_dummy) then
          v_action := 'match.opponent_replaced';
        end if;
      end if;
    elsif v_entity = 'participant' and v_after ? 'status' then
      v_action := 'participant.status_changed';
    elsif v_entity = 'profile' then
      if v_after ? 'role' then
        v_action := 'profile.role_changed';
      elsif v_after ? 'status' then
        v_action := 'profile.status_changed';
      end if;
    elsif v_entity = 'tournament' and v_after ? 'archived_at' then
      v_action := case when new.archived_at is null then 'tournament.unarchived' else 'tournament.archived' end;
    end if;
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before_values, after_values)
  values (
    (select p.id from public.profiles p where p.id = auth.uid()),
    v_action, v_entity, v_id, v_before, v_after
  );
  return null;
end;
$$;

create trigger audit_tournaments after insert or update or delete on public.tournaments
  for each row execute function app.audit_row('tournament');
create trigger audit_tournament_enrollments after insert or update or delete on public.tournament_enrollments
  for each row execute function app.audit_row('tournament_enrollment');
create trigger audit_matches after insert or update or delete on public.matches
  for each row execute function app.audit_row('match');
create trigger audit_match_participants after insert or update or delete on public.match_participants
  for each row execute function app.audit_row('participant');
create trigger audit_profiles after update or delete on public.profiles
  for each row execute function app.audit_row('profile');
create trigger audit_team_memberships after insert or update or delete on public.team_memberships
  for each row execute function app.audit_row('team_membership');
create trigger audit_teams after insert or update or delete on public.teams
  for each row execute function app.audit_row('team');
create trigger audit_opponents after insert or update or delete on public.opponents
  for each row execute function app.audit_row('opponent');
create trigger audit_venues after insert or update or delete on public.venues
  for each row execute function app.audit_row('venue');

-- ---------------------------------------------------------------------------
-- Notification fan-out
-- ---------------------------------------------------------------------------

-- Every notification is stored in-app first. Push deliveries are queued for
-- each registered device of recipients who opted in for that category.
create or replace function app.notifications_after_insert_queue_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notification_deliveries (notification_id, channel, subscription_id, status)
  select new.id, 'web_push', s.id, 'pending'
  from public.push_subscriptions s
  join public.notification_preferences np on np.profile_id = s.profile_id
  join public.profiles p on p.id = s.profile_id
  where s.profile_id = new.recipient_id
    and p.status = 'active'
    and np.push_enabled
    and case new.type
      when 'insufficient_players' then np.push_operational_alerts
      when 'dummy_opponent' then np.push_operational_alerts
      when 'readiness_alert' then np.push_operational_alerts
      when 'match_updated' then np.push_match_updates
      when 'match_cancelled' then np.push_match_updates
      when 'player_confirmed' then np.push_player_confirmations
      when 'general_announcement' then np.push_announcements
      when 'test' then true
      else false
    end
  on conflict on constraint notification_deliveries_unique do nothing;
  return null;
end;
$$;

create trigger notifications_after_insert_queue_push
  after insert on public.notifications
  for each row execute function app.notifications_after_insert_queue_push();

-- Participants are told when a match is cancelled or its schedule changes.
create or replace function app.matches_after_update_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type public.notification_type;
  v_title text;
  v_body text;
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    v_type := 'match_cancelled';
    v_title := 'Match cancelled';
    v_body := format('%s on %s has been cancelled.', new.title, app.format_ist(new.starts_at));
  elsif new.starts_at is distinct from old.starts_at
     or new.reporting_at is distinct from old.reporting_at
     or new.venue_id is distinct from old.venue_id
     or new.opponent_id is distinct from old.opponent_id then
    v_type := 'match_updated';
    v_title := 'Match updated';
    v_body := format('%s is now scheduled for %s. Open the match for details.', new.title, app.format_ist(new.starts_at));
  else
    return null;
  end if;

  insert into public.notifications (recipient_id, type, title, body, match_id, link_path, created_by)
  select mp.profile_id, v_type, v_title, v_body, new.id, '/matches/' || new.id, auth.uid()
  from public.match_participants mp
  join public.profiles p on p.id = mp.profile_id
  where mp.match_id = new.id
    and p.status = 'active'
    and mp.profile_id is distinct from auth.uid();
  return null;
end;
$$;

create trigger matches_after_update_notify
  after update on public.matches
  for each row execute function app.matches_after_update_notify();

-- Administrators are told when a player confirms themselves.
create or replace function app.participants_after_confirm_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match public.matches%rowtype;
  v_name text;
begin
  if new.status <> 'confirmed'
     or (tg_op = 'UPDATE' and old.status = 'confirmed')
     or new.profile_id is distinct from auth.uid() then
    return null;
  end if;
  select * into v_match from public.matches where id = new.match_id;
  select display_name into v_name from public.profiles where id = new.profile_id;

  insert into public.notifications (recipient_id, type, title, body, match_id, link_path, created_by)
  select p.id, 'player_confirmed', 'Player confirmed',
         format('%s confirmed for %s on %s.', v_name, v_match.title, app.format_ist(v_match.starts_at)),
         v_match.id, '/matches/' || v_match.id, auth.uid()
  from public.profiles p
  where p.role = 'admin' and p.status = 'active' and p.id <> new.profile_id;
  return null;
end;
$$;

create trigger participants_after_confirm_notify
  after insert or update of status on public.match_participants
  for each row execute function app.participants_after_confirm_notify();
