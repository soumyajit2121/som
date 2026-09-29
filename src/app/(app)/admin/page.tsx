import type { Metadata } from "next";
import Link from "next/link";
import { AnnouncementForm } from "@/components/admin/admin-forms";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdminSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Administration" };

export default async function AdminPage() {
  const { supabase } = await requireAdminSession();
  const [pending, members, dummies, failed] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase
      .from("match_overview")
      .select("id", { count: "exact", head: true })
      .eq("opponent_is_dummy", true)
      .not("status", "in", "(completed,cancelled)"),
    supabase
      .from("notification_deliveries")
      .select("id", { count: "exact", head: true })
      .in("status", ["failed_permanent", "failed_temporary"]),
  ]);
  const stats = [
    { label: "Accounts awaiting approval", value: pending.count ?? 0, href: "/admin/users?status=pending" },
    { label: "Active members", value: members.count ?? 0, href: "/admin/users" },
    { label: "Open matches with a placeholder opponent", value: dummies.count ?? 0, href: "/matches?view=upcoming" },
    { label: "Failed push deliveries", value: failed.count ?? 0, href: "/admin/deliveries" },
  ];
  return (
    <div className="space-y-5">
      <PageHeader title="Administration" description="Manage members, reference data and notifications." />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <li key={s.label}>
            <Link href={s.href} className="border-line hover:border-brand-700 block rounded-xl border bg-white p-4">
              <p className="text-3xl font-bold">{s.value}</p>
              <p className="text-muted text-sm">{s.label}</p>
            </Link>
          </li>
        ))}
      </ul>
      <Card>
        <CardTitle>Post a general announcement</CardTitle>
        <div className="mt-3">
          <AnnouncementForm />
        </div>
      </Card>
    </div>
  );
}
