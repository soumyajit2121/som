import type { Metadata } from "next";
import { InviteForm } from "@/components/admin/admin-forms";
import { ActionButton } from "@/components/forms/action-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Label, Select } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdminSession } from "@/lib/auth";
import { sanitizeSearch } from "@/lib/data/matches";
import { formatIst } from "@/lib/ist";
import { updateUserAction } from "@/server/actions/admin";

export const metadata: Metadata = { title: "Users & roles" };

const STATUS_TONE = { pending: "amber", active: "green", inactive: "neutral" } as const;

export default async function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  const sp = await searchParams;
  const { supabase, userId } = await requireAdminSession();
  const status = ["pending", "active", "inactive"].includes(sp.status as string)
    ? (sp.status as "pending" | "active" | "inactive")
    : undefined;
  const search = typeof sp.q === "string" ? sanitizeSearch(sp.q) : "";

  let q = supabase
    .from("profiles")
    .select(
      "id, display_name, role, status, created_at, approved_at, profile_private(email, phone), team_memberships(is_active, teams(name))",
    )
    .order("status")
    .order("display_name");
  if (status) q = q.eq("status", status);
  if (search) q = q.ilike("display_name", `%${search}%`);
  const [{ data: users }, { data: teams }] = await Promise.all([
    q,
    supabase.from("teams").select("id, name").eq("is_active", true).order("name"),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader title="Users & roles" description="Approve new accounts, change roles and deactivate accounts." />
      <Card>
        <CardTitle>Invite a teammate</CardTitle>
        <p className="text-muted mt-1 mb-3 text-sm">
          Invited accounts are approved automatically and receive an email to set a password.
        </p>
        <InviteForm teams={teams ?? []} />
      </Card>

      <form className="border-line grid gap-3 rounded-xl border bg-white p-3 sm:grid-cols-[1fr_1fr_auto]" role="search">
        <div>
          <Label htmlFor="q">Search by name</Label>
          <Input id="q" name="q" defaultValue={search} />
        </div>
        <div>
          <Label htmlFor="status">Account status</Label>
          <Select id="status" name="status" defaultValue={status ?? ""}>
            <option value="">All</option>
            <option value="pending">Pending approval</option>
            <option value="active">Active</option>
            <option value="inactive">Deactivated</option>
          </Select>
        </div>
        <div className="flex items-end">
          <Button type="submit" variant="secondary" className="w-full">
            Filter
          </Button>
        </div>
      </form>

      {users?.length ? (
        <ul className="space-y-2" aria-label="Users">
          {users.map((u) => {
            const privateRow = Array.isArray(u.profile_private) ? u.profile_private[0] : u.profile_private;
            const teamNames = u.team_memberships
              .filter((m) => m.is_active)
              .map((m) => m.teams?.name)
              .join(", ");
            const self = u.id === userId;
            return (
              <li key={u.id} className="border-line rounded-xl border bg-white p-4" data-testid="user-row">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{u.display_name}</span>
                  <Badge tone={u.role === "admin" ? "purple" : "neutral"}>
                    {u.role === "admin" ? "Administrator" : "Teammate"}
                  </Badge>
                  <Badge tone={STATUS_TONE[u.status]}>
                    {u.status === "inactive" ? "Deactivated" : u.status === "pending" ? "Pending approval" : "Active"}
                  </Badge>
                  {self ? <Badge tone="blue">You</Badge> : null}
                </div>
                <p className="text-muted mt-1 text-sm">
                  {privateRow?.email}
                  {privateRow?.phone ? ` · ${privateRow.phone}` : ""} · Teams: {teamNames || "none"} · Joined{" "}
                  {formatIst(u.created_at)}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {u.status !== "active" ? (
                    <ActionButton
                      action={updateUserAction}
                      fields={{ profileId: u.id, status: "active" }}
                      variant="primary"
                    >
                      {u.status === "pending" ? "Approve" : "Reactivate"}
                    </ActionButton>
                  ) : null}
                  {u.status === "active" && u.role !== "admin" ? (
                    <ActionButton
                      action={updateUserAction}
                      fields={{ profileId: u.id, role: "admin" }}
                      confirm={{
                        title: `Make ${u.display_name} an administrator?`,
                        description: "Administrators can manage every record, member and role.",
                        confirmLabel: "Promote",
                      }}
                    >
                      Promote to administrator
                    </ActionButton>
                  ) : null}
                  {u.role === "admin" && !self ? (
                    <ActionButton
                      action={updateUserAction}
                      fields={{ profileId: u.id, role: "teammate" }}
                      confirm={{
                        title: `Remove administrator rights from ${u.display_name}?`,
                        description: "They will become a teammate.",
                        confirmLabel: "Demote",
                      }}
                    >
                      Make teammate
                    </ActionButton>
                  ) : null}
                  {u.status !== "inactive" && !self ? (
                    <ActionButton
                      action={updateUserAction}
                      fields={{ profileId: u.id, status: "inactive" }}
                      variant="danger"
                      confirm={{
                        title: `Deactivate ${u.display_name}?`,
                        description:
                          "They lose access to all team information and their push devices are removed. History is kept and the account can be reactivated.",
                        confirmLabel: "Deactivate",
                      }}
                    >
                      Deactivate
                    </ActionButton>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState title="No users match these filters" />
      )}
    </div>
  );
}
