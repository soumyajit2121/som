import { Clock, ExternalLink, MapPin, Shield, Swords, Users } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import type { MatchSummary } from "@/lib/data/matches";
import { formatIstDateTime, formatIstTime } from "@/lib/ist";
import type { ParticipationStatus } from "@/lib/labels";
import { CategoryBadge, DummyOpponentWarning, ParticipationBadge, ReadinessBadge, StatusBadge } from "./badges";

export function MatchCard({
  match,
  myStatus,
  representing,
  headingLevel = 3,
}: {
  match: MatchSummary;
  myStatus: ParticipationStatus | null;
  representing: boolean;
  headingLevel?: 2 | 3;
}) {
  const H = headingLevel === 2 ? "h2" : "h3";
  return (
    <Card className="flex flex-col gap-3" data-testid="match-card">
      <div className="flex flex-wrap items-center gap-2">
        <CategoryBadge category={match.category} />
        <StatusBadge status={match.status} />
        {match.opponentIsDummy ? <DummyOpponentWarning compact /> : null}
      </div>
      <div>
        <H className="text-lg leading-snug font-bold">
          <Link href={`/matches/${match.id}`} className="hover:underline">
            {match.title}
          </Link>
        </H>
        {match.tournamentName ? <p className="text-muted text-sm">Tournament: {match.tournamentName}</p> : null}
      </div>
      <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
        <div className="flex items-start gap-2">
          <Shield className="text-brand-700 mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <dt className="sr-only">Our team</dt>
          <dd>
            <span className="font-semibold">{match.ourTeamName}</span>
            {representing ? <span className="text-muted"> (you represent this team)</span> : null}
          </dd>
        </div>
        <div className="flex items-start gap-2">
          <Swords className="text-brand-700 mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <dt className="sr-only">Opponent</dt>
          <dd>
            vs <span className="font-semibold">{match.opponentName}</span>
            {match.opponentIsDummy ? <span className="text-amber-900"> (placeholder)</span> : null}
          </dd>
        </div>
        <div className="flex items-start gap-2">
          <Clock className="text-brand-700 mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <dt className="sr-only">Start</dt>
          <dd>
            <time dateTime={match.startsAt}>{formatIstDateTime(match.matchDate, match.startTime)}</time>
            {match.reportingTime ? (
              <span className="text-muted block">Reporting: {formatIstTime(match.reportingTime)}</span>
            ) : null}
          </dd>
        </div>
        <div className="flex items-start gap-2">
          <MapPin className="text-brand-700 mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <dt className="sr-only">Venue</dt>
          <dd>
            {match.venueName
              ? `${match.venueName}${match.venueCity ? `, ${match.venueCity}` : ""}`
              : "Venue to be confirmed"}
          </dd>
        </div>
        <div className="flex items-start gap-2">
          <Users className="text-brand-700 mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <dt className="sr-only">Confirmed players</dt>
          <dd>
            {match.counts.confirmed} of 11 confirmed
            {match.counts.needed > 0 ? `, ${match.counts.needed} more needed` : ""}
          </dd>
        </div>
        <div className="flex items-start gap-2">
          <ExternalLink className="text-brand-700 mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <dt className="sr-only">CricHeroes</dt>
          <dd>
            {match.cricheroesUrl ? (
              <a
                href={match.cricheroesUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-700 underline"
              >
                CricHeroes match link
              </a>
            ) : (
              <span className="text-muted">CricHeroes: not linked yet</span>
            )}
          </dd>
        </div>
      </dl>
      <div className="border-line flex flex-wrap items-center gap-2 border-t pt-3">
        <ReadinessBadge confirmed={match.counts.confirmed} />
        <ParticipationBadge status={myStatus} prefix="Your response: " />
      </div>
    </Card>
  );
}
