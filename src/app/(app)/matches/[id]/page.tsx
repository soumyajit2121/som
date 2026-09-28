import { Clock, ExternalLink, MapPin, Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ActionButton } from "@/components/forms/action-button";
import {
  CategoryBadge,
  DummyOpponentWarning,
  ParticipationBadge,
  ReadinessBadge,
  StatusBadge,
} from "@/components/matches/badges";
import {
  AddPlayersForm,
  AdminStatusSelect,
  CancelMatchForm,
  MyResponse,
  ReplaceOpponentForm,
} from "@/components/matches/participation-controls";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireActiveSession } from "@/lib/auth";
import { getMatch, listParticipants, myTeamIds } from "@/lib/data/matches";
import { formatIst, formatIstDateLong, formatIstTime } from "@/lib/ist";
import { PARTICIPATION_LABEL } from "@/lib/labels";
import {
  deleteMatchAction,
  inviteSquadAction,
  removeParticipantAction,
  restoreMatchAction,
  takeOwnershipAction,
} from "@/server/actions/matches";

export const metadata: Metadata = { title: "Match details" };

export default async function MatchPage({ params, searchParams }: PageProps<"/matches/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase, userId, isAdmin } = await requireActiveSession();
  const match = await getMatch(supabase, id);
  if (!match) notFound();

  const [participants, teamIds] = await Promise.all([listParticipants(supabase, id), myTeamIds(supabase, userId)]);
  const mine = participants.find((p) => p.profileId === userId) ?? null;
  const isCreator = match.createdBy === userId;
  const representing = teamIds.includes(match.ourTeamId);
  const locked = match.status === "completed" || match.status === "cancelled";
  const canRespond = !locked && (representing || Boolean(mine));
  const othersJoined = participants.some((p) => p.profileId !== userId);

  let squadCandidates: { id: string; displayName: string; inSquad: boolean }[] = [];
  let realOpponents: { id: string; name: string }[] = [];
  if (isAdmin) {
    const [{ data: squad }, { data: opponents }] = await Promise.all([
      supabase
        .from("team_memberships")
        .select("profile_id, profiles!inner(display_name, status)")
        .eq("team_id", match.ourTeamId)
        .eq("is_active", true)
        .eq("profiles.status", "active"),
      supabase.from("opponents").select("id, name").eq("is_dummy", false).eq("is_active", true).order("name"),
    ]);
    const already = new Set(participants.map((p) => p.profileId));
    squadCandidates = (squad ?? [])
      .filter((s) => !already.has(s.profile_id))
      .map((s) => ({ id: s.profile_id, displayName: s.profiles.display_name, inSquad: true }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
    realOpponents = opponents ?? [];
  }

  const counts = [
    ["Registered squad", match.counts.squad],
    ["Invited", match.counts.invited],
    ["Not responded", match.counts.notResponded],
    ["Available", match.counts.available],
    ["Maybe", match.counts.maybe],
    ["Unavailable", match.counts.unavailable],
    ["Confirmed", match.counts.confirmed],
    ["Playing", match.counts.playing],
    ["Still needed for 11", match.counts.needed],
  ] as const;

  return (
    <div className="space-y-5">
      {sp.created ? <Alert tone="success">Match created.</Alert> : null}
      {sp.saved ? <Alert tone="success">Match saved.</Alert> : null}

      <div className="flex flex-wrap items-center gap-2">
        <CategoryBadge category={match.category} />
        <StatusBadge status={match.status} />
        <ReadinessBadge confirmed={match.counts.confirmed} />
      </div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{match.title}</h1>
          <p className="text-muted">
            {match.category === "tournament" && match.tournamentName ? (
              <>
                Tournament:{" "}
                <Link href={`/tournaments/${match.tournamentId}`} className="text-brand-700 underline">
                  {match.tournamentName}
                </Link>
              </>
            ) : (
              "Practice Match (no tournament)"
            )}
          </p>
        </div>
        {isAdmin || (isCreator && !locked && match.status !== "in_progress") ? (
          <Button asChild variant="secondary">
            <Link href={`/matches/${match.id}/edit`}>
              <Pencil className="h-4 w-4" aria-hidden="true" />
              Edit match
            </Link>
          </Button>
        ) : null}
      </div>

      {match.status === "cancelled" ? (
        <Alert tone="error" title="This match has been cancelled">
          {match.cancelledAt ? `Cancelled on ${formatIst(match.cancelledAt)}.` : null}
          {match.cancellationReason ? ` Reason: ${match.cancellationReason}` : null}
        </Alert>
      ) : null}
      {match.opponentIsDummy ? <DummyOpponentWarning /> : null}

      <Card>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-muted text-sm font-semibold">Our team</dt>
            <dd className="text-lg font-bold">{match.ourTeamName}</dd>
            <dd className="text-sm">
              {representing ? "You represent this team." : "You are not in this team's squad."}
            </dd>
          </div>
          <div>
            <dt className="text-muted text-sm font-semibold">Opponent</dt>
            <dd className="text-lg font-bold">
              {match.opponentName}
              {match.opponentIsDummy ? (
                <span className="ml-2 text-sm font-semibold text-amber-900">(placeholder)</span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="text-muted flex items-center gap-1 text-sm font-semibold">
              <Clock className="h-4 w-4" aria-hidden="true" /> Date and start time
            </dt>
            <dd>
              <time dateTime={match.startsAt}>
                {formatIstDateLong(match.matchDate)}, {formatIstTime(match.startTime)}
              </time>
            </dd>
          </div>
          <div>
            <dt className="text-muted text-sm font-semibold">Reporting time</dt>
            <dd>{match.reportingTime ? formatIstTime(match.reportingTime) : "Not set"}</dd>
          </div>
          <div>
            <dt className="text-muted flex items-center gap-1 text-sm font-semibold">
              <MapPin className="h-4 w-4" aria-hidden="true" /> Venue
            </dt>
            <dd>
              {match.venueName ?? "To be confirmed"}
              {match.venueCity ? `, ${match.venueCity}` : ""}
              {match.venueMapsUrl ? (
                <a
                  href={match.venueMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-700 ml-2 underline"
                >
                  Map
                </a>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="text-muted flex items-center gap-1 text-sm font-semibold">
              <ExternalLink className="h-4 w-4" aria-hidden="true" /> CricHeroes
            </dt>
            <dd>
              {match.cricheroesUrl ? (
                <a
                  href={match.cricheroesUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-700 underline"
                >
                  Open CricHeroes match
                </a>
              ) : (
                <span>
                  Not linked yet{match.opponentIsDummy ? " — update CricHeroes once the opponent is known." : "."}
                </span>
              )}
            </dd>
          </div>
          {match.resultSummary ? (
            <div className="sm:col-span-2">
              <dt className="text-muted text-sm font-semibold">Result</dt>
              <dd>{match.resultSummary}</dd>
            </div>
          ) : null}
          {match.notes ? (
            <div className="sm:col-span-2">
              <dt className="text-muted text-sm font-semibold">Notes</dt>
              <dd className="whitespace-pre-line">{match.notes}</dd>
            </div>
          ) : null}
          <div className="text-muted text-xs sm:col-span-2">
            Created by {match.createdByName ?? "an administrator"}. All times IST.
          </div>
        </dl>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your availability</CardTitle>
          <ParticipationBadge status={mine?.status ?? null} prefix="Current: " />
        </CardHeader>
        {canRespond ? (
          <MyResponse matchId={match.id} profileId={userId} current={mine?.status ?? null} />
        ) : (
          <p className="text-muted text-sm">
            {locked ? "Responses are closed for this match." : "Only members of this team's squad can respond."}
          </p>
        )}
        {mine && isCreator && !isAdmin ? (
          <p className="text-muted mt-3 text-sm">
            You created this match, so you stay in it. To withdraw, ask an administrator to take ownership or cancel it.
          </p>
        ) : null}
      </Card>

      <Card>
        <CardTitle>Player counts</CardTitle>
        <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5" data-testid="player-counts">
          {counts.map(([label, value]) => (
            <div key={label} className="border-line rounded-lg border p-2">
              <dt className="text-muted text-xs">{label}</dt>
              <dd className="text-xl font-bold">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Players ({participants.length})</CardTitle>
          {isAdmin && !locked ? (
            <ActionButton action={inviteSquadAction} fields={{ matchId: match.id }}>
              Invite whole squad
            </ActionButton>
          ) : null}
        </CardHeader>
        {participants.length ? (
          <ul className="divide-line divide-y" aria-label="Participating players">
            {participants.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div>
                  <span className="font-semibold">{p.displayName}</span>
                  {p.profileId === match.createdBy ? (
                    <span className="text-muted ml-1 text-xs">(match creator)</span>
                  ) : null}
                  <span className="ml-2">
                    <ParticipationBadge status={p.status} />
                  </span>
                  {p.note ? <p className="text-muted text-sm">{p.note}</p> : null}
                </div>
                {isAdmin ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <AdminStatusSelect
                      matchId={match.id}
                      profileId={p.profileId}
                      displayName={p.displayName}
                      current={p.status}
                    />
                    <ActionButton
                      action={removeParticipantAction}
                      fields={{ matchId: match.id, profileId: p.profileId }}
                      variant="danger"
                      confirm={{
                        title: `Remove ${p.displayName}?`,
                        description: "The player will be removed from this match. They can be added again later.",
                        confirmLabel: "Remove player",
                      }}
                    >
                      Remove
                    </ActionButton>
                  </div>
                ) : (
                  <span className="sr-only">Status: {PARTICIPATION_LABEL[p.status]}</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No players yet" description="Players appear here once they respond or are invited." />
        )}
        {isAdmin && !locked ? (
          <div className="border-line mt-4 border-t pt-4">
            <AddPlayersForm matchId={match.id} candidates={squadCandidates} />
          </div>
        ) : null}
      </Card>

      {isAdmin ? (
        <Card>
          <CardTitle>Administration</CardTitle>
          <div className="mt-3 space-y-5">
            {match.opponentIsDummy && !locked ? (
              <ReplaceOpponentForm matchId={match.id} opponents={realOpponents} />
            ) : null}
            {match.createdBy !== userId ? (
              <ActionButton action={takeOwnershipAction} fields={{ matchId: match.id }}>
                Take ownership of this match
              </ActionButton>
            ) : null}
            {match.status === "cancelled" ? (
              <ActionButton action={restoreMatchAction} fields={{ matchId: match.id }}>
                Restore match
              </ActionButton>
            ) : (
              <CancelMatchForm matchId={match.id} />
            )}
            <ActionButton
              action={deleteMatchAction}
              fields={{ matchId: match.id }}
              variant="danger"
              confirm={{
                title: "Delete this match permanently?",
                description:
                  "This removes the match and all responses. Cancelling keeps the history and is usually better.",
                confirmLabel: "Delete match",
              }}
            >
              Delete match
            </ActionButton>
          </div>
        </Card>
      ) : isCreator && !othersJoined && !locked ? (
        <Card>
          <CardTitle>Delete this match</CardTitle>
          <p className="text-muted mt-1 text-sm">You can delete a match you created until other players join it.</p>
          <div className="mt-3">
            <ActionButton
              action={deleteMatchAction}
              fields={{ matchId: match.id }}
              variant="danger"
              confirm={{
                title: "Delete this match?",
                description: "This cannot be undone.",
                confirmLabel: "Delete match",
              }}
            >
              Delete match
            </ActionButton>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
