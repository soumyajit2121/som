import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdminSession } from "@/lib/auth";
import { formatIst } from "@/lib/ist";
import { NOTIFICATION_TYPE_LABEL } from "@/lib/labels";

export const metadata: Metadata = { title: "Notification deliveries" };

const TONE = {
  pending: "blue",
  sending: "blue",
  sent: "green",
  failed_temporary: "amber",
  failed_permanent: "red",
  expired: "neutral",
  skipped: "neutral",
} as const;

export default async function DeliveriesPage() {
  const { supabase } = await requireAdminSession();
  const [{ data: deliveries }, { data: reminders }, { data: notifications }] = await Promise.all([
    supabase
      .from("notification_deliveries")
      .select(
        "id, channel, status, attempts, max_attempts, response_code, last_error, last_attempt_at, created_at, notifications(type, title, profiles!notifications_recipient_id_fkey(display_name))",
      )
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("reminder_deliveries")
      .select("id, reminder_kind, occurrence, conditions, created_at, matches(title), profiles(display_name)")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("notifications")
      .select("id, type, title, created_at, read_at, profiles!notifications_recipient_id_fkey(display_name)")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Notification deliveries"
        description="Push delivery attempts, scheduled reminders and recent in-app notifications. Device addresses are never shown."
      />
      <Card>
        <CardTitle>Push delivery attempts</CardTitle>
        {deliveries?.length ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="p-2">
                    Created (IST)
                  </th>
                  <th scope="col" className="p-2">
                    Recipient
                  </th>
                  <th scope="col" className="p-2">
                    Notification
                  </th>
                  <th scope="col" className="p-2">
                    Status
                  </th>
                  <th scope="col" className="p-2">
                    Attempts
                  </th>
                  <th scope="col" className="p-2">
                    Last result
                  </th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map((d) => (
                  <tr key={d.id} className="border-line border-t align-top">
                    <td className="p-2 whitespace-nowrap">{formatIst(d.created_at)}</td>
                    <td className="p-2">{d.notifications?.profiles?.display_name ?? "—"}</td>
                    <td className="p-2">{d.notifications ? NOTIFICATION_TYPE_LABEL[d.notifications.type] : "—"}</td>
                    <td className="p-2">
                      <Badge tone={TONE[d.status]}>{d.status.replace("_", " ")}</Badge>
                    </td>
                    <td className="p-2">
                      {d.attempts}/{d.max_attempts}
                    </td>
                    <td className="p-2 text-xs">
                      {d.last_attempt_at ? formatIst(d.last_attempt_at) : "—"}
                      {d.response_code ? ` · HTTP ${d.response_code}` : ""}
                      {d.last_error ? ` · ${d.last_error}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No push deliveries yet"
            description="Deliveries appear once members enable push notifications."
          />
        )}
      </Card>
      <Card>
        <CardTitle>Scheduled reminders (25 hours before start)</CardTitle>
        {reminders?.length ? (
          <ul className="divide-line mt-3 divide-y text-sm">
            {reminders.map((r) => (
              <li key={r.id} className="py-2">
                <span className="font-semibold">{r.matches?.title}</span> → {r.profiles?.display_name} ·{" "}
                {r.conditions
                  .map((c) => (c === "dummy_opponent" ? "dummy opponent" : "insufficient players"))
                  .join(" + ")}{" "}
                · created {formatIst(r.created_at)} · match starts {formatIst(r.occurrence)}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No reminders sent yet" />
        )}
      </Card>
      <Card>
        <CardTitle>Recent in-app notifications (all members)</CardTitle>
        <ul className="divide-line mt-3 divide-y text-sm">
          {(notifications ?? []).map((n) => (
            <li key={n.id} className="py-2">
              {formatIst(n.created_at)} · {n.profiles?.display_name} · {NOTIFICATION_TYPE_LABEL[n.type]} · {n.title}{" "}
              <Badge tone={n.read_at ? "neutral" : "green"}>{n.read_at ? "Read" : "Unread"}</Badge>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
