import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireActiveSession } from "@/lib/auth";
import { listMatches, type MatchSummary } from "@/lib/data/matches";
import { formatIstDateLong, formatIstMonth, formatIstTime, istMonthGrid, todayIst } from "@/lib/ist";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Calendar" };

function parseMonth(value: unknown, today: string): { year: number; month: number } {
  const m = typeof value === "string" ? /^(\d{4})-(\d{2})$/.exec(value) : null;
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) return { year: Number(m[1]), month: Number(m[2]) };
  return { year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) };
}

const pad = (n: number) => String(n).padStart(2, "0");

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const sp = await searchParams;
  const today = todayIst();
  const { year, month } = parseMonth(sp.month, today);
  const weeks = istMonthGrid(year, month);
  const { supabase } = await requireActiveSession();
  const matches = await listMatches(supabase, {
    view: "all",
    fromDate: weeks[0][0],
    toDate: weeks[weeks.length - 1][6],
    sort: "date_asc",
  });
  const byDate = new Map<string, MatchSummary[]>();
  for (const m of matches) byDate.set(m.matchDate, [...(byDate.get(m.matchDate) ?? []), m]);

  const prev = month === 1 ? `${year - 1}-12` : `${year}-${pad(month - 1)}`;
  const next = month === 12 ? `${year + 1}-01` : `${year}-${pad(month + 1)}`;
  const monthPrefix = `${year}-${pad(month)}`;
  const inMonth = matches.filter((m) => m.matchDate.startsWith(monthPrefix));

  return (
    <div>
      <PageHeader title="Calendar" description="Match dates in India Standard Time (IST)." />
      <div className="mb-4 flex items-center justify-between gap-2">
        <Button asChild variant="secondary" size="sm">
          <Link href={`/calendar?month=${prev}`} aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Previous
          </Link>
        </Button>
        <h2 className="text-xl font-bold" aria-live="polite">
          {formatIstMonth(year, month)}
        </h2>
        <Button asChild variant="secondary" size="sm">
          <Link href={`/calendar?month=${next}`} aria-label="Next month">
            Next <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
      </div>

      <table className="hidden w-full table-fixed border-collapse overflow-hidden rounded-xl bg-white md:table">
        <caption className="sr-only">Matches in {formatIstMonth(year, month)}</caption>
        <thead>
          <tr>
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <th key={d} scope="col" className="border-line border bg-gray-50 p-2 text-sm">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week[0]}>
              {week.map((date) => {
                const outside = !date.startsWith(monthPrefix);
                const items = byDate.get(date) ?? [];
                return (
                  <td
                    key={date}
                    className={cn(
                      "border-line h-28 border p-1 align-top text-sm",
                      outside && "bg-gray-50 text-gray-500",
                    )}
                    aria-label={formatIstDateLong(date)}
                  >
                    <div
                      className={cn(
                        "mb-1 text-xs font-semibold",
                        date === today && "bg-brand-700 inline-block rounded px-1.5 text-white",
                      )}
                    >
                      {Number(date.slice(8, 10))}
                      {date === today ? <span className="sr-only"> (today)</span> : null}
                    </div>
                    <ul className="space-y-1">
                      {items.map((m) => (
                        <li key={m.id}>
                          <Link
                            href={`/matches/${m.id}`}
                            className={cn(
                              "block truncate rounded border px-1 py-0.5 text-xs",
                              m.category === "tournament"
                                ? "border-purple-300 bg-purple-50"
                                : "border-blue-300 bg-blue-50",
                              m.status === "cancelled" && "line-through",
                            )}
                            title={`${m.title} vs ${m.opponentName}`}
                          >
                            {m.startTime} {m.category === "tournament" ? "[T]" : "[P]"} {m.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-muted mt-2 hidden text-xs md:block">
        [T] Tournament Match · [P] Practice Match · times in IST
      </p>

      <section className="md:hidden" aria-label="Agenda">
        {inMonth.length ? (
          <ul className="space-y-2">
            {inMonth.map((m) => (
              <li key={m.id}>
                <Link href={`/matches/${m.id}`} className="border-line block rounded-xl border bg-white p-3">
                  <p className="text-sm font-semibold">{formatIstDateLong(m.matchDate)}</p>
                  <p className="font-bold">{m.title}</p>
                  <p className="text-muted text-sm">
                    {formatIstTime(m.startTime)} · {m.category === "tournament" ? "Tournament Match" : "Practice Match"}{" "}
                    · vs {m.opponentName}
                    {m.status === "cancelled" ? " · Cancelled" : ""}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No matches this month" />
        )}
      </section>
    </div>
  );
}
