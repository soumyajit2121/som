/**
 * 25-hour pre-match reminder rules (pure functions, no I/O).
 *
 * Condition A: fewer than 11 confirmed players.
 * Condition B: the opponent is a dummy placeholder (explicit is_dummy flag).
 * Both conditions → a single combined notification.
 */
import { DateTime } from "luxon";
import { IST_ZONE, isInReminderWindow } from "@/lib/ist";
import { READINESS_THRESHOLD, type MatchStatus, type NotificationType } from "@/lib/labels";
import { capitalize, numberWord, pluralize } from "@/lib/utils";

export const REMINDER_KIND = "pre_match_25h";
export const REMINDABLE_STATUSES: MatchStatus[] = ["draft", "scheduled", "confirmed"];

export type ReminderCondition = "insufficient_players" | "dummy_opponent";

export interface ReminderMatch {
  id: string;
  title: string;
  ourTeamName: string;
  opponentName: string;
  opponentIsDummy: boolean;
  startsAt: string; // ISO instant
  confirmedCount: number;
  status: MatchStatus;
}

export interface ReminderEvaluation {
  due: boolean;
  conditions: ReminderCondition[];
}

export function evaluateReminder(match: ReminderMatch, now: Date): ReminderEvaluation {
  if (!REMINDABLE_STATUSES.includes(match.status) || !isInReminderWindow(match.startsAt, now)) {
    return { due: false, conditions: [] };
  }
  const conditions: ReminderCondition[] = [];
  if (match.confirmedCount < READINESS_THRESHOLD) conditions.push("insufficient_players");
  if (match.opponentIsDummy) conditions.push("dummy_opponent");
  return { due: conditions.length > 0, conditions };
}

export interface ReminderMessage {
  type: NotificationType;
  title: string;
  body: string;
  linkPath: string;
}

function whenText(startsAt: string): string {
  const dt = DateTime.fromISO(startsAt, { setZone: true }).setZone(IST_ZONE).setLocale("en-US");
  return `${dt.toFormat("dd LLL yyyy")} at ${dt.toFormat("hh:mm a")} IST`;
}

export function buildReminderMessage(match: ReminderMatch, conditions: ReminderCondition[]): ReminderMessage {
  const fixture = `${match.ourTeamName} vs ${match.opponentName}`;
  const when = whenText(match.startsAt);
  const needed = Math.max(0, READINESS_THRESHOLD - match.confirmedCount);
  const neededText = `${numberWord(needed)} more ${pluralize(needed, "player")} ${needed === 1 ? "is" : "are"} required`;
  const linkPath = `/matches/${match.id}`;
  const insufficient = conditions.includes("insufficient_players");
  const dummy = conditions.includes("dummy_opponent");

  if (insufficient && dummy) {
    return {
      type: "readiness_alert",
      title: "Match needs attention: players and opponent",
      body:
        `${fixture} on ${when} needs two actions. ` +
        `Only ${match.confirmedCount} of ${READINESS_THRESHOLD} players are confirmed; ${neededText}. ` +
        `The opponent is still a placeholder: replace the placeholder opponent and create or update the match in CricHeroes.`,
      linkPath,
    };
  }
  if (insufficient) {
    return {
      type: "insufficient_players",
      title: "Not enough confirmed players",
      body:
        `Only ${match.confirmedCount} of ${READINESS_THRESHOLD} players are confirmed for ${fixture} on ${when}. ` +
        `${capitalize(neededText)}.`,
      linkPath,
    };
  }
  return {
    type: "dummy_opponent",
    title: "Placeholder opponent",
    body:
      `${fixture} is scheduled for ${when}. ` +
      `Replace the placeholder opponent and create or update the match in CricHeroes.`,
    linkPath,
  };
}
