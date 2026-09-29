import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ActionButton } from "@/components/forms/action-button";
import { MatchCard } from "@/components/matches/match-card";
import { AddMemberForm, TeamForm } from "@/components/teams/team-forms";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireActiveSession } from "@/lib/auth";
import { listMatches, myParticipation } from "@/lib/data/matches";
import { todayIst } from "@/lib/ist";
import { SQUAD_ROLE_LABEL } from "@/lib/labels";
import { removeMembershipAction, setTeamActiveAction } from "@/server/actions/admin";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage({ params }: PageProps<"/teams/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase, userId, isAdmin } = await requireActiveSession();
  const { data: team } = await supabase
    .from("teams")
    .select(
      "id, name, short_name, description, is_active, team_memberships(profile_id, squad_role, is_active, profiles!inner(display_name, status))",
    )
    .eq("id", id)
    .maybeSingle();
  if (!team) notFound();

  const members = team.team_memberships
    .filter((m) => m.is_active && m.profiles.status === "active")
    .sort((a, b) => a.profiles.display_name.localeCompare(b.profiles.display_name));
  const upcoming = await listMatches(supabase, { view: "team", teamIds: [id], fromDate: todayIst(), limit: 6 });
  const statuses = await myParticipation(
    supabase,
    userId,
    upcoming.map((m) => m.id),
  );
  const representing = members.some((m) => m.profile_id === userId);

  let candidates: { id: string; name: string }[] = [];
  if (isAdmin) {
    const { data: people } = await supabase
      .from("profiles")
      .select("id, display_name")
      .eq("status", "active")
      .order("display_name");
    const inSquad = new Set(members.map((m) => m.profile_id));
    candidates = (people ?? []).filter((p) => !inSquad.has(p.id)).map((p) => ({ id: p.id, name: p.display_name }));
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 flex gap-2">
          {representing ? <Badge tone="green">You represent this team</Badge> : null}
          {!team.is_active ? <Badge tone="neutral">Inactive</Badge> : null}
        </div>
        <h1 className="text-2xl font-bold">{team.name}</h1>
        {team.description ? <p className="text-muted">{team.description}</p> : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Registered squad ({members.length})</CardTitle>
        </CardHeader>
        {members.length ? (
          <ul className="divide-line grid gap-x-6 divide-y sm:grid-cols-2 sm:divide-y-0" aria-label="Squad members">
            {members.map((m) => (
              <li key={m.profile_id} className="flex items-center justify-between gap-2 py-2">
                <span>
                  {m.profiles.display_name}
                  {m.squad_role !== "player" ? (
                    <span className="text-muted ml-1 text-xs">({SQUAD_ROLE_LABEL[m.squad_role]})</span>
                  ) : null}
                </span>
                {isAdmin ? (
                  <ActionButton
                    action={removeMembershipAction}
                    fields={{ teamId: team.id, profileId: m.profile_id }}
                    variant="danger"
                    confirm={{
                      title: `Remove ${m.profiles.display_name} from ${team.name}?`,
                      description: "Their past match history is kept.",
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
          <EmptyState title="No players in this squad yet" />
        )}
        {isAdmin ? (
          <div className="border-line mt-4 border-t pt-4">
            <AddMemberForm teamId={team.id} candidates={candidates} />
          </div>
        ) : null}
      </Card>

      <section aria-labelledby="team-matches">
        <h2 id="team-matches" className="mb-3 text-xl font-bold">
          Upcoming matches
        </h2>
        {upcoming.length ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {upcoming.map((m) => (
              <MatchCard key={m.id} match={m} myStatus={statuses.get(m.id) ?? null} representing={representing} />
            ))}
          </div>
        ) : (
          <EmptyState title="No matches for this team yet" />
        )}
      </section>

      {isAdmin ? (
        <Card>
          <CardTitle>Edit team</CardTitle>
          <div className="mt-3 space-y-4">
            <TeamForm
              team={{
                id: team.id,
                name: team.name,
                shortName: team.short_name ?? "",
                description: team.description ?? "",
              }}
            />
            <ActionButton
              action={setTeamActiveAction}
              fields={{ id: team.id, active: team.is_active ? "false" : "true" }}
            >
              {team.is_active ? "Deactivate team" : "Reactivate team"}
            </ActionButton>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
