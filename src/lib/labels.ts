import type { Database } from "@/lib/supabase/database.types";

type Enums = Database["public"]["Enums"];
export type MatchStatus = Enums["match_status"];
export type MatchCategory = Enums["match_category"];
export type ParticipationStatus = Enums["participation_status"];
export type TournamentStatus = Enums["tournament_status"];
export type EnrollmentStatus = Enums["enrollment_status"];
export type NotificationType = Enums["notification_type"];
export type ProfileStatus = Enums["profile_status"];
export type DeliveryStatus = Enums["delivery_status"];

export const READINESS_THRESHOLD = 11;

export const MATCH_STATUSES: MatchStatus[] = [
  "draft",
  "scheduled",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
];
export const MATCH_STATUS_LABEL: Record<MatchStatus, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const MATCH_CATEGORY_LABEL: Record<MatchCategory, string> = {
  tournament: "Tournament Match",
  practice: "Practice Match",
};

export const PARTICIPATION_STATUSES: ParticipationStatus[] = [
  "not_responded",
  "available",
  "maybe",
  "unavailable",
  "confirmed",
  "playing",
];
/** Statuses a teammate may choose for themselves. */
export const SELF_PARTICIPATION_STATUSES: ParticipationStatus[] = ["available", "maybe", "unavailable", "confirmed"];
export const PARTICIPATION_LABEL: Record<ParticipationStatus, string> = {
  not_responded: "Not Responded",
  available: "Available",
  maybe: "Maybe",
  unavailable: "Unavailable",
  confirmed: "Confirmed",
  playing: "Playing",
};

export const TOURNAMENT_STATUSES: TournamentStatus[] = ["upcoming", "active", "completed"];
export const TOURNAMENT_STATUS_LABEL: Record<TournamentStatus, string> = {
  upcoming: "Upcoming",
  active: "Active",
  completed: "Completed",
};
export const TOURNAMENT_FORMATS = ["T10", "T20", "ODI", "Test", "Box Cricket", "Tennis Ball", "Other"] as const;

export const ENROLLMENT_STATUSES: EnrollmentStatus[] = ["interested", "applied", "enrolled", "withdrawn"];
export const ENROLLMENT_STATUS_LABEL: Record<EnrollmentStatus, string> = {
  interested: "Interested",
  applied: "Applied",
  enrolled: "Enrolled",
  withdrawn: "Withdrawn",
};

export const NOTIFICATION_TYPE_LABEL: Record<NotificationType, string> = {
  insufficient_players: "Insufficient Players",
  dummy_opponent: "Dummy Opponent",
  readiness_alert: "Insufficient Players + Dummy Opponent",
  match_updated: "Match Updated",
  match_cancelled: "Match Cancelled",
  player_confirmed: "Player Confirmed",
  general_announcement: "General Announcement",
  test: "Test",
};

/** Filter options shown in the notification centre, mapped to stored types. */
export const NOTIFICATION_FILTERS: { value: string; label: string; types: NotificationType[] }[] = [
  { value: "insufficient_players", label: "Insufficient Players", types: ["insufficient_players", "readiness_alert"] },
  { value: "dummy_opponent", label: "Dummy Opponent", types: ["dummy_opponent", "readiness_alert"] },
  { value: "match_updated", label: "Match Updated", types: ["match_updated"] },
  { value: "match_cancelled", label: "Match Cancelled", types: ["match_cancelled"] },
  { value: "player_confirmed", label: "Player Confirmed", types: ["player_confirmed"] },
  { value: "general_announcement", label: "General Announcement", types: ["general_announcement"] },
  { value: "test", label: "Test", types: ["test"] },
];

export const SQUAD_ROLE_LABEL: Record<string, string> = {
  captain: "Captain",
  vice_captain: "Vice-captain",
  wicket_keeper: "Wicket-keeper",
  player: "Player",
};
