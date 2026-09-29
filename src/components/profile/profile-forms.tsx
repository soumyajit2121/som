"use client";

import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { useValidatedAction } from "@/components/forms/use-validated-action";
import { Field, Input } from "@/components/ui/form";
import { preferencesSchema, profileSchema } from "@/lib/validation/schemas";
import { updatePreferencesAction, updateProfileAction } from "@/server/actions/profile";

export function ProfileForm({ displayName, phone }: { displayName: string; phone: string }) {
  const { state, pending, formProps } = useValidatedAction(updateProfileAction, profileSchema);
  const errors = !state.ok ? state.fieldErrors : undefined;
  return (
    <form {...formProps} className="space-y-3">
      <Field name="displayName" label="Display name" errors={errors?.displayName} required>
        {(p) => <Input defaultValue={displayName} maxLength={80} autoComplete="name" {...p} />}
      </Field>
      <Field
        name="phone"
        label="Phone number (optional)"
        errors={errors?.phone}
        hint="Private: visible only to you and administrators."
      >
        {(p) => <Input type="tel" defaultValue={phone} autoComplete="tel" placeholder="+91 98765 43210" {...p} />}
      </Field>
      <FormMessage state={state} />
      <SubmitButton pending={pending}>Save profile</SubmitButton>
    </form>
  );
}

export function PreferencesForm({
  prefs,
  isAdmin,
}: {
  prefs: { operational: boolean; matchUpdates: boolean; confirmations: boolean; announcements: boolean };
  isAdmin: boolean;
}) {
  const { state, pending, formProps } = useValidatedAction(updatePreferencesAction, preferencesSchema);
  const items: [string, string, boolean, boolean][] = [
    ["pushMatchUpdates", "Match updates and cancellations", prefs.matchUpdates, true],
    ["pushAnnouncements", "General announcements", prefs.announcements, true],
    ["pushOperationalAlerts", "25-hour readiness warnings (administrators)", prefs.operational, isAdmin],
    ["pushPlayerConfirmations", "Player confirmations (administrators)", prefs.confirmations, isAdmin],
  ];
  return (
    <form {...formProps} className="space-y-3">
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Send these to my devices as push notifications</legend>
        <div className="space-y-2">
          {items.map(([name, label, checked, visible]) =>
            visible ? (
              <label key={name} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name={name} defaultChecked={checked} className="h-4 w-4" />
                {label}
              </label>
            ) : (
              <input key={name} type="hidden" name={name} value={checked ? "on" : ""} />
            ),
          )}
        </div>
      </fieldset>
      <p className="text-muted text-xs">In-app notifications are always kept in your notification centre.</p>
      <FormMessage state={state} />
      <SubmitButton pending={pending} variant="secondary">
        Save preferences
      </SubmitButton>
    </form>
  );
}
