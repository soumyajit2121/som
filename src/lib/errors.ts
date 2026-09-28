/** Maps database/RLS errors to safe, user-facing messages. */
export interface DbErrorLike {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
}

const MESSAGES: Record<string, string> = {
  DUPLICATE_MATCH: "A match with the same team, opponent, date, start time and tournament already exists.",
  TEAM_NOT_ENROLLED: "The selected team is not enrolled in that tournament.",
  CREATOR_MUST_PARTICIPATE:
    "The creator of a match must stay in it. Ask an administrator to take ownership or cancel the match.",
  MATCH_LOCKED: "This match can no longer be changed.",
  LAST_ADMIN: "At least one active administrator is required.",
  ADMIN_MUST_BE_ACTIVE: "Only approved (active) users can be administrators.",
  FORBIDDEN_FIELD: "You are not allowed to change one or more of these fields.",
  FORBIDDEN: "You are not allowed to perform this action.",
  IMMUTABLE_FIELD: "This field cannot be changed.",
  INVALID_INPUT: "Some of the information entered is not valid.",
};

export function dbErrorCode(error: DbErrorLike | null | undefined): string | null {
  if (!error) return null;
  const msg = error.message ?? "";
  if (MESSAGES[msg]) return msg;
  if (error.code === "42501" || /row-level security/i.test(msg)) return "FORBIDDEN";
  if (error.code === "23505") return "UNIQUE_VIOLATION";
  if (error.code === "23503") return "FOREIGN_KEY_VIOLATION";
  if (error.code === "23514") return "CHECK_VIOLATION";
  return "UNKNOWN";
}

export function friendlyDbError(
  error: DbErrorLike | null | undefined,
  fallback = "Something went wrong. Please try again.",
): string {
  const code = dbErrorCode(error);
  if (!code) return fallback;
  if (MESSAGES[code]) return MESSAGES[code];
  if (code === "UNIQUE_VIOLATION") return "A record with the same name or key already exists.";
  if (code === "FOREIGN_KEY_VIOLATION")
    return "This record is still referenced by other records (for example, matches). Archive it instead.";
  if (code === "CHECK_VIOLATION") return "Some of the information entered is not valid.";
  return fallback;
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
