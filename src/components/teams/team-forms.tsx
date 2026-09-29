"use client";

import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { useValidatedAction } from "@/components/forms/use-validated-action";
import { Field, Input, Label, Select, Textarea } from "@/components/ui/form";
import { SQUAD_ROLE_LABEL } from "@/lib/labels";
import { teamSchema } from "@/lib/validation/schemas";
import { saveMembershipAction, saveTeamAction } from "@/server/actions/admin";

export function TeamForm({ team }: { team?: { id: string; name: string; shortName: string; description: string } }) {
  const { state, pending, formProps } = useValidatedAction(saveTeamAction, teamSchema);
  const errors = !state.ok ? state.fieldErrors : undefined;
  return (
    <form {...formProps} className="space-y-3">
      {team ? <input type="hidden" name="id" value={team.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
        <Field name="name" label="Team name" errors={errors?.name} required>
          {(p) => <Input defaultValue={team?.name} maxLength={80} {...p} />}
        </Field>
        <Field name="shortName" label="Short name" errors={errors?.shortName}>
          {(p) => <Input defaultValue={team?.shortName} maxLength={12} {...p} />}
        </Field>
      </div>
      <Field name="description" label="Description" errors={errors?.description}>
        {(p) => <Textarea defaultValue={team?.description} maxLength={1000} className="min-h-16" {...p} />}
      </Field>
      <FormMessage state={state} />
      <SubmitButton pending={pending}>{team ? "Save team" : "Create team"}</SubmitButton>
    </form>
  );
}

export function AddMemberForm({ teamId, candidates }: { teamId: string; candidates: { id: string; name: string }[] }) {
  const { state, pending, formProps } = useValidatedAction(saveMembershipAction);
  if (!candidates.length) return <p className="text-muted text-sm">Every active user is already in this squad.</p>;
  return (
    <form {...formProps} className="grid gap-3 sm:grid-cols-[2fr_1fr_auto]">
      <input type="hidden" name="teamId" value={teamId} />
      <div>
        <Label htmlFor="member">Player</Label>
        <Select id="member" name="profileId" defaultValue="" required>
          <option value="" disabled>
            Select a player
          </option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="squadRole">Squad role</Label>
        <Select id="squadRole" name="squadRole" defaultValue="player">
          {Object.entries(SQUAD_ROLE_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex items-end">
        <SubmitButton pending={pending}>Add to squad</SubmitButton>
      </div>
      <div className="sm:col-span-3">
        <FormMessage state={state} />
      </div>
    </form>
  );
}
