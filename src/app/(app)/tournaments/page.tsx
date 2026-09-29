import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { TabsNav } from "@/components/common/tabs-nav";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireActiveSession } from "@/lib/auth";
import { formatIstDate } from "@/lib/ist";
import { ENROLLMENT_STATUS_LABEL, TOURNAMENT_STATUS_LABEL } from "@/lib/labels";

export const metadata: Metadata = { title: "Tournaments" };

const VIEWS = {
  current: "Current",
  upcoming: "Upcoming",
  completed: "Completed",
  archived: "Archived",
} as const;
type View = keyof typeof VIEWS;

export default async function TournamentsPage({ searchParams }: PageProps<"/tournaments">) {
  const sp = await searchParams;
  const view: View = (Object.keys(VIEWS) as View[]).includes(sp.view as View) ? (sp.view as View) : "current";
  const { supabase, isAdmin } = await requireActiveSession();

  let q = supabase
    .from("tournaments")
    .select(
      "id, name, organizer, format, start_date, end_date, location, status, archived_at, tournament_enrollments(status, teams(name)), matches(count)",
    )
    .order("start_date", { ascending: view !== "completed" && view !== "archived" });
  if (view === "archived") q = q.not("archived_at", "is", null);
  else {
    q = q.is("archived_at", null);
    q = q.eq("status", view === "current" ? "active" : view);
  }
  const { data: tournaments, error } = await q;

  return (
    <div>
      <PageHeader
        title="Tournaments"
        description="Tournaments our teams are enrolled in. Dates are IST."
        actions={
          isAdmin ? (
            <Button asChild>
              <Link href="/tournaments/new">
                <Plus className="h-4 w-4" aria-hidden="true" />
                New tournament
              </Link>
            </Button>
          ) : null
        }
      />
      {sp.deleted ? (
        <Alert tone="success" className="mb-4">
          Tournament deleted.
        </Alert>
      ) : null}
      <TabsNav
        label="Tournament views"
        current={view}
        tabs={(Object.keys(VIEWS) as View[]).map((v) => ({
          value: v,
          label: VIEWS[v],
          href: `/tournaments?view=${v}`,
        }))}
      />
      {error ? <Alert tone="error">Could not load tournaments. Please retry.</Alert> : null}
      {tournaments?.length ? (
        <ul className="grid gap-4 lg:grid-cols-2">
          {tournaments.map((t) => (
            <li key={t.id}>
              <Card className="h-full">
                <div className="flex flex-wrap gap-2">
                  <Badge tone="purple">{t.format}</Badge>
                  <Badge tone={t.status === "active" ? "green" : "neutral"}>
                    Status: {TOURNAMENT_STATUS_LABEL[t.status]}
                  </Badge>
                  {t.archived_at ? <Badge tone="neutral">Archived</Badge> : null}
                </div>
                <h2 className="mt-2 text-lg font-bold">
                  <Link href={`/tournaments/${t.id}`} className="hover:underline">
                    {t.name}
                  </Link>
                </h2>
                <p className="text-muted text-sm">
                  {formatIstDate(t.start_date)} – {formatIstDate(t.end_date)}
                  {t.location ? ` · ${t.location}` : ""}
                  {t.organizer ? ` · ${t.organizer}` : ""}
                </p>
                <p className="mt-2 text-sm">
                  Teams:{" "}
                  {t.tournament_enrollments.length
                    ? t.tournament_enrollments
                        .map((e) => `${e.teams?.name ?? "Team"} (${ENROLLMENT_STATUS_LABEL[e.status]})`)
                        .join(", ")
                    : "none enrolled"}
                </p>
                <p className="text-sm">Matches: {t.matches[0]?.count ?? 0}</p>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title={`No ${VIEWS[view].toLowerCase()} tournaments`}
          description="Tournaments appear here once an administrator adds them."
        />
      )}
    </div>
  );
}
