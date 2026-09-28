"use client";

import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { useValidatedAction } from "@/components/forms/use-validated-action";
import { Button } from "@/components/ui/button";
import { Label, Select, Textarea } from "@/components/ui/form";
import {
  PARTICIPATION_LABEL,
  PARTICIPATION_STATUSES,
  SELF_PARTICIPATION_STATUSES,
  type ParticipationStatus,
} from "@/lib/labels";
import {
  addParticipantsAction,
  cancelMatchAction,
  replaceOpponentAction,
  setParticipationAction,
} from "@/server/actions/matches";

/** The signed-in player's own response. */
export function MyResponse({
  matchId,
  profileId,
  current,
  disabled,
}: {
  matchId: string;
  profileId: string;
  current: ParticipationStatus | null;
  disabled?: boolean;
}) {
  const { state, pending, formProps } = useValidatedAction(setParticipationAction);
  return (
    <form {...formProps} aria-labelledby="my-response-heading">
      <input type="hidden" name="matchId" value={matchId} />
      <input type="hidden" name="profileId" value={profileId} />
      <p id="my-response-heading" className="mb-2 text-sm font-semibold">
        Your response:{" "}
        <span data-testid="my-status">{current ? PARTICIPATION_LABEL[current] : "Not invited / no response"}</span>
      </p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Set your availability">
        {SELF_PARTICIPATION_STATUSES.map((s) => (
          <Button
            key={s}
            type="submit"
            name="status"
            value={s}
            size="sm"
            variant={current === s ? "primary" : "secondary"}
            aria-pressed={current === s}
            disabled={disabled || pending}
          >
            {PARTICIPATION_LABEL[s]}
          </Button>
        ))}
      </div>
      {current === "playing" ? (
        <p className="text-muted mt-2 text-sm">An administrator has selected you in the playing XI.</p>
      ) : null}
      <div className="mt-2 empty:hidden" aria-live="polite">
        <FormMessage state={state} />
      </div>
    </form>
  );
}

/** Administrator control to set any player's status. */
export function AdminStatusSelect({
  matchId,
  profileId,
  displayName,
  current,
}: {
  matchId: string;
  profileId: string;
  displayName: string;
  current: ParticipationStatus;
}) {
  const { state, pending, formProps } = useValidatedAction(setParticipationAction);
  const id = `status-${profileId}`;
  return (
    <form {...formProps} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="matchId" value={matchId} />
      <input type="hidden" name="profileId" value={profileId} />
      <label htmlFor={id} className="sr-only">
        Status for {displayName}
      </label>
      <Select id={id} name="status" defaultValue={current} className="w-auto min-w-36">
        {PARTICIPATION_STATUSES.map((s) => (
          <option key={s} value={s}>
            {PARTICIPATION_LABEL[s]}
          </option>
        ))}
      </Select>
      <SubmitButton size="sm" variant="secondary" pending={pending}>
        Update
      </SubmitButton>
      {!state.ok ? (
        <span className="text-sm text-red-700" role="alert">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}

export function AddPlayersForm({
  matchId,
  candidates,
}: {
  matchId: string;
  candidates: { id: string; displayName: string; inSquad: boolean }[];
}) {
  const { state, pending, formProps } = useValidatedAction(addParticipantsAction);
  if (!candidates.length) return <p className="text-muted text-sm">Every active player is already in this match.</p>;
  return (
    <form {...formProps} className="space-y-3">
      <input type="hidden" name="matchId" value={matchId} />
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Add players to this match</legend>
        <div className="border-line grid max-h-64 gap-1 overflow-y-auto rounded-lg border p-2 sm:grid-cols-2">
          {candidates.map((c) => (
            <label key={c.id} className="flex items-center gap-2 rounded p-1 text-sm hover:bg-gray-50">
              <input type="checkbox" name="profileIds[]" value={c.id} className="h-4 w-4" />
              {c.displayName}
              {c.inSquad ? null : <span className="text-muted text-xs">(other team)</span>}
            </label>
          ))}
        </div>
      </fieldset>
      <SubmitButton size="sm" pending={pending}>
        Add selected players
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function ReplaceOpponentForm({
  matchId,
  opponents,
}: {
  matchId: string;
  opponents: { id: string; name: string }[];
}) {
  const { state, pending, formProps } = useValidatedAction(replaceOpponentAction);
  return (
    <form {...formProps} className="space-y-2">
      <input type="hidden" name="matchId" value={matchId} />
      <Label htmlFor="replace-opponent">Replace placeholder with a real opponent</Label>
      <div className="flex flex-wrap gap-2">
        <Select id="replace-opponent" name="opponentId" defaultValue="" className="w-auto min-w-48" required>
          <option value="" disabled>
            Select opponent
          </option>
          {opponents.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </Select>
        <SubmitButton size="sm" pending={pending}>
          Replace opponent
        </SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

export function CancelMatchForm({ matchId }: { matchId: string }) {
  const { state, pending, formProps } = useValidatedAction(cancelMatchAction);
  return (
    <form
      {...formProps}
      onSubmit={(e) => {
        if (!window.confirm("Cancel this match? All participants will be notified.")) {
          e.preventDefault();
          return;
        }
        formProps.onSubmit(e);
      }}
      className="space-y-2"
    >
      <input type="hidden" name="matchId" value={matchId} />
      <Label htmlFor="cancel-reason">Cancellation reason (optional)</Label>
      <Textarea id="cancel-reason" name="reason" maxLength={500} className="min-h-16" />
      <SubmitButton variant="danger" size="sm" pending={pending}>
        Cancel match
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
