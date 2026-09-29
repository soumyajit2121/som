import { Bell, CalendarPlus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { MatchCard } from "@/components/matches/match-card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireActiveSession } from "@/lib/auth";
import { listMatches, myParticipation, myTeamIds } from "@/lib/data/matches";
import { unreadCount } from "@/lib/data/notifications";
import { formatIst } from "@/lib/ist";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const { supabase, userId, profile, isAdmin } = await requireActiveSession();
  const [teamIds, upcoming, unread] = await Promise.all([
    myTeamIds(supabase, userId),
    listMatches(supabase, { view: "upcoming", limit: 50 }),
    unreadCount(supabase, userId),
  ]);
  const statuses = await myParticipation(
    supabase,
    userId,
    upcoming.map((m) => m.id),
  );
  const relevant = upcoming.filter((m) => teamIds.includes(m.ourTeamId) || statuses.has(m.id));
  const next = relevant[0] ?? (isAdmin ? upcoming[0] : undefined);
  const mine = upcoming.filter((m) => statuses.has(m.id)).slice(0, 6);
  const attention = isAdmin ? upcoming.filter((m) => m.opponentIsDummy || m.counts.confirmed < 11).slice(0, 5) : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Hello, ${profile.displayName}`}
        description={`All times are India Standard Time (IST). Now: ${formatIst(new Date())}`}
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/notifications">
                <Bell className="h-4 w-4" aria-hidden="true" />
                {unread} unread
              </Link>
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
      {sp.denied ? <Alert tone="error">That page is only available to administrators.</Alert> : null}
      {sp.passwordUpdated ? <Alert tone="success">Your password has been updated.</Alert> : null}

      <section aria-labelledby="next-match">
        <h2 id="next-match" className="mb-3 text-xl font-bold">
          Next match
        </h2>
        {next ? (
          <MatchCard
            match={next}
            myStatus={statuses.get(next.id) ?? null}
            representing={teamIds.includes(next.ourTeamId)}
          />
        ) : (
          <EmptyState
            title="No upcoming matches"
            description="When a match is scheduled for your team it will appear here."
            action={
              <Link href="/matches/new" className="text-brand-700 font-semibold underline">
                Create a match
              </Link>
            }
          />
        )}
      </section>

      {isAdmin && attention.length ? (
        <section aria-labelledby="attention">
          <Card>
            <CardTitle id="attention">Needs attention</CardTitle>
            <ul className="divide-line mt-3 divide-y">
              {attention.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <Link href={`/matches/${m.id}`} className="text-brand-700 font-semibold underline">
                    {m.title}
                  </Link>
                  <span>
                    {m.counts.confirmed < 11 ? `${m.counts.confirmed}/11 confirmed` : null}
                    {m.counts.confirmed < 11 && m.opponentIsDummy ? " · " : null}
                    {m.opponentIsDummy ? "Placeholder opponent" : null}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}

      <section aria-labelledby="my-matches">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="my-matches" className="text-xl font-bold">
            My upcoming matches
          </h2>
          <Link href="/matches?view=mine" className="text-brand-700 text-sm font-semibold underline">
            View all
          </Link>
        </div>
        {mine.length ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {mine.map((m) => (
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
            title="You are not in any upcoming match yet"
            description="Open a match of your team and mark your availability."
          />
        )}
      </section>
    </div>
  );
}
