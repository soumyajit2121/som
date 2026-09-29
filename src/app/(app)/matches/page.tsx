import { CalendarPlus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { TabsNav } from "@/components/common/tabs-nav";
import { MatchCard } from "@/components/matches/match-card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Label, Select } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
import { requireActiveSession } from "@/lib/auth";
import { MATCH_VIEWS, listMatches, myParticipation, myTeamIds, type MatchView } from "@/lib/data/matches";
import { MATCH_STATUSES, MATCH_STATUS_LABEL, type MatchStatus } from "@/lib/labels";

export const metadata: Metadata = { title: "Matches" };

const VIEW_LABEL: Record<MatchView, string> = {
  upcoming: "Upcoming",
  past: "Past",
  tournament: "Tournament Matches",
  practice: "Practice Matches",
  mine: "My Matches",
  team: "Team Matches",
  all: "All",
};

export default async function MatchesPage({ searchParams }: PageProps<"/matches">) {
  const sp = await searchParams;
  const view: MatchView = MATCH_VIEWS.includes(sp.view as MatchView) ? (sp.view as MatchView) : "upcoming";
  const search = typeof sp.q === "string" ? sp.q : "";
  const sort =
    sp.sort === "date_desc" || sp.sort === "title" ? sp.sort : sp.sort === "date_asc" ? "date_asc" : undefined;
  const status = MATCH_STATUSES.includes(sp.status as MatchStatus) ? (sp.status as MatchStatus) : undefined;

  const { supabase, userId } = await requireActiveSession();
  const teamIds = await myTeamIds(supabase, userId);
  const matches = await listMatches(supabase, { view, search, sort, status, profileId: userId, teamIds });
  const statuses = await myParticipation(
    supabase,
    userId,
    matches.map((m) => m.id),
  );

  const tabs = MATCH_VIEWS.filter((v) => v !== "all").map((v) => ({
    value: v,
    label: VIEW_LABEL[v],
    href: `/matches?view=${v}`,
  }));

  return (
    <div>
      <PageHeader
        title="Matches"
        description="All dates and times are in IST."
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/calendar">Calendar view</Link>
            </Button>
            <Button asChild>
              <Link href="/matches/new">
                <CalendarPlus className="h-4 w-4" aria-hidden="true" />
                New match
              </Link>
            </Button>
          </>
        }
      />
      {sp.deleted ? (
        <Alert tone="success" className="mb-4">
          Match deleted.
        </Alert>
      ) : null}
      <TabsNav tabs={tabs} current={view} label="Match views" />

      <form
        className="border-line mb-4 grid gap-3 rounded-xl border bg-white p-3 sm:grid-cols-[1fr_auto_auto_auto]"
        role="search"
      >
        <input type="hidden" name="view" value={view} />
        <div>
          <Label htmlFor="q">Search</Label>
          <Input id="q" name="q" defaultValue={search} placeholder="Title, opponent, tournament or venue" />
        </div>
        <div>
          <Label htmlFor="status">Status</Label>
          <Select id="status" name="status" defaultValue={status ?? ""}>
            <option value="">Any status</option>
            {MATCH_STATUSES.map((s) => (
              <option key={s} value={s}>
                {MATCH_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="sort">Sort</Label>
          <Select id="sort" name="sort" defaultValue={sort ?? ""}>
            <option value="">Default</option>
            <option value="date_asc">Date: earliest first</option>
            <option value="date_desc">Date: latest first</option>
            <option value="title">Title A–Z</option>
          </Select>
        </div>
        <div className="flex items-end">
          <Button type="submit" variant="secondary" className="w-full">
            Apply
          </Button>
        </div>
      </form>

      <p className="text-muted mb-3 text-sm" aria-live="polite">
        {matches.length} {matches.length === 1 ? "match" : "matches"}
      </p>
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
        <EmptyState
          title="No matches found"
          description={
            search || status ? "Try clearing the search or filters." : "There are no matches in this view yet."
          }
          action={
            <Link href="/matches/new" className="text-brand-700 font-semibold underline">
              Create a match
            </Link>
          }
        />
      )}
    </div>
  );
}
