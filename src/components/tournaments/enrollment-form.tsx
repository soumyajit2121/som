"use client";

import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { useValidatedAction } from "@/components/forms/use-validated-action";
import { Label, Select } from "@/components/ui/form";
import { ENROLLMENT_STATUSES, ENROLLMENT_STATUS_LABEL } from "@/lib/labels";
import { upsertEnrollmentAction } from "@/server/actions/tournaments";

export function EnrollmentForm({
  tournamentId,
  teams,
}: {
  tournamentId: string;
  teams: { id: string; name: string }[];
}) {
  const { state, pending, formProps } = useValidatedAction(upsertEnrollmentAction);
  return (
    <form {...formProps} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
      <input type="hidden" name="tournamentId" value={tournamentId} />
      <div>
        <Label htmlFor="enroll-team">Team</Label>
        <Select id="enroll-team" name="teamId" defaultValue="" required>
          <option value="" disabled>
            Select team
          </option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="enroll-status">Enrolment status</Label>
        <Select id="enroll-status" name="status" defaultValue="enrolled">
          {ENROLLMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {ENROLLMENT_STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex items-end">
        <SubmitButton pending={pending}>Save enrolment</SubmitButton>
      </div>
      <div className="sm:col-span-3">
        <FormMessage state={state} />
      </div>
    </form>
  );
}
