/**
 * Reminder orchestration. It is idempotent: the repository's recordReminder()
 * inserts into a ledger with a unique key (match, recipient, kind, occurrence)
 * and returns null when the reminder was already recorded.
 */
import { REMINDER_LEAD } from "@/lib/ist";
import {
  REMINDER_KIND,
  buildReminderMessage,
  evaluateReminder,
  type ReminderCondition,
  type ReminderMatch,
} from "./engine";
import type { NotificationType } from "@/lib/labels";

export interface RecordReminderInput {
  matchId: string;
  recipientId: string;
  reminderKind: string;
  occurrence: string;
  conditions: ReminderCondition[];
  type: NotificationType;
  title: string;
  body: string;
  linkPath: string;
}

export interface ReminderRepository {
  /** Matches starting in (now, now + 25h] that are not cancelled or completed. */
  listCandidateMatches(now: Date, until: Date): Promise<ReminderMatch[]>;
  /** Active administrators: operational warnings go to every administrator. */
  listAdminRecipientIds(): Promise<string[]>;
  /** Returns the notification id, or null when the reminder already exists. */
  recordReminder(input: RecordReminderInput): Promise<string | null>;
}

export interface ReminderRunSummary {
  evaluatedMatches: number;
  dueMatches: number;
  notificationsCreated: number;
  duplicatesSkipped: number;
  errors: { matchId: string; message: string }[];
}

export async function processReminders(repo: ReminderRepository, now: Date): Promise<ReminderRunSummary> {
  const summary: ReminderRunSummary = {
    evaluatedMatches: 0,
    dueMatches: 0,
    notificationsCreated: 0,
    duplicatesSkipped: 0,
    errors: [],
  };
  const until = new Date(now.getTime() + REMINDER_LEAD.as("milliseconds"));
  const matches = await repo.listCandidateMatches(now, until);
  const admins = await repo.listAdminRecipientIds();

  for (const match of matches) {
    summary.evaluatedMatches++;
    try {
      const evaluation = evaluateReminder(match, now);
      if (!evaluation.due) continue;
      summary.dueMatches++;
      const message = buildReminderMessage(match, evaluation.conditions);
      for (const recipientId of admins) {
        const id = await repo.recordReminder({
          matchId: match.id,
          recipientId,
          reminderKind: REMINDER_KIND,
          occurrence: match.startsAt,
          conditions: evaluation.conditions,
          ...message,
        });
        if (id) summary.notificationsCreated++;
        else summary.duplicatesSkipped++;
      }
    } catch (error) {
      // One failing match must not stop the rest of the run.
      summary.errors.push({
        matchId: match.id,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
  return summary;
}
