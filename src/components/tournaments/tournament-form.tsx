"use client";

import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { useValidatedAction } from "@/components/forms/use-validated-action";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { TOURNAMENT_FORMATS, TOURNAMENT_STATUSES, TOURNAMENT_STATUS_LABEL } from "@/lib/labels";
import { tournamentSchema } from "@/lib/validation/schemas";
import { createTournamentAction, updateTournamentAction } from "@/server/actions/tournaments";

export interface TournamentFormValues {
  name: string;
  organizer: string;
  format: string;
  startDate: string;
  endDate: string;
  venueId: string;
  location: string;
  websiteUrl: string;
  notes: string;
  status: string;
}

export function TournamentForm({
  tournamentId,
  initial,
  venues,
  teams,
}: {
  tournamentId?: string;
  initial: TournamentFormValues;
  venues: { id: string; name: string }[];
  teams?: { id: string; name: string }[];
}) {
  const { state, pending, formProps } = useValidatedAction(
    tournamentId ? updateTournamentAction : createTournamentAction,
    tournamentSchema,
  );
  const errors = !state.ok ? state.fieldErrors : undefined;
  return (
    <form {...formProps} className="border-line space-y-4 rounded-xl border bg-white p-4">
      {tournamentId ? <input type="hidden" name="id" value={tournamentId} /> : null}
      <Field name="name" label="Tournament name" errors={errors?.name} required>
        {(p) => <Input defaultValue={initial.name} maxLength={120} {...p} />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="organizer" label="Organiser" errors={errors?.organizer}>
          {(p) => <Input defaultValue={initial.organizer} maxLength={120} {...p} />}
        </Field>
        <Field name="format" label="Cricket format" errors={errors?.format} required>
          {(p) => (
            <Select defaultValue={initial.format} {...p}>
              {TOURNAMENT_FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field name="startDate" label="Start date (IST)" errors={errors?.startDate} required>
          {(p) => <Input type="date" defaultValue={initial.startDate} {...p} />}
        </Field>
        <Field name="endDate" label="End date (IST)" errors={errors?.endDate} required>
          {(p) => <Input type="date" defaultValue={initial.endDate} {...p} />}
        </Field>
        <Field name="venueId" label="Main venue" errors={errors?.venueId}>
          {(p) => (
            <Select defaultValue={initial.venueId} {...p}>
              <option value="">None / various</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field name="location" label="Location" errors={errors?.location}>
          {(p) => <Input defaultValue={initial.location} maxLength={200} placeholder="City or area" {...p} />}
        </Field>
        <Field name="websiteUrl" label="Website" errors={errors?.websiteUrl}>
          {(p) => <Input type="url" defaultValue={initial.websiteUrl} placeholder="https://" {...p} />}
        </Field>
        <Field name="status" label="Status" errors={errors?.status} required hint="Archive from the tournament page.">
          {(p) => (
            <Select defaultValue={initial.status} {...p}>
              {TOURNAMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {TOURNAMENT_STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <Field name="notes" label="Notes" errors={errors?.notes}>
        {(p) => <Textarea defaultValue={initial.notes} maxLength={2000} {...p} />}
      </Field>
      {teams?.length ? (
        <fieldset>
          <legend className="mb-1 text-sm font-semibold">Enrol our teams</legend>
          <div className="flex flex-wrap gap-3">
            {teams.map((t) => (
              <label key={t.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="enrollTeamIds[]" value={t.id} className="h-4 w-4" />
                {t.name}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      <FormMessage state={state} />
      <SubmitButton pending={pending}>{tournamentId ? "Save tournament" : "Create tournament"}</SubmitButton>
    </form>
  );
}
