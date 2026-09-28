"use client";

import { AlertTriangle } from "lucide-react";
import { useMemo, useState } from "react";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { useValidatedAction } from "@/components/forms/use-validated-action";
import { Alert } from "@/components/ui/alert";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import type { MatchFormOptions } from "@/lib/data/options";
import { formatIstDate } from "@/lib/ist";
import { MATCH_STATUSES, MATCH_STATUS_LABEL, type MatchCategory, type MatchStatus } from "@/lib/labels";
import { matchSchema } from "@/lib/validation/schemas";
import { createMatchAction, updateMatchAction } from "@/server/actions/matches";

export interface MatchFormValues {
  title: string;
  category: MatchCategory;
  tournamentId: string;
  matchDate: string;
  startTime: string;
  reportingTime: string;
  venueId: string;
  ourTeamId: string;
  opponentId: string;
  opponentIsDummy: boolean;
  notes: string;
  cricheroesUrl: string;
  status: MatchStatus;
  resultSummary: string;
}

export function MatchForm({
  mode,
  matchId,
  options,
  isAdmin,
  canEditAll,
  initial,
}: {
  mode: "create" | "edit";
  matchId?: string;
  options: MatchFormOptions;
  isAdmin: boolean;
  /** false for a teammate editing their own match: only basic details are editable. */
  canEditAll: boolean;
  initial: MatchFormValues;
}) {
  const { state, pending, formProps } = useValidatedAction(
    mode === "create" ? createMatchAction : updateMatchAction,
    matchSchema,
  );
  const errors = !state.ok ? state.fieldErrors : undefined;
  const [category, setCategory] = useState<MatchCategory>(initial.category);
  const [ourTeamId, setOurTeamId] = useState(initial.ourTeamId);
  const [tournamentId, setTournamentId] = useState(initial.tournamentId);
  const [opponentMode, setOpponentMode] = useState<"existing" | "dummy" | "new">("existing");
  const locked = !canEditAll;

  const tournaments = useMemo(
    () => options.tournaments.filter((t) => !ourTeamId || t.enrolledTeamIds.includes(ourTeamId)),
    [options.tournaments, ourTeamId],
  );
  const realOpponents = options.opponents.filter((o) => !o.isDummy);
  const currentOpponent = options.opponents.find((o) => o.id === initial.opponentId);

  function chooseCategory(next: MatchCategory) {
    setCategory(next);
    // Practice matches never keep a previously selected tournament.
    if (next === "practice") setTournamentId("");
  }

  const duplicate = !state.ok && state.code === "DUPLICATE_MATCH";

  return (
    <form {...formProps} className="space-y-6">
      {matchId ? <input type="hidden" name="id" value={matchId} /> : null}
      {locked ? (
        <Alert tone="info">
          You created this match, so you can edit its basic details. Category, team, opponent and status can only be
          changed by an administrator.
        </Alert>
      ) : null}

      <fieldset className="border-line space-y-4 rounded-xl border bg-white p-4">
        <legend className="px-1 text-base font-bold">Match</legend>
        <Field name="title" label="Match title" errors={errors?.title} required>
          {(p) => <Input defaultValue={initial.title} maxLength={120} placeholder="e.g. League Match 5" {...p} />}
        </Field>

        <div
          role="radiogroup"
          aria-labelledby="category-label"
          aria-describedby={errors?.category ? "category-error" : undefined}
        >
          <p id="category-label" className="mb-1 text-sm font-semibold">
            Match category <span className="text-red-700">*</span>
          </p>
          {locked ? <input type="hidden" name="category" value={category} /> : null}
          <div className="grid gap-2 sm:grid-cols-2">
            {(["tournament", "practice"] as const).map((c) => (
              <label
                key={c}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${category === c ? "border-brand-700 bg-brand-50" : "border-gray-400"} ${locked ? "opacity-70" : ""}`}
              >
                <input
                  type="radio"
                  name={locked ? undefined : "category"}
                  value={c}
                  checked={category === c}
                  onChange={() => chooseCategory(c)}
                  disabled={locked}
                  className="h-4 w-4"
                />
                <span className="font-semibold">{c === "tournament" ? "Tournament Match" : "Practice Match"}</span>
              </label>
            ))}
          </div>
        </div>

        <Field name="ourTeamId" label="Our team (the team you represent)" errors={errors?.ourTeamId} required>
          {(p) => (
            <>
              {locked ? <input type="hidden" name="ourTeamId" value={ourTeamId} /> : null}
              <Select
                {...p}
                name={locked ? undefined : "ourTeamId"}
                value={ourTeamId}
                disabled={locked}
                onChange={(e) => {
                  setOurTeamId(e.target.value);
                  setTournamentId("");
                }}
              >
                <option value="">Select a team</option>
                {options.teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </>
          )}
        </Field>

        <Field
          name="tournamentId"
          label="Tournament"
          errors={errors?.tournamentId}
          required={category === "tournament"}
          hint={
            category === "practice"
              ? "Not used for Practice Matches."
              : "Only active or upcoming tournaments in which the selected team is enrolled are listed."
          }
        >
          {(p) => (
            <>
              {locked && category === "tournament" ? (
                <input type="hidden" name="tournamentId" value={tournamentId} />
              ) : null}
              <Select
                {...p}
                name={locked || category === "practice" ? undefined : "tournamentId"}
                value={category === "practice" ? "" : tournamentId}
                onChange={(e) => setTournamentId(e.target.value)}
                disabled={locked || category === "practice"}
              >
                <option value="">
                  {category === "practice" ? "No tournament (practice)" : "Select an enrolled tournament"}
                </option>
                {tournaments.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({formatIstDate(t.startDate)} – {formatIstDate(t.endDate)})
                  </option>
                ))}
              </Select>
            </>
          )}
        </Field>
      </fieldset>

      <fieldset className="border-line space-y-4 rounded-xl border bg-white p-4">
        <legend className="px-1 text-base font-bold">Date, time and venue (IST)</legend>
        <p className="text-muted text-sm">
          Enter all dates and times in India Standard Time (IST, UTC+05:30). They are stored and shown exactly as
          entered.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field name="matchDate" label="Match date (IST)" errors={errors?.matchDate} required>
            {(p) => <Input type="date" defaultValue={initial.matchDate} {...p} />}
          </Field>
          <Field name="startTime" label="Start time (IST)" errors={errors?.startTime} required>
            {(p) => <Input type="time" defaultValue={initial.startTime} {...p} />}
          </Field>
          <Field
            name="reportingTime"
            label="Reporting time (IST)"
            errors={errors?.reportingTime}
            hint="Same day, at or before start."
          >
            {(p) => <Input type="time" defaultValue={initial.reportingTime} {...p} />}
          </Field>
        </div>
        <Field name="venueId" label="Venue" errors={errors?.venueId}>
          {(p) => (
            <Select defaultValue={initial.venueId} {...p}>
              <option value="">To be confirmed</option>
              {options.venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </fieldset>

      <fieldset className="border-line space-y-4 rounded-xl border bg-white p-4">
        <legend className="px-1 text-base font-bold">Opponent</legend>
        {locked ? (
          <>
            <input type="hidden" name="opponentMode" value="existing" />
            <input type="hidden" name="opponentId" value={initial.opponentId} />
            <p className="text-sm">
              Opponent: <strong>{currentOpponent?.name ?? "Unknown"}</strong>
              {initial.opponentIsDummy ? " (placeholder)" : ""}
            </p>
          </>
        ) : (
          <>
            <div role="radiogroup" aria-label="Opponent option" className="grid gap-2 sm:grid-cols-3">
              {(
                [
                  ["existing", mode === "edit" ? "Keep or select an opponent" : "Select an existing opponent"],
                  ["dummy", mode === "edit" ? "Use a new dummy opponent" : "Use dummy opponent"],
                  ...(isAdmin ? ([["new", "Create a new opponent"]] as const) : []),
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm ${opponentMode === value ? "border-brand-700 bg-brand-50" : "border-gray-400"}`}
                >
                  <input
                    type="radio"
                    name="opponentMode"
                    value={value}
                    checked={opponentMode === value}
                    onChange={() => setOpponentMode(value)}
                    className="h-4 w-4"
                  />
                  <span className="font-semibold">{label}</span>
                </label>
              ))}
            </div>
            {opponentMode === "existing" ? (
              <Field name="opponentId" label="Opponent" errors={errors?.opponentId} required>
                {(p) => (
                  <Select defaultValue={initial.opponentId} {...p}>
                    <option value="">Select an opponent</option>
                    {initial.opponentIsDummy && currentOpponent ? (
                      <option value={currentOpponent.id}>{currentOpponent.name} (placeholder, current)</option>
                    ) : null}
                    {realOpponents.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            ) : null}
            {opponentMode === "dummy" ? (
              <div
                className="flex gap-2 rounded-lg border border-amber-400 bg-amber-50 p-3 text-sm text-amber-950"
                role="status"
              >
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                <p>
                  A unique placeholder such as <strong>“Dummy Team 001”</strong> will be created. Administrators are
                  reminded 25 hours before the match to replace it and to update the match in CricHeroes.
                </p>
              </div>
            ) : null}
            {opponentMode === "new" ? (
              <Field name="newOpponentName" label="New opponent name" errors={errors?.newOpponentName} required>
                {(p) => <Input maxLength={80} {...p} />}
              </Field>
            ) : null}
          </>
        )}
      </fieldset>

      <fieldset className="border-line space-y-4 rounded-xl border bg-white p-4">
        <legend className="px-1 text-base font-bold">Details</legend>
        <Field
          name="cricheroesUrl"
          label="CricHeroes match link (optional)"
          errors={errors?.cricheroesUrl}
          hint="Paste the link from the CricHeroes app. The app never signs in to CricHeroes for you."
        >
          {(p) => (
            <Input
              type="url"
              inputMode="url"
              defaultValue={initial.cricheroesUrl}
              placeholder="https://cricheroes.com/..."
              {...p}
            />
          )}
        </Field>
        <Field name="notes" label="Notes" errors={errors?.notes}>
          {(p) => <Textarea defaultValue={initial.notes} maxLength={2000} {...p} />}
        </Field>
        {isAdmin ? (
          <>
            <Field
              name="status"
              label="Match status"
              errors={errors?.status}
              hint="Use “Cancel match” on the match page to cancel."
            >
              {(p) => (
                <Select defaultValue={initial.status === "cancelled" ? "scheduled" : initial.status} {...p}>
                  {MATCH_STATUSES.filter((s) => s !== "cancelled").map((s) => (
                    <option key={s} value={s}>
                      {MATCH_STATUS_LABEL[s]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            {mode === "edit" ? (
              <Field name="resultSummary" label="Result summary" errors={errors?.resultSummary}>
                {(p) => <Input defaultValue={initial.resultSummary} maxLength={500} {...p} />}
              </Field>
            ) : null}
            {mode === "create" ? (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="includeMe" className="h-4 w-4" /> Add me as a confirmed player
              </label>
            ) : null}
          </>
        ) : mode === "create" ? (
          <p className="text-muted text-sm">You will be added to this match automatically as a confirmed player.</p>
        ) : null}
      </fieldset>

      {duplicate ? (
        <Alert tone="warning" title="Possible duplicate match">
          {state.error}{" "}
          {isAdmin ? (
            <label className="mt-2 flex items-center gap-2 font-semibold">
              <input type="checkbox" name="allowDuplicate" className="h-4 w-4" /> This is a separate, legitimate match.
              Save it anyway.
            </label>
          ) : (
            "Check the existing match, or ask an administrator if this really is a separate match."
          )}
        </Alert>
      ) : (
        <FormMessage state={state} />
      )}

      <div className="flex flex-wrap gap-2">
        <SubmitButton size="lg" pending={pending}>
          {mode === "create" ? "Create match" : "Save changes"}
        </SubmitButton>
      </div>
    </form>
  );
}
