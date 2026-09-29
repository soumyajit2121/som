import type { MatchSummary, ParticipantRow } from "@/lib/data/matches";
import { IST_OFFSET, IST_ZONE } from "@/lib/ist";

/**
 * Public JSON shape for a match. Every instant carries an explicit +05:30
 * offset and the IANA zone, so clients never have to guess the timezone.
 */
export function serializeMatch(m: MatchSummary) {
  return {
    id: m.id,
    title: m.title,
    category: m.category,
    tournament: m.tournamentId ? { id: m.tournamentId, name: m.tournamentName } : null,
    timezone: IST_ZONE,
    utcOffset: IST_OFFSET,
    matchDate: m.matchDate,
    startTime: m.startTime,
    reportingTime: m.reportingTime,
    startsAt: m.startsAt,
    reportingAt: m.reportingAt,
    venue: m.venueId ? { id: m.venueId, name: m.venueName, city: m.venueCity } : null,
    ourTeam: { id: m.ourTeamId, name: m.ourTeamName },
    opponent: { id: m.opponentId, name: m.opponentName, isDummy: m.opponentIsDummy },
    status: m.status,
    cricheroesUrl: m.cricheroesUrl,
    resultSummary: m.resultSummary,
    counts: m.counts,
    ready: m.counts.confirmed >= 11,
  };
}

/** Participants expose only non-sensitive fields: no email, phone or device data. */
export function serializeParticipant(p: ParticipantRow) {
  return { profileId: p.profileId, displayName: p.displayName, status: p.status, respondedAt: p.respondedAt };
}
