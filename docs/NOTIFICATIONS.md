# Notifications

## Channels

| Channel          | V1                                                         | Where                                                                                           |
| ---------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| In-app           | **always**                                                 | `notifications` table → Notifications tab, unread badge                                         |
| Web Push         | when the recipient enabled push and has registered devices | `notification_deliveries` (channel `web_push`)                                                  |
| Email / WhatsApp | not in V1                                                  | add a new `notification_channel` enum value + a sender implementing `PushSender`-like interface |

Every notification is written in-app first. A trigger (`notifications_after_insert_queue_push`) then queues one `pending` delivery per registered device of the recipient, if `push_enabled` and the category flag allow it. Push failures never touch the in-app row.

## Types and who receives them

| Type                                                      | Created by                                 | Recipients                                 | Push category flag                        |
| --------------------------------------------------------- | ------------------------------------------ | ------------------------------------------ | ----------------------------------------- |
| `insufficient_players`                                    | scheduler (25 h)                           | active administrators                      | `push_operational_alerts`                 |
| `dummy_opponent`                                          | scheduler (25 h)                           | active administrators                      | `push_operational_alerts`                 |
| `readiness_alert` (both conditions, one combined message) | scheduler (25 h)                           | active administrators                      | `push_operational_alerts`                 |
| `match_updated`                                           | trigger on date/time/venue/opponent change | participants of that match (not the actor) | `push_match_updates`                      |
| `match_cancelled`                                         | trigger on cancel                          | participants of that match                 | `push_match_updates`                      |
| `player_confirmed`                                        | trigger when a player confirms themselves  | administrators                             | `push_player_confirmations` (default off) |
| `general_announcement`                                    | `post_announcement` RPC (admin)            | all active members                         | `push_announcements`                      |
| `test`                                                    | `send_test_notification` RPC               | the requesting user                        | always (if devices exist)                 |

Teammates only receive match notifications for matches they participate in.

## 25-hour reminder

- **Window**: a match is due when `starts_at − 25 h ≤ now < starts_at` and status is `draft`, `scheduled` or `confirmed`. Computed on absolute instants; `starts_at` is derived from the IST date/time in Postgres. A late or missed scheduler run still sends the reminder as long as the match hasn't started.
- **Conditions**: A = confirmed (confirmed + playing) < 11; B = `opponents.is_dummy`. A+B → a single `readiness_alert`.
- **Idempotency**: `record_reminder()` inserts into `reminder_deliveries` with a unique key `(match_id, recipient_id, reminder_kind, occurrence=starts_at)`. Only when that insert succeeds does it create the notification (with a unique `dedupe_key`), atomically in one function. Repeated or concurrent scheduler runs are no-ops. Rescheduling a match creates a new occurrence.
- **Isolation**: each match is processed in its own try/catch; a failure is reported in the run summary and the rest continue.
- **Texts** (examples):
  - "Only 8 of 11 players are confirmed for Team A vs Team B on 12 Oct 2026 at 07:00 AM IST. Three more players are required."
  - "Team A vs Dummy Team 001 is scheduled for 12 Oct 2026 at 07:00 AM IST. Replace the placeholder opponent and create or update the match in CricHeroes."
  - Combined: states both actions in one message.
- Every reminder links to `/matches/<id>`.

## Push delivery

1. `claim_push_deliveries(limit, now)` atomically claims due deliveries (`pending`/`failed_temporary` whose `next_attempt_at ≤ now`, or stale `sending` older than 10 min) using `FOR UPDATE SKIP LOCKED`, increments `attempts`.
2. `dispatchPush()` sends with `web-push` (VAPID, TTL 12 h, urgency high) and records the outcome:

| Result                                | Status             | Action                                          |
| ------------------------------------- | ------------------ | ----------------------------------------------- |
| 2xx                                   | `sent`             | update `last_success_at` on the device          |
| 404 / 410                             | `expired`          | delete the subscription                         |
| 408 / 429 / 5xx / network             | `failed_temporary` | retry after 2, 4 … min until `max_attempts` (3) |
| other 4xx, or retries exhausted       | `failed_permanent` | —                                               |
| VAPID not configured / device removed | `skipped`          | —                                               |

Error text is sanitised (status code + error class only); endpoints and keys are never logged or stored in errors.

Deliveries are dispatched immediately after user actions (`after()` in server actions) and on every scheduler tick.

## Lock-screen privacy

Push payloads contain only a title, a short body without private details (player-confirmation pushes are generic: "A player confirmed for a match"), a same-origin relative URL and a tag. No phone numbers, emails or other players' names. The service worker validates the URL is a relative path before opening it.

## Opt-in UX

Permission is requested only after the user presses **Enable mobile notifications** on the Profile page, after an explanation. If permission is denied, the page explains how to re-enable it in browser site settings. Users can register several devices, remove any device, disable push for the current device, and send a test notification. Unsupported browsers and iOS-not-installed cases get a clear message; in-app notifications still work.

## Notification centre

Unread count + badge in navigation, history (latest 100), mark read / unread, mark all read, filter by type and by match, unread-only filter, creation time in IST, deep link (`/notifications/open/<id>` marks it read and redirects), clear empty state.

## Running the scheduler manually

```bash
npm run reminders:run                                     # now
npm run reminders:run -- --now=2026-10-11T06:00:00+05:30  # simulate a moment
```
