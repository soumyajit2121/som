import type { Metadata } from "next";
import { OpponentForm } from "@/components/admin/admin-forms";
import { ActionButton } from "@/components/forms/action-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdminSession } from "@/lib/auth";
import { setActiveFlagAction } from "@/server/actions/admin";

export const metadata: Metadata = { title: "Opponents" };

export default async function OpponentsPage() {
  const { supabase } = await requireAdminSession();
  const { data: opponents } = await supabase.from("opponents").select("*").order("is_dummy").order("name");
  return (
    <div className="space-y-5">
      <PageHeader
        title="Opponents"
        description="Real opponents can be selected when creating matches. Placeholder (dummy) opponents are created automatically and should be replaced on the match."
      />
      <Card>
        <CardTitle>Add an opponent</CardTitle>
        <div className="mt-3">
          <OpponentForm />
        </div>
      </Card>
      <ul className="space-y-3">
        {(opponents ?? []).map((o) => (
          <li key={o.id}>
            <Card>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{o.name}</span>
                {o.is_dummy ? (
                  <Badge tone="amber">Placeholder (dummy)</Badge>
                ) : (
                  <Badge tone="green">Real opponent</Badge>
                )}
                {!o.is_active ? <Badge>Inactive</Badge> : null}
              </div>
              {!o.is_dummy ? (
                <details className="mt-2">
                  <summary className="text-brand-700 cursor-pointer text-sm underline">Edit</summary>
                  <div className="mt-3 space-y-3">
                    <OpponentForm opponent={{ id: o.id, name: o.name, notes: o.notes ?? "" }} />
                    <ActionButton
                      action={setActiveFlagAction}
                      fields={{ table: "opponents", id: o.id, active: o.is_active ? "false" : "true" }}
                    >
                      {o.is_active ? "Deactivate opponent" : "Reactivate opponent"}
                    </ActionButton>
                  </div>
                </details>
              ) : null}
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
