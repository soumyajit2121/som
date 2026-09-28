"use client";

import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { useValidatedAction } from "@/components/forms/use-validated-action";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { announcementSchema, inviteSchema, opponentSchema, venueSchema } from "@/lib/validation/schemas";
import { inviteUserAction, saveOpponentAction, saveVenueAction } from "@/server/actions/admin";
import { postAnnouncementAction } from "@/server/actions/notifications";

export function AnnouncementForm() {
  const { state, pending, formProps } = useValidatedAction(postAnnouncementAction, announcementSchema);
  const errors = !state.ok ? state.fieldErrors : undefined;
  return (
    <form {...formProps} className="space-y-3">
      <Field name="title" label="Title" errors={errors?.title} required>
        {(p) => <Input maxLength={140} {...p} />}
      </Field>
      <Field
        name="body"
        label="Message"
        errors={errors?.body}
        required
        hint="Do not include private details such as phone numbers."
      >
        {(p) => <Textarea maxLength={1000} {...p} />}
      </Field>
      <FormMessage state={state} />
      <SubmitButton pending={pending} pendingText="Sending…">
        Send announcement to all members
      </SubmitButton>
    </form>
  );
}

export function InviteForm({ teams }: { teams: { id: string; name: string }[] }) {
  const { state, pending, formProps } = useValidatedAction(inviteUserAction, inviteSchema);
  const errors = !state.ok ? state.fieldErrors : undefined;
  return (
    <form {...formProps} className="grid gap-3 sm:grid-cols-2">
      <Field name="displayName" label="Display name" errors={errors?.displayName} required>
        {(p) => <Input maxLength={80} {...p} />}
      </Field>
      <Field name="email" label="Email" errors={errors?.email} required>
        {(p) => <Input type="email" {...p} />}
      </Field>
      <Field name="teamId" label="Add to team (optional)" errors={errors?.teamId}>
        {(p) => (
          <Select defaultValue="" {...p}>
            <option value="">No team yet</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <div className="flex items-end">
        <SubmitButton pending={pending} pendingText="Inviting…">
          Send invitation
        </SubmitButton>
      </div>
      <div className="sm:col-span-2">
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function VenueForm({
  venue,
}: {
  venue?: { id: string; name: string; address: string; city: string; mapsUrl: string; notes: string };
}) {
  const { state, pending, formProps } = useValidatedAction(saveVenueAction, venueSchema);
  const errors = !state.ok ? state.fieldErrors : undefined;
  return (
    <form {...formProps} className="grid gap-3 sm:grid-cols-2">
      {venue ? <input type="hidden" name="id" value={venue.id} /> : null}
      <Field name="name" label="Venue name" errors={errors?.name} required>
        {(p) => <Input defaultValue={venue?.name} maxLength={120} {...p} />}
      </Field>
      <Field name="city" label="City" errors={errors?.city}>
        {(p) => <Input defaultValue={venue?.city} maxLength={80} {...p} />}
      </Field>
      <Field name="address" label="Address" errors={errors?.address}>
        {(p) => <Input defaultValue={venue?.address} maxLength={300} {...p} />}
      </Field>
      <Field name="mapsUrl" label="Maps link" errors={errors?.mapsUrl}>
        {(p) => <Input type="url" defaultValue={venue?.mapsUrl} placeholder="https://maps.google.com/..." {...p} />}
      </Field>
      <Field name="notes" label="Notes" errors={errors?.notes} className="sm:col-span-2">
        {(p) => <Textarea defaultValue={venue?.notes} maxLength={1000} className="min-h-16" {...p} />}
      </Field>
      <div className="sm:col-span-2">
        <FormMessage state={state} />
        <SubmitButton pending={pending} className="mt-2">
          {venue ? "Save venue" : "Add venue"}
        </SubmitButton>
      </div>
    </form>
  );
}

export function OpponentForm({ opponent }: { opponent?: { id: string; name: string; notes: string } }) {
  const { state, pending, formProps } = useValidatedAction(saveOpponentAction, opponentSchema);
  const errors = !state.ok ? state.fieldErrors : undefined;
  return (
    <form {...formProps} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
      {opponent ? <input type="hidden" name="id" value={opponent.id} /> : null}
      <Field name="name" label="Opponent name" errors={errors?.name} required>
        {(p) => <Input defaultValue={opponent?.name} maxLength={80} {...p} />}
      </Field>
      <Field name="notes" label="Notes" errors={errors?.notes}>
        {(p) => <Input defaultValue={opponent?.notes} maxLength={1000} {...p} />}
      </Field>
      <div className="flex items-end">
        <SubmitButton pending={pending}>{opponent ? "Save" : "Add opponent"}</SubmitButton>
      </div>
      <div className="sm:col-span-3">
        <FormMessage state={state} />
      </div>
    </form>
  );
}
