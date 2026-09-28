import type { Metadata } from "next";
import { z } from "zod";
import Link from "next/link";
import { ActionButton } from "@/components/forms/action-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Label, Select } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
import { requireActiveSession } from "@/lib/auth";
import { formatIst } from "@/lib/ist";
import { NOTIFICATION_FILTERS, NOTIFICATION_TYPE_LABEL } from "@/lib/labels";
import { cn, safeRelativePath } from "@/lib/utils";
import { markAllReadAction, setNotificationReadAction } from "@/server/actions/notifications";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage({ searchParams }: PageProps<"/notifications">) {
  const sp = await searchParams;
  const { supabase, userId } = await requireActiveSession();
  const filter = NOTIFICATION_FILTERS.find((f) => f.value === sp.type);
  const matchId = z.uuid().safeParse(sp.match).success ? (sp.match as string) : undefined;
  const unreadOnly = sp.unread === "1";

  let q = supabase
    .from("notifications")
    .select("id, type, title, body, link_path, read_at, created_at, match_id, matches(title)")
    .eq("recipient_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (filter) q = q.in("type", filter.types);
  if (matchId) q = q.eq("match_id", matchId);
  if (unreadOnly) q = q.is("read_at", null);

  const [{ data: notifications }, { count: unread }, { data: matchOptions }] = await Promise.all([
    q,
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", userId)
      .is("read_at", null),
    supabase
      .from("notifications")
      .select("match_id, matches(title)")
      .eq("recipient_id", userId)
      .not("match_id", "is", null)
      .limit(200),
  ]);
  const matches = new Map<string, string>();
  for (const m of matchOptions ?? []) if (m.match_id && m.matches) matches.set(m.match_id, m.matches.title);

  return (
    <div>
      <PageHeader
        title="Notifications"
        description={`${unread ?? 0} unread. Times are shown in IST.`}
        actions={
          unread ? (
            <ActionButton action={markAllReadAction} fields={{}} variant="secondary" size="md">
              Mark all as read
            </ActionButton>
          ) : null
        }
      />
      <form className="border-line mb-4 grid gap-3 rounded-xl border bg-white p-3 sm:grid-cols-[1fr_1fr_auto_auto]">
        <div>
          <Label htmlFor="type">Type</Label>
          <Select id="type" name="type" defaultValue={filter?.value ?? ""}>
            <option value="">All types</option>
            {NOTIFICATION_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="match">Match</Label>
          <Select id="match" name="match" defaultValue={matchId ?? ""}>
            <option value="">All matches</option>
            {[...matches.entries()].map(([id, title]) => (
              <option key={id} value={id}>
                {title}
              </option>
            ))}
          </Select>
        </div>
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input type="checkbox" name="unread" value="1" defaultChecked={unreadOnly} className="h-4 w-4" /> Unread only
        </label>
        <div className="flex items-end">
          <Button type="submit" variant="secondary" className="w-full">
            Filter
          </Button>
        </div>
      </form>

      {notifications?.length ? (
        <ul className="space-y-2" aria-label="Notification history">
          {notifications.map((n) => {
            const unreadItem = !n.read_at;
            return (
              <li
                key={n.id}
                className={cn(
                  "rounded-xl border bg-white p-4",
                  unreadItem ? "border-brand-700 border-l-4" : "border-line",
                )}
                data-testid="notification-item"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={unreadItem ? "green" : "neutral"}>{unreadItem ? "Unread" : "Read"}</Badge>
                  <Badge tone="neutral">{NOTIFICATION_TYPE_LABEL[n.type]}</Badge>
                  <time dateTime={n.created_at} className="text-muted text-xs">
                    {formatIst(n.created_at)}
                  </time>
                </div>
                <p className="mt-1 font-semibold">{n.title}</p>
                <p className="text-sm">{n.body}</p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  {n.link_path ? (
                    <Link
                      prefetch={false}
                      href={`/notifications/open/${n.id}`}
                      data-href={safeRelativePath(n.link_path, "/notifications")}
                      className="text-brand-700 text-sm font-semibold underline"
                    >
                      {n.match_id ? `Open match${n.matches ? `: ${n.matches.title}` : ""}` : "Open"}
                    </Link>
                  ) : null}
                  <ActionButton
                    action={setNotificationReadAction}
                    fields={{ id: n.id, read: unreadItem ? "true" : "false" }}
                    variant="ghost"
                    showMessage={false}
                  >
                    {unreadItem ? "Mark as read" : "Mark as unread"}
                  </ActionButton>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          title={filter || matchId || unreadOnly ? "No notifications match these filters" : "You're all caught up"}
          description="Reminders, match updates and announcements will appear here."
        />
      )}
    </div>
  );
}
