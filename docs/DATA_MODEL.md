# Data model

All tables live in `public` (exposed through PostgREST, protected by RLS). Helper functions live in the non-exposed `app` schema. Every table has a UUID (or identity) primary key, `created_at`, and — where rows change — `updated_at` maintained by trigger.

```
auth.users 1─1 profiles 1─1 profile_private
                  │  1─1 notification_preferences
                  │  1─* push_subscriptions
                  │  1─* team_memberships *─1 teams 1─* tournament_enrollments *─1 tournaments
                  │  1─* match_participants *─1 matches ─*1 teams (our_team)
                  │                              ├─*1 opponents (is_dummy)
                  │                              ├─*1 tournaments (NULL for practice)
                  │                              └─*1 venues
                  └─ 1─* notifications 1─* notification_deliveries *─1 push_subscriptions
reminder_deliveries (match, recipient, kind, occurrence) ─1 notifications
audit_logs (actor → profiles)
app_roles ← profiles.role
```

## Tables

| Table                      | Purpose                                                                                                                                          | Key constraints                                                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `app_roles`                | Role catalogue (`admin`, `teammate`)                                                                                                             | PK `code`                                                                                                                   |
| `profiles`                 | Non-sensitive player profile: display name, role, status (`pending/active/inactive`), approval & deactivation timestamps                         | FK `auth.users` ON DELETE CASCADE; FK `app_roles`                                                                           |
| `profile_private`          | Email (synced from Auth), optional phone                                                                                                         | 1:1 with profiles; unique email; phone format CHECK                                                                         |
| `notification_preferences` | Push opt-in and per-category flags                                                                                                               | 1:1 with profiles                                                                                                           |
| `teams`                    | Our club's teams                                                                                                                                 | unique `lower(name)`                                                                                                        |
| `team_memberships`         | Registered squad (no size limit), squad role, active flag, joined/left                                                                           | unique `(team_id, profile_id)`                                                                                              |
| `venues`                   | Grounds                                                                                                                                          | unique `lower(name)`; `maps_url` https only                                                                                 |
| `opponents`                | Opposition teams; **`is_dummy`** explicit flag + `dummy_number`                                                                                  | unique `lower(name)`; CHECK dummy ⇔ number; trigger forbids toggling                                                        |
| `tournaments`              | Name, organiser, format, IST `start_date`/`end_date` (DATE), venue/location, website, notes, status (`upcoming/active/completed`), `archived_at` | CHECK `end_date >= start_date`                                                                                              |
| `tournament_enrollments`   | Team ↔ tournament with status (`interested/applied/enrolled/withdrawn`)                                                                          | unique `(tournament_id, team_id)`                                                                                           |
| `matches`                  | See below                                                                                                                                        | CHECKs: category↔tournament, timezone = Asia/Kolkata, reporting ≤ start, cancelled ⇔ `cancelled_at`; FK tournament RESTRICT |
| `match_participants`       | Player ↔ match with participation status, note, responded_at, status_updated_by                                                                  | unique `(match_id, profile_id)`                                                                                             |
| `push_subscriptions`       | Web Push endpoint + keys per device                                                                                                              | unique endpoint; https endpoint CHECK                                                                                       |
| `notifications`            | In-app notification (always created first)                                                                                                       | `dedupe_key` unique; `link_path` must be a relative path                                                                    |
| `notification_deliveries`  | One row per channel/device attempt: status, attempts, max_attempts, next_attempt_at, response code, sanitised error                              | unique NULLS NOT DISTINCT `(notification_id, channel, subscription_id)`                                                     |
| `reminder_deliveries`      | Idempotency ledger for scheduled reminders, with the conditions that fired                                                                       | unique `(match_id, recipient_id, reminder_kind, occurrence)`                                                                |
| `audit_logs`               | Actor, action, entity type/id, changed before/after values                                                                                       | append-only (no write grants)                                                                                               |

### Matches and IST

| Column                         | Type          | Meaning                                                               |
| ------------------------------ | ------------- | --------------------------------------------------------------------- |
| `match_date`                   | `date`        | IST calendar date exactly as entered                                  |
| `start_time`, `reporting_time` | `time`        | IST wall-clock times as entered                                       |
| `timezone`                     | `text`        | always `Asia/Kolkata` (CHECK)                                         |
| `starts_at`, `reporting_at`    | `timestamptz` | derived by trigger: `(match_date + start_time) AT TIME ZONE timezone` |

The original business values can always be reconstructed from `match_date`/`start_time`; `starts_at` is used for ordering and the scheduler.

Other match columns: `title`, `category` (`tournament/practice`), `tournament_id`, `venue_id`, `our_team_id`, `opponent_id`, `created_by`, `notes`, `cricheroes_url`, `status` (`draft/scheduled/confirmed/in_progress/completed/cancelled`), `result_summary`, `allow_duplicate` (admin override), `cancelled_at`, `cancellation_reason`.

## Views

`match_overview` (`security_invoker = true`, so the caller's RLS applies): match + team/opponent/tournament/venue names, `opponent_is_dummy`, counts (`invited`, `not_responded`, `available`, `maybe`, `unavailable`, `confirmed` = confirmed + playing, `playing`), `players_needed = max(0, 11 − confirmed)`, `squad_count`.

## Triggers (summary)

- `on_auth_user_created` → profile (pending, teammate), private row, preferences. Role/status are never read from user metadata.
- `profiles_before_update` → privileged-column protection, last-admin protection, approval/deactivation timestamps; deactivation removes push devices.
- `matches_before_write` → IST derivation, practice ⇒ tournament NULL, teammate field restrictions, enrolment check, duplicate detection, cancellation timestamp.
- `matches_after_insert_add_creator` + deferred `matches_creator_participant` → teammate creators are always participants.
- `participants_before_write` / `participants_before_delete` → self-only changes, no `playing` for teammates, creator can't leave.
- `audit_row` on tournaments, enrolments, matches, participants, profiles, teams, memberships, opponents, venues.
- `matches_after_update_notify`, `participants_after_confirm_notify`, `notifications_after_insert_queue_push` → notification fan-out.

## Retention and deletion

- Tournaments with matches cannot be deleted (FK RESTRICT) — archive them (`archived_at`).
- Matches are normally **cancelled** (kept with `cancelled_at`); admins may delete, which cascades participants, notifications and reminder rows.
- Leaving a squad sets `is_active = false` / `left_at` (history kept).
- Deactivating an account keeps history, blocks access (RLS), removes push subscriptions.
- Deleting a user in Supabase Auth cascades their profile, private data, memberships, participation and notifications; audit rows keep the action with `actor_id = NULL`.
- Audit logs are append-only; prune manually if a retention period is required (e.g. `delete from audit_logs where created_at < now() - interval '3 years'` as the database owner).
