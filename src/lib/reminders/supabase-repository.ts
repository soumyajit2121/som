import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { REMINDABLE_STATUSES, type ReminderMatch } from "./engine";
import type { RecordReminderInput, ReminderRepository } from "./process";

/** Reminder repository backed by Supabase. Requires a service-role client. */
export class SupabaseReminderRepository implements ReminderRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async listCandidateMatches(now: Date, until: Date): Promise<ReminderMatch[]> {
    const { data, error } = await this.db
      .from("match_overview")
      .select("id, title, our_team_name, opponent_name, opponent_is_dummy, starts_at, confirmed_count, status")
      .gt("starts_at", now.toISOString())
      .lte("starts_at", until.toISOString())
      .in("status", REMINDABLE_STATUSES)
      .order("starts_at");
    if (error) throw new Error(`Failed to load matches: ${error.message}`);
    return (data ?? []).map((m) => ({
      id: m.id!,
      title: m.title!,
      ourTeamName: m.our_team_name!,
      opponentName: m.opponent_name!,
      opponentIsDummy: Boolean(m.opponent_is_dummy),
      startsAt: m.starts_at!,
      confirmedCount: m.confirmed_count ?? 0,
      status: m.status!,
    }));
  }

  async listAdminRecipientIds(): Promise<string[]> {
    const { data, error } = await this.db.from("profiles").select("id").eq("role", "admin").eq("status", "active");
    if (error) throw new Error(`Failed to load administrators: ${error.message}`);
    return (data ?? []).map((p) => p.id);
  }

  async recordReminder(input: RecordReminderInput): Promise<string | null> {
    const { data, error } = await this.db.rpc("record_reminder", {
      p_match_id: input.matchId,
      p_recipient_id: input.recipientId,
      p_reminder_kind: input.reminderKind,
      p_occurrence: input.occurrence,
      p_conditions: input.conditions,
      p_type: input.type,
      p_title: input.title,
      p_body: input.body,
      p_link_path: input.linkPath,
    });
    if (error) throw new Error(`Failed to record reminder: ${error.message}`);
    return (data as string | null) ?? null;
  }
}
