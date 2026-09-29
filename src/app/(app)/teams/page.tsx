import type { Metadata } from "next";
import Link from "next/link";
import { TeamForm } from "@/components/teams/team-forms";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireActiveSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Teams" };

export default async function TeamsPage() {
  const { supabase, userId, isAdmin } = await requireActiveSession();
  const { data: teams } = await supabase
    .from("teams")
    .select("id, name, short_name, description, is_active, team_memberships(profile_id, is_active)")
    .order("name");
  return (
    <div className="space-y-5">
      <PageHeader title="Teams" description="Our club's teams. Squads have no size limit." />
      {teams?.length ? (
        <ul className="grid gap-4 md:grid-cols-2">
          {teams
            .filter((t) => t.is_active || isAdmin)
            .map((t) => {
              const members = t.team_memberships.filter((m) => m.is_active);
              const mine = members.some((m) => m.profile_id === userId);
              return (
                <li key={t.id}>
                  <Card className="h-full">
                    <div className="flex flex-wrap gap-2">
                      {mine ? <Badge tone="green">You are in this squad</Badge> : null}
                      {!t.is_active ? <Badge tone="neutral">Inactive</Badge> : null}
                    </div>
                    <h2 className="mt-2 text-lg font-bold">
                      <Link href={`/teams/${t.id}`} className="hover:underline">
                        {t.name}
                      </Link>
                      {t.short_name ? <span className="text-muted ml-2 text-sm">({t.short_name})</span> : null}
                    </h2>
                    {t.description ? <p className="text-muted text-sm">{t.description}</p> : null}
                    <p className="mt-2 text-sm">Registered players: {members.length}</p>
                  </Card>
                </li>
              );
            })}
        </ul>
      ) : (
        <EmptyState title="No teams yet" />
      )}
      {isAdmin ? (
        <Card>
          <CardTitle>Create a team</CardTitle>
          <div className="mt-3">
            <TeamForm />
          </div>
        </Card>
      ) : null}
    </div>
  );
}
