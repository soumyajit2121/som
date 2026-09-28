import type { Metadata } from "next";
import { ActionButton } from "@/components/forms/action-button";
import { PushManager } from "@/components/profile/push-manager";
import { PreferencesForm, ProfileForm } from "@/components/profile/profile-forms";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { requireActiveSession } from "@/lib/auth";
import { publicEnv } from "@/lib/env";
import { formatIst } from "@/lib/ist";
import { SQUAD_ROLE_LABEL } from "@/lib/labels";
import { removeDeviceAction } from "@/server/actions/profile";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const { supabase, userId, profile, isAdmin } = await requireActiveSession();
  const [{ data: priv }, { data: prefs }, { data: devices }, { data: memberships }, { data: full }] = await Promise.all(
    [
      supabase.from("profile_private").select("email, phone").eq("profile_id", userId).maybeSingle(),
      supabase.from("notification_preferences").select("*").eq("profile_id", userId).maybeSingle(),
      supabase
        .from("push_subscriptions")
        .select("id, device_label, created_at, last_success_at")
        .eq("profile_id", userId)
        .order("created_at"),
      supabase
        .from("team_memberships")
        .select("squad_role, teams(name)")
        .eq("profile_id", userId)
        .eq("is_active", true),
      supabase.from("profiles").select("created_at, updated_at, approved_at").eq("id", userId).maybeSingle(),
    ],
  );

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <h1 className="text-2xl font-bold lg:col-span-2">Profile</h1>
      <Card>
        <CardTitle>Your details</CardTitle>
        <dl className="mt-3 mb-4 grid grid-cols-2 gap-2 text-sm">
          <dt className="text-muted">Email</dt>
          <dd>{priv?.email}</dd>
          <dt className="text-muted">Role</dt>
          <dd>
            <Badge tone={isAdmin ? "purple" : "neutral"}>{isAdmin ? "Administrator" : "Teammate"}</Badge>
          </dd>
          <dt className="text-muted">Account status</dt>
          <dd>
            <Badge tone="green">Active</Badge>
          </dd>
          <dt className="text-muted">Teams</dt>
          <dd>
            {memberships?.length
              ? memberships.map((m) => `${m.teams?.name} (${SQUAD_ROLE_LABEL[m.squad_role]})`).join(", ")
              : "Not in a team yet"}
          </dd>
          <dt className="text-muted">Member since</dt>
          <dd>{full ? formatIst(full.created_at) : "—"}</dd>
          <dt className="text-muted">Last updated</dt>
          <dd>{full ? formatIst(full.updated_at) : "—"}</dd>
        </dl>
        <ProfileForm displayName={profile.displayName} phone={priv?.phone ?? ""} />
      </Card>

      <Card>
        <CardTitle>Mobile notifications</CardTitle>
        <div className="mt-3">
          <PushManager vapidPublicKey={publicEnv.vapidPublicKey()} />
        </div>
        <h3 className="mt-5 text-base font-bold">Registered devices ({devices?.length ?? 0})</h3>
        {devices?.length ? (
          <ul className="divide-line mt-2 divide-y">
            {devices.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span>
                  <span className="font-semibold">{d.device_label ?? "Device"}</span>
                  <span className="text-muted block text-xs">
                    Added {formatIst(d.created_at)}
                    {d.last_success_at ? ` · last delivered ${formatIst(d.last_success_at)}` : ""}
                  </span>
                </span>
                <ActionButton
                  action={removeDeviceAction}
                  fields={{ id: d.id }}
                  variant="danger"
                  confirm={{
                    title: "Remove this device?",
                    description: "It will stop receiving push notifications.",
                    confirmLabel: "Remove",
                  }}
                >
                  Remove
                </ActionButton>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted mt-1 text-sm">
            No devices registered. Push status: {prefs?.push_enabled ? "on" : "off"}.
          </p>
        )}
        <div className="border-line mt-5 border-t pt-4">
          <PreferencesForm
            isAdmin={isAdmin}
            prefs={{
              operational: prefs?.push_operational_alerts ?? true,
              matchUpdates: prefs?.push_match_updates ?? true,
              confirmations: prefs?.push_player_confirmations ?? false,
              announcements: prefs?.push_announcements ?? true,
            }}
          />
        </div>
      </Card>
    </div>
  );
}
