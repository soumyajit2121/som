-- =============================================================================
-- Cricket Team Manager — core schema
-- Business timezone: Asia/Kolkata (IST, +05:30). See docs/DATA_MODEL.md.
-- =============================================================================

create extension if not exists pgcrypto;

create schema if not exists app;
comment on schema app is 'Internal helper functions (not exposed through PostgREST).';

-- ---------------------------------------------------------------------------
-- Enumerations
-- ---------------------------------------------------------------------------
create type public.profile_status as enum ('pending', 'active', 'inactive');
create type public.tournament_status as enum ('upcoming', 'active', 'completed');
create type public.enrollment_status as enum ('interested', 'applied', 'enrolled', 'withdrawn');
create type public.match_category as enum ('tournament', 'practice');
create type public.match_status as enum (
  'draft', 'scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled'
);
create type public.participation_status as enum (
  'not_responded', 'available', 'maybe', 'unavailable', 'confirmed', 'playing'
);
create type public.notification_type as enum (
  'insufficient_players',
  'dummy_opponent',
  'readiness_alert',
  'match_updated',
  'match_cancelled',
  'player_confirmed',
  'general_announcement',
  'test'
);
create type public.notification_channel as enum ('in_app', 'web_push');
create type public.delivery_status as enum (
  'pending', 'sending', 'sent', 'failed_temporary', 'failed_permanent', 'expired', 'skipped'
);

-- ---------------------------------------------------------------------------
-- Generic helpers
-- ---------------------------------------------------------------------------
create or replace function app.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Roles and profiles
-- ---------------------------------------------------------------------------
create table public.app_roles (
  code text primary key check (code ~ '^[a-z_]+$'),
  name text not null,
  description text not null default ''
);

insert into public.app_roles (code, name, description) values
  ('admin', 'Administrator', 'Manages all records, members, roles and notifications.'),
  ('teammate', 'Teammate', 'Reads shared information and manages their own responses.');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  role text not null default 'teammate' references public.app_roles (code),
  status public.profile_status not null default 'pending',
  approved_at timestamptz,
  approved_by uuid references public.profiles (id) on delete set null,
  deactivated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.profiles is 'Non-sensitive player profile. Private contact data lives in profile_private.';
create index profiles_status_idx on public.profiles (status);
create index profiles_role_idx on public.profiles (role) where status = 'active';

create table public.profile_private (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  email text not null check (email = lower(email) and position('@' in email) > 1),
  phone text check (phone is null or phone ~ '^\+?[0-9 ()-]{7,20}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.profile_private is 'Private contact details: readable only by the owner and administrators.';
create unique index profile_private_email_key on public.profile_private (email);

create table public.notification_preferences (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  push_enabled boolean not null default false,
  push_operational_alerts boolean not null default true,
  push_match_updates boolean not null default true,
  push_player_confirmations boolean not null default false,
  push_announcements boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.notification_preferences is
  'In-app notifications are always on; these flags only control the web-push channel.';

-- ---------------------------------------------------------------------------
-- Teams, venues and opponents
-- ---------------------------------------------------------------------------
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  short_name text check (short_name is null or char_length(short_name) between 1 and 12),
  description text check (description is null or char_length(description) <= 1000),
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index teams_name_key on public.teams (lower(name));

create table public.team_memberships (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  squad_role text not null default 'player'
    check (squad_role in ('captain', 'vice_captain', 'wicket_keeper', 'player')),
  is_active boolean not null default true,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, profile_id)
);
comment on table public.team_memberships is 'Registered squad. There is intentionally no squad-size limit.';
create index team_memberships_profile_idx on public.team_memberships (profile_id) where is_active;

create table public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  address text check (address is null or char_length(address) <= 300),
  city text check (city is null or char_length(city) <= 80),
  maps_url text check (maps_url is null or maps_url ~ '^https://'),
  notes text check (notes is null or char_length(notes) <= 1000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index venues_name_key on public.venues (lower(name));

create sequence public.dummy_opponent_seq start 1;

create table public.opponents (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  is_dummy boolean not null default false,
  dummy_number integer unique,
  notes text check (notes is null or char_length(notes) <= 1000),
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint opponents_dummy_number_chk check ((is_dummy and dummy_number is not null) or (not is_dummy and dummy_number is null))
);
comment on column public.opponents.is_dummy is
  'Explicit placeholder flag. Never infer dummy status from the name.';
create unique index opponents_name_key on public.opponents (lower(name));

-- ---------------------------------------------------------------------------
-- Tournaments
-- ---------------------------------------------------------------------------
create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  organizer text check (organizer is null or char_length(organizer) <= 120),
  format text not null default 'T20'
    check (format in ('T10', 'T20', 'ODI', 'Test', 'Box Cricket', 'Tennis Ball', 'Other')),
  start_date date not null,
  end_date date not null,
  venue_id uuid references public.venues (id) on delete set null,
  location text check (location is null or char_length(location) <= 200),
  website_url text check (website_url is null or website_url ~ '^https?://'),
  notes text check (notes is null or char_length(notes) <= 2000),
  status public.tournament_status not null default 'upcoming',
  archived_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tournaments_dates_chk check (end_date >= start_date)
);
comment on column public.tournaments.start_date is 'Calendar date in IST (Asia/Kolkata). Stored as DATE so it never shifts.';
create index tournaments_status_idx on public.tournaments (status, start_date) where archived_at is null;

create table public.tournament_enrollments (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  status public.enrollment_status not null default 'enrolled',
  notes text check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id, team_id)
);
create index tournament_enrollments_team_idx on public.tournament_enrollments (team_id);

-- ---------------------------------------------------------------------------
-- Matches
-- ---------------------------------------------------------------------------
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 2 and 120),
  category public.match_category not null,
  tournament_id uuid references public.tournaments (id) on delete restrict,
  -- Business values exactly as entered in IST:
  match_date date not null,
  start_time time not null,
  reporting_time time,
  timezone text not null default 'Asia/Kolkata' check (timezone = 'Asia/Kolkata'),
  -- Unambiguous instants derived by trigger with AT TIME ZONE (never by manual offsets):
  starts_at timestamptz not null,
  reporting_at timestamptz,
  venue_id uuid references public.venues (id) on delete set null,
  our_team_id uuid not null references public.teams (id) on delete restrict,
  opponent_id uuid not null references public.opponents (id) on delete restrict,
  created_by uuid references public.profiles (id) on delete set null,
  notes text check (notes is null or char_length(notes) <= 2000),
  cricheroes_url text check (cricheroes_url is null or cricheroes_url ~ '^https://'),
  status public.match_status not null default 'scheduled',
  result_summary text check (result_summary is null or char_length(result_summary) <= 500),
  allow_duplicate boolean not null default false,
  cancelled_at timestamptz,
  cancellation_reason text check (cancellation_reason is null or char_length(cancellation_reason) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint matches_category_tournament_chk check (
    (category = 'tournament' and tournament_id is not null)
    or (category = 'practice' and tournament_id is null)
  ),
  constraint matches_reporting_before_start_chk check (reporting_time is null or reporting_time <= start_time),
  constraint matches_cancelled_chk check ((status = 'cancelled') = (cancelled_at is not null))
);
comment on column public.matches.match_date is 'IST calendar date as entered.';
comment on column public.matches.start_time is 'IST wall-clock start time as entered.';
comment on column public.matches.starts_at is 'Derived: (match_date + start_time) AT TIME ZONE timezone.';
create index matches_starts_at_idx on public.matches (starts_at);
create index matches_team_idx on public.matches (our_team_id, starts_at);
create index matches_tournament_idx on public.matches (tournament_id) where tournament_id is not null;
create index matches_opponent_idx on public.matches (opponent_id);
create index matches_created_by_idx on public.matches (created_by);

create table public.match_participants (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  status public.participation_status not null default 'not_responded',
  note text check (note is null or char_length(note) <= 280),
  responded_at timestamptz,
  status_updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (match_id, profile_id)
);
create index match_participants_profile_idx on public.match_participants (profile_id);
create index match_participants_status_idx on public.match_participants (match_id, status);

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null check (endpoint ~ '^https://' and char_length(endpoint) <= 2048),
  p256dh text not null check (char_length(p256dh) between 16 and 256),
  auth text not null check (char_length(auth) between 8 and 64),
  device_label text check (device_label is null or char_length(device_label) <= 120),
  last_success_at timestamptz,
  failure_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.push_subscriptions is 'Private: visible only to the owning user. Endpoints are never logged.';
create unique index push_subscriptions_endpoint_key on public.push_subscriptions (endpoint);
create index push_subscriptions_profile_idx on public.push_subscriptions (profile_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  type public.notification_type not null,
  title text not null check (char_length(title) between 1 and 140),
  body text not null check (char_length(body) between 1 and 1000),
  match_id uuid references public.matches (id) on delete cascade,
  link_path text check (link_path is null or link_path ~ '^/[A-Za-z0-9/_?=&%-]*$'),
  dedupe_key text unique,
  read_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index notifications_recipient_idx on public.notifications (recipient_id, created_at desc);
create index notifications_unread_idx on public.notifications (recipient_id) where read_at is null;
create index notifications_match_idx on public.notifications (match_id);

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications (id) on delete cascade,
  channel public.notification_channel not null,
  subscription_id uuid references public.push_subscriptions (id) on delete set null,
  status public.delivery_status not null default 'pending',
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 3 check (max_attempts between 1 and 10),
  next_attempt_at timestamptz not null default now(),
  last_attempt_at timestamptz,
  response_code integer,
  last_error text check (last_error is null or char_length(last_error) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_deliveries_unique unique nulls not distinct (notification_id, channel, subscription_id)
);
create index notification_deliveries_queue_idx on public.notification_deliveries (status, next_attempt_at)
  where status in ('pending', 'failed_temporary', 'sending');

create table public.reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  reminder_kind text not null check (reminder_kind in ('pre_match_25h')),
  occurrence timestamptz not null,
  conditions text[] not null check (cardinality(conditions) > 0),
  notification_id uuid references public.notifications (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint reminder_deliveries_unique unique (match_id, recipient_id, reminder_kind, occurrence)
);
comment on table public.reminder_deliveries is
  'Idempotency ledger for scheduled reminders: one row per match/recipient/kind/occurrence.';

-- ---------------------------------------------------------------------------
-- Audit
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_values jsonb,
  after_values jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id, created_at desc);
create index audit_logs_created_idx on public.audit_logs (created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'profile_private', 'notification_preferences', 'teams', 'team_memberships',
    'venues', 'opponents', 'tournaments', 'tournament_enrollments', 'matches',
    'match_participants', 'push_subscriptions', 'notification_deliveries'
  ] loop
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function app.set_updated_at()', t
    );
  end loop;
end;
$$;
