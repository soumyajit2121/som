import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { MatchForm } from "@/components/matches/match-form";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { requireActiveSession } from "@/lib/auth";
import { getMatch } from "@/lib/data/matches";
import { getMatchFormOptions } from "@/lib/data/options";

export const metadata: Metadata = { title: "Edit match" };

export default async function EditMatchPage({ params }: PageProps<"/matches/[id]/edit">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase, userId, isAdmin } = await requireActiveSession();
  const match = await getMatch(supabase, id);
  if (!match) notFound();
  const isCreator = match.createdBy === userId;
  if (!isAdmin && !isCreator) {
    return <Alert tone="error">Only administrators and the match creator can edit this match.</Alert>;
  }
  if (!isAdmin && ["in_progress", "completed", "cancelled"].includes(match.status)) {
    return <Alert tone="info">This match can no longer be edited.</Alert>;
  }
  const options = await getMatchFormOptions(supabase, { includeTournamentId: match.tournamentId });
  if (!options.opponents.some((o) => o.id === match.opponentId)) {
    options.opponents.push({ id: match.opponentId, name: match.opponentName, isDummy: match.opponentIsDummy });
  }
  if (!options.teams.some((t) => t.id === match.ourTeamId)) {
    options.teams.push({ id: match.ourTeamId, name: match.ourTeamName });
  }
  if (match.tournamentId && !options.tournaments.some((t) => t.id === match.tournamentId)) {
    options.tournaments.push({
      id: match.tournamentId,
      name: match.tournamentName ?? "Tournament",
      startDate: match.matchDate,
      endDate: match.matchDate,
      status: "active",
      enrolledTeamIds: [match.ourTeamId],
    });
  }
  return (
    <div className="max-w-3xl">
      <PageHeader title="Edit match" description={match.title} />
      <MatchForm
        mode="edit"
        matchId={match.id}
        options={options}
        isAdmin={isAdmin}
        canEditAll={isAdmin}
        initial={{
          title: match.title,
          category: match.category,
          tournamentId: match.tournamentId ?? "",
          matchDate: match.matchDate,
          startTime: match.startTime,
          reportingTime: match.reportingTime ?? "",
          venueId: match.venueId ?? "",
          ourTeamId: match.ourTeamId,
          opponentId: match.opponentId,
          opponentIsDummy: match.opponentIsDummy,
          notes: match.notes ?? "",
          cricheroesUrl: match.cricheroesUrl ?? "",
          status: match.status,
          resultSummary: match.resultSummary ?? "",
        }}
      />
    </div>
  );
}
