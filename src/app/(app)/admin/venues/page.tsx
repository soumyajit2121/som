import type { Metadata } from "next";
import { VenueForm } from "@/components/admin/admin-forms";
import { ActionButton } from "@/components/forms/action-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdminSession } from "@/lib/auth";
import { setActiveFlagAction } from "@/server/actions/admin";

export const metadata: Metadata = { title: "Venues" };

export default async function VenuesPage() {
  const { supabase } = await requireAdminSession();
  const { data: venues } = await supabase.from("venues").select("*").order("name");
  return (
    <div className="space-y-5">
      <PageHeader title="Venues" />
      <Card>
        <CardTitle>Add a venue</CardTitle>
        <div className="mt-3">
          <VenueForm />
        </div>
      </Card>
      <ul className="space-y-3">
        {(venues ?? []).map((v) => (
          <li key={v.id}>
            <Card>
              <details>
                <summary className="flex cursor-pointer flex-wrap items-center gap-2">
                  <span className="font-semibold">{v.name}</span>
                  {v.city ? <span className="text-muted text-sm">{v.city}</span> : null}
                  {!v.is_active ? <Badge>Inactive</Badge> : null}
                  <span className="text-brand-700 ml-auto text-sm underline">Edit</span>
                </summary>
                <div className="mt-3 space-y-3">
                  <VenueForm
                    venue={{
                      id: v.id,
                      name: v.name,
                      address: v.address ?? "",
                      city: v.city ?? "",
                      mapsUrl: v.maps_url ?? "",
                      notes: v.notes ?? "",
                    }}
                  />
                  <ActionButton
                    action={setActiveFlagAction}
                    fields={{ table: "venues", id: v.id, active: v.is_active ? "false" : "true" }}
                  >
                    {v.is_active ? "Deactivate venue" : "Reactivate venue"}
                  </ActionButton>
                </div>
              </details>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
