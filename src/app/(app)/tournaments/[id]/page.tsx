import { Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ActionButton } from "@/components/forms/action-button";
import { MatchCard } from "@/components/matches/match-card";
import { EnrollmentForm } from "@/components/tournaments/enrollment-form";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireActiveSession } from "@/lib/auth";
import { listMatches, myParticipation, myTeamIds } from "@/lib/data/matches";
import { formatIst, formatIstDate } from "@/lib/ist";
import { ENROLLMENT_STATUS_LABEL, TOURNAMENT_STATUS_LABEL } from "@/lib/labels";
import {
  deleteTournamentAction,
  removeEnrollmentAction,
  setTournamentArchivedAction,
} from "@/server/actions/tournaments";

export const metadata: Metadata = { title: "Tournament" };

export default async function TournamentPage({ params, searchParams }: PageProps<"/tournaments/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase, userId, isAdmin } = await requireActiveSession();
  const { data: t } = await supabase
    .from("tournaments")
    .select("*, venues(name, city), tournament_enrollments(team_id, status, teams(name))")
    .eq("id", id)
    .maybeSingle();
  if (!t) notFound();

  const [matches, teamIds, teams] = await Promise.all([
    listMatches(supabase, { view: "all", tournamentId: id, sort: "date_asc" }),
    myTeamIds(supabase, userId),
    isAdmin
      ? supabase.from("teams").select("id, name").eq("is_active", true).order("name")
      : Promise.resolve({ data: [] }),
  ]);
  const statuses = await myParticipation(
    supabase,
    userId,
    matches.map((m) => m.id),
  );

  return (
    <div className="space-y-5">
      {sp.saved ? <Alert tone="success">Tournament saved.</Alert> : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-2 flex flex-wrap gap-2">
            <Badge tone="purple">{t.format}</Badge>
            <Badge tone={t.status === "active" ? "green" : "neutral"}>
              Status: {TOURNAMENT_STATUS_LABEL[t.status]}
            </Badge>
            {t.archived_at ? <Badge tone="neutral">Archived</Badge> : null}
          </div>
          <h1 className="text-2xl font-bold">{t.name}</h1>
          <p className="text-muted">
            {formatIstDate(t.start_date)} – {formatIstDate(t.end_date)} (IST)
          </p>
        </div>
        {isAdmin ? (
          <Button asChild variant="secondary">
            <Link href={`/tournaments/${t.id}/edit`}>
              <Pencil className="h-4 w-4" aria-hidden="true" />
              Edit tournament
            </Link>
          </Button>
        ) : null}
      </div>
      {t.archived_at ? (
        <Alert tone="info">
          This tournament was archived on {formatIst(t.archived_at)}. It no longer appears when creating matches.
        </Alert>
      ) : null}

      <Card>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-muted text-sm font-semibold">Organiser</dt>
            <dd>{t.organizer ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted text-sm font-semibold">Venue / location</dt>
            <dd>{[t.venues?.name, t.location].filter(Boolean).join(" · ") || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted text-sm font-semibold">Website</dt>
            <dd>
              {t.website_url ? (
                <a href={t.website_url} target="_blank" rel="noopener noreferrer" className="text-brand-700 underline">
                  {t.website_url}
                </a>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-muted text-sm font-semibold">Last updated</dt>
            <dd>{formatIst(t.updated_at)}</dd>
          </div>
          {t.notes ? (
            <div className="sm:col-span-2">
              <dt className="text-muted text-sm font-semibold">Notes</dt>
              <dd className="whitespace-pre-line">{t.notes}</dd>
            </div>
          ) : null}
        </dl>
      </Card>

      <Card>
        <CardTitle>Enrolled teams</CardTitle>
        {t.tournament_enrollments.length ? (
          <ul className="divide-line mt-3 divide-y">
            {t.tournament_enrollments.map((e) => (
              <li key={e.team_id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <span className="font-semibold">{e.teams?.name}</span>{" "}
                  <Badge tone={e.status === "enrolled" ? "green" : "neutral"}>
                    {ENROLLMENT_STATUS_LABEL[e.status]}
                  </Badge>
                </span>
                {isAdmin ? (
                  <ActionButton
                    action={removeEnrollmentAction}
                    fields={{ tournamentId: t.id, teamId: e.team_id }}
                    variant="danger"
                    confirm={{
                      title: "Remove enrolment?",
                      description: "Existing matches stay unchanged.",
                      confirmLabel: "Remove",
                    }}
                  >
                    Remove
                  </ActionButton>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted mt-2 text-sm">No teams enrolled yet.</p>
        )}
        {isAdmin ? (
          <div className="border-line mt-4 border-t pt-4">
            <EnrollmentForm tournamentId={t.id} teams={teams.data ?? []} />
          </div>
        ) : null}
      </Card>

      <section aria-labelledby="t-matches">
        <CardHeader>
          <h2 id="t-matches" className="text-xl font-bold">
            Matches in this tournament ({matches.length})
          </h2>
          {!t.archived_at ? (
            <Button asChild size="sm">
              <Link href="/matches/new">New match</Link>
            </Button>
          ) : null}
        </CardHeader>
        {matches.length ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {matches.map((m) => (
              <MatchCard
                key={m.id}
                match={m}
                myStatus={statuses.get(m.id) ?? null}
                representing={teamIds.includes(m.ourTeamId)}
              />
            ))}
          </div>
        ) : (
          <EmptyState title="No matches yet" />
        )}
      </section>

      {isAdmin ? (
        <Card>
          <CardTitle>Administration</CardTitle>
          <div className="mt-3 flex flex-wrap gap-3">
            <ActionButton
              action={setTournamentArchivedAction}
              fields={{ id: t.id, archived: t.archived_at ? "false" : "true" }}
              confirm={
                t.archived_at
                  ? undefined
                  : {
                      title: "Archive this tournament?",
                      description:
                        "It stays in the history with its matches but is hidden from current lists and match creation.",
                      confirmLabel: "Archive",
                    }
              }
            >
              {t.archived_at ? "Restore from archive" : "Archive tournament"}
            </ActionButton>
            <ActionButton
              action={deleteTournamentAction}
              fields={{ id: t.id }}
              variant="danger"
              confirm={{
                title: "Delete this tournament permanently?",
                description:
                  "Only tournaments without matches can be deleted. Tournaments with matches must be archived.",
                confirmLabel: "Delete",
              }}
            >
              Delete tournament
            </ActionButton>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
