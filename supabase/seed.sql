-- =============================================================================
-- Development seed data. FICTIONAL people only — every address uses the
-- reserved example.com domain. Password for every account: Password123!
-- Dates are relative to "today in IST" so the dashboard always has data.
-- =============================================================================

do $$
declare
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_pw text := extensions.crypt('Password123!', extensions.gen_salt('bf'));
  v_users jsonb := '[
    {"email": "admin@example.com",    "name": "Asha Admin",      "role": "admin",    "status": "active"},
    {"email": "coach@example.com",    "name": "Vikram Coach",    "role": "admin",    "status": "active"},
    {"email": "player01@example.com", "name": "Aarav Demo",      "role": "teammate", "status": "active"},
    {"email": "player02@example.com", "name": "Bhavesh Demo",    "role": "teammate", "status": "active"},
    {"email": "player03@example.com", "name": "Chirag Demo",     "role": "teammate", "status": "active"},
    {"email": "player04@example.com", "name": "Dev Demo",        "role": "teammate", "status": "active"},
    {"email": "player05@example.com", "name": "Eshan Demo",      "role": "teammate", "status": "active"},
    {"email": "player06@example.com", "name": "Farhan Demo",     "role": "teammate", "status": "active"},
    {"email": "player07@example.com", "name": "Gaurav Demo",     "role": "teammate", "status": "active"},
    {"email": "player08@example.com", "name": "Harsh Demo",      "role": "teammate", "status": "active"},
    {"email": "player09@example.com", "name": "Ishaan Demo",     "role": "teammate", "status": "active"},
    {"email": "player10@example.com", "name": "Jay Demo",        "role": "teammate", "status": "active"},
    {"email": "player11@example.com", "name": "Kabir Demo",      "role": "teammate", "status": "active"},
    {"email": "player12@example.com", "name": "Laksh Demo",      "role": "teammate", "status": "active"},
    {"email": "player13@example.com", "name": "Manav Demo",      "role": "teammate", "status": "active"},
    {"email": "player14@example.com", "name": "Neel Demo",       "role": "teammate", "status": "active"},
    {"email": "pending@example.com",  "name": "Pending Newcomer","role": "teammate", "status": "pending"},
    {"email": "inactive@example.com", "name": "Former Player",   "role": "teammate", "status": "inactive"}
  ]';
  u jsonb;
  v_id uuid;
  v_ids uuid[] := '{}';
  v_admin uuid;
  v_team_a uuid;
  v_team_b uuid;
  v_venue1 uuid;
  v_venue2 uuid;
  v_opp_real uuid;
  v_opp_real2 uuid;
  v_dummy1 uuid;
  v_dummy2 uuid;
  v_t1 uuid;
  v_t2 uuid;
  v_t3 uuid;
  v_m1 uuid;
  v_m2 uuid;
  v_m3 uuid;
  v_m4 uuid;
  v_m5 uuid;
  i int;
begin
  -- Accounts -----------------------------------------------------------------
  for u in select * from jsonb_array_elements(v_users) loop
    v_id := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
      u ->> 'email', v_pw, now(),
      '{"provider":"email","providers":["email"]}', jsonb_build_object('display_name', u ->> 'name'),
      now(), now(), '', '', '', ''
    );
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_id, v_id::text,
            jsonb_build_object('sub', v_id::text, 'email', u ->> 'email', 'email_verified', true),
            'email', now(), now(), now());

    update public.profiles
      set status = (u ->> 'status')::public.profile_status
      where id = v_id and (u ->> 'status') <> 'pending';
    update public.profiles set role = u ->> 'role' where id = v_id and (u ->> 'role') = 'admin';
    v_ids := v_ids || v_id;
  end loop;
  v_admin := v_ids[1];

  -- Fictional phone numbers (reserved-looking), visible only to owner/admins.
  update public.profile_private set phone = '+91 90000 00001' where profile_id = v_ids[3];
  update public.profile_private set phone = '+91 90000 00002' where profile_id = v_ids[1];

  -- Teams and squads (no squad-size limit) ----------------------------------
  insert into public.teams (name, short_name, description, created_by)
    values ('Strikers XI', 'STR', 'Our first team. Plays the weekend T20 circuit.', v_admin)
    returning id into v_team_a;
  insert into public.teams (name, short_name, description, created_by)
    values ('Strikers Reserves', 'STR-R', 'Second team for practice and box cricket.', v_admin)
    returning id into v_team_b;

  insert into public.team_memberships (team_id, profile_id, squad_role)
    values (v_team_a, v_ids[1], 'player'), (v_team_a, v_ids[2], 'player');
  for i in 3..16 loop
    insert into public.team_memberships (team_id, profile_id, squad_role)
      values (v_team_a, v_ids[i], case when i = 3 then 'captain' when i = 4 then 'vice_captain' when i = 5 then 'wicket_keeper' else 'player' end);
  end loop;
  for i in 10..16 loop
    insert into public.team_memberships (team_id, profile_id) values (v_team_b, v_ids[i]);
  end loop;
  insert into public.team_memberships (team_id, profile_id, is_active, left_at)
    values (v_team_a, v_ids[18], false, now());

  -- Venues and opponents ----------------------------------------------------
  insert into public.venues (name, address, city, notes)
    values ('Riverside Cricket Ground', 'Ground 2, Riverside Sports Complex', 'Pune', 'Turf wicket. Parking at gate 3.')
    returning id into v_venue1;
  insert into public.venues (name, address, city)
    values ('City Sports Arena', 'Hall B', 'Pune')
    returning id into v_venue2;

  insert into public.opponents (name, created_by) values ('Thunder Cricket Club', v_admin) returning id into v_opp_real;
  insert into public.opponents (name, created_by) values ('Lakeview Warriors', v_admin) returning id into v_opp_real2;
  select id into v_dummy1 from public.create_dummy_opponent();
  select id into v_dummy2 from public.create_dummy_opponent();

  -- Tournaments and enrolments ---------------------------------------------
  insert into public.tournaments (name, organizer, format, start_date, end_date, venue_id, location, website_url, notes, status, created_by)
    values ('Monsoon T20 Cup 2026', 'City Cricket Association (Demo)', 'T20', v_today - 3, v_today + 30, v_venue1,
            'Pune', 'https://example.com/monsoon-cup', 'League stage followed by knockouts.', 'active', v_admin)
    returning id into v_t1;
  insert into public.tournaments (name, organizer, format, start_date, end_date, venue_id, location, status, created_by)
    values ('Winter Box Cricket League', 'Arena Sports (Demo)', 'Box Cricket', v_today + 60, v_today + 90, v_venue2,
            'Pune', 'upcoming', v_admin)
    returning id into v_t2;
  insert into public.tournaments (name, organizer, format, start_date, end_date, location, status, archived_at, created_by)
    values ('Summer Tennis Ball Trophy 2026', 'Demo Organiser', 'Tennis Ball', v_today - 120, v_today - 100,
            'Pune', 'completed', now(), v_admin)
    returning id into v_t3;

  insert into public.tournament_enrollments (tournament_id, team_id, status) values
    (v_t1, v_team_a, 'enrolled'),
    (v_t2, v_team_a, 'enrolled'),
    (v_t2, v_team_b, 'applied'),
    (v_t3, v_team_a, 'enrolled');

  -- Matches -----------------------------------------------------------------
  -- 1. Tournament match tomorrow vs a real opponent: 8 of 11 confirmed.
  insert into public.matches (title, category, tournament_id, match_date, start_time, reporting_time, venue_id,
                              our_team_id, opponent_id, created_by, notes, status)
    values ('League Match 3', 'tournament', v_t1, v_today + 1, '07:00', '06:30', v_venue1,
            v_team_a, v_opp_real, v_admin, 'Whites. Bring your own water.', 'scheduled')
    returning id into v_m1;
  for i in 3..16 loop
    insert into public.match_participants (match_id, profile_id, status) values (v_m1, v_ids[i],
      (case when i <= 10 then 'confirmed' when i = 11 then 'available' when i = 12 then 'maybe'
            when i = 13 then 'unavailable' else 'not_responded' end)::public.participation_status);
  end loop;

  -- 2. Practice match vs a dummy opponent, created by a teammate.
  insert into public.matches (title, category, match_date, start_time, reporting_time, venue_id,
                              our_team_id, opponent_id, created_by, status)
    values ('Sunday Nets Practice Game', 'practice', v_today + 4, '06:30', '06:00', v_venue2,
            v_team_a, v_dummy1, v_ids[3], 'scheduled')
    returning id into v_m2;
  update public.match_participants set status = 'confirmed' where match_id = v_m2;

  -- 3. Tournament match vs a dummy opponent with too few confirmations.
  insert into public.matches (title, category, tournament_id, match_date, start_time, reporting_time, venue_id,
                              our_team_id, opponent_id, created_by, status)
    values ('League Match 4', 'tournament', v_t1, v_today + 8, '15:30', '15:00', v_venue1,
            v_team_a, v_dummy2, v_admin, 'scheduled')
    returning id into v_m3;
  for i in 3..8 loop
    insert into public.match_participants (match_id, profile_id, status) values (v_m3, v_ids[i], 'confirmed');
  end loop;

  -- 4. Practice match with 12 confirmed and a finalised playing XI.
  insert into public.matches (title, category, match_date, start_time, reporting_time, venue_id,
                              our_team_id, opponent_id, created_by, status)
    values ('Friendly vs Lakeview', 'practice', v_today + 10, '07:00', '06:30', v_venue1,
            v_team_a, v_opp_real2, v_admin, 'confirmed')
    returning id into v_m4;
  for i in 3..14 loop
    insert into public.match_participants (match_id, profile_id, status)
      values (v_m4, v_ids[i], (case when i <= 13 then 'playing' else 'confirmed' end)::public.participation_status);
  end loop;

  -- 5. Completed past match.
  insert into public.matches (title, category, tournament_id, match_date, start_time, reporting_time, venue_id,
                              our_team_id, opponent_id, created_by, status, result_summary)
    values ('League Match 2', 'tournament', v_t1, v_today - 2, '07:00', '06:30', v_venue1,
            v_team_a, v_opp_real2, v_admin, 'completed', 'Strikers XI won by 24 runs.')
    returning id into v_m5;
  for i in 3..13 loop
    insert into public.match_participants (match_id, profile_id, status) values (v_m5, v_ids[i], 'playing');
  end loop;

  -- Sample notifications -----------------------------------------------------
  insert into public.notifications (recipient_id, type, title, body, match_id, link_path) values
    (v_ids[1], 'dummy_opponent', 'Placeholder opponent',
     'Sunday Nets Practice Game vs Dummy Team 001 still uses a placeholder opponent. Replace it and update CricHeroes.',
     v_m2, '/matches/' || v_m2),
    (v_ids[1], 'player_confirmed', 'Player confirmed', 'Chirag Demo confirmed for Sunday Nets Practice Game.',
     v_m2, '/matches/' || v_m2),
    (v_ids[3], 'general_announcement', 'Welcome to the new team app',
     'Please mark your availability for every match you can play.', null, '/notifications'),
    (v_ids[3], 'match_updated', 'Match updated', 'League Match 3 reporting time is 06:30 AM IST.',
     v_m1, '/matches/' || v_m1);
  update public.notifications set read_at = now() where recipient_id = v_ids[3] and type = 'general_announcement';
end;
$$;
