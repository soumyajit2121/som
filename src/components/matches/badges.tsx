import { AlertTriangle, CalendarClock, CheckCircle2, CircleDashed, Dumbbell, Trophy, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  MATCH_CATEGORY_LABEL,
  MATCH_STATUS_LABEL,
  PARTICIPATION_LABEL,
  READINESS_THRESHOLD,
  type MatchCategory,
  type MatchStatus,
  type ParticipationStatus,
} from "@/lib/labels";

/** Category is shown with an icon and text, never with colour alone. */
export function CategoryBadge({ category }: { category: MatchCategory }) {
  return category === "tournament" ? (
    <Badge tone="purple">
      <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
      {MATCH_CATEGORY_LABEL.tournament}
    </Badge>
  ) : (
    <Badge tone="blue">
      <Dumbbell className="h-3.5 w-3.5" aria-hidden="true" />
      {MATCH_CATEGORY_LABEL.practice}
    </Badge>
  );
}

const statusTone: Record<MatchStatus, "neutral" | "green" | "amber" | "red" | "blue"> = {
  draft: "neutral",
  scheduled: "blue",
  confirmed: "green",
  in_progress: "amber",
  completed: "neutral",
  cancelled: "red",
};

export function StatusBadge({ status }: { status: MatchStatus }) {
  return (
    <Badge tone={statusTone[status]}>
      {status === "cancelled" ? (
        <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      Status: {MATCH_STATUS_LABEL[status]}
    </Badge>
  );
}

export function ReadinessBadge({ confirmed }: { confirmed: number }) {
  const ready = confirmed >= READINESS_THRESHOLD;
  const needed = Math.max(0, READINESS_THRESHOLD - confirmed);
  return ready ? (
    <Badge tone="green">
      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
      Ready: {confirmed}/{READINESS_THRESHOLD} confirmed
    </Badge>
  ) : (
    <Badge tone="amber">
      <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
      Not ready: {confirmed}/{READINESS_THRESHOLD} confirmed, {needed} more needed
    </Badge>
  );
}

const participationTone: Record<ParticipationStatus, "neutral" | "green" | "amber" | "red" | "blue" | "purple"> = {
  not_responded: "neutral",
  available: "blue",
  maybe: "amber",
  unavailable: "red",
  confirmed: "green",
  playing: "purple",
};

export function ParticipationBadge({ status, prefix }: { status: ParticipationStatus | null; prefix?: string }) {
  if (!status) {
    return (
      <Badge tone="neutral">
        <CircleDashed className="h-3.5 w-3.5" aria-hidden="true" />
        {prefix}Not invited
      </Badge>
    );
  }
  return (
    <Badge tone={participationTone[status]}>
      {prefix}
      {PARTICIPATION_LABEL[status]}
    </Badge>
  );
}

export function DummyOpponentWarning({ compact = false }: { compact?: boolean }) {
  return compact ? (
    <Badge tone="amber">
      <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
      Placeholder opponent
    </Badge>
  ) : (
    <div className="flex gap-2 rounded-lg border border-amber-400 bg-amber-50 p-3 text-sm text-amber-950" role="status">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <p>
        <strong>Placeholder opponent.</strong> The real opponent is not known yet. An administrator must replace it and
        create or update the match in CricHeroes.
      </p>
    </div>
  );
}
