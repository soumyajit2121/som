import type { Metadata } from "next";
import { MatchForm } from "@/components/matches/match-form";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireActiveSession } from "@/lib/auth";
import { myTeamIds } from "@/lib/data/matches";
import { getMatchFormOptions } from "@/lib/data/options";
import { todayIst } from "@/lib/ist";

export const metadata: Metadata = { title: "Create match" };

export default async function NewMatchPage() {
  const { supabase, userId, isAdmin } = await requireActiveSession();
  const teamIds = isAdmin ? undefined : await myTeamIds(supabase, userId);
  const options = await getMatchFormOptions(supabase, { teamIds });
  if (!options.teams.length) {
    return (
      <EmptyState
        title="You are not in a team yet"
        description="An administrator must add you to a team before you can create matches for it."
      />
    );
  }
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Create match"
        description={
          isAdmin
            ? "Create a Tournament or Practice match."
            : "You will be included as a participant in the match you create."
        }
      />
      <MatchForm
        mode="create"
        options={options}
        isAdmin={isAdmin}
        canEditAll
        initial={{
          title: "",
          category: "practice",
          tournamentId: "",
          matchDate: todayIst(),
          startTime: "07:00",
          reportingTime: "06:30",
          venueId: "",
          ourTeamId: options.teams.length === 1 ? options.teams[0].id : "",
          opponentId: "",
          opponentIsDummy: false,
          notes: "",
          cricheroesUrl: "",
          status: "scheduled",
          resultSummary: "",
        }}
      />
    </div>
  );
}
