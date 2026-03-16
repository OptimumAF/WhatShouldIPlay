import { Trophy } from "lucide-react";
import type { SourceId } from "../types";
import { SourceAccentChips } from "./SourceAccentChips";

interface WinnerSummaryCardProps {
  prompt: string;
  winner: string;
  sourceLabel: string;
  sources: SourceId[];
  formatSourceLabel: (sources: SourceId[]) => string;
  oddsLabel: string;
  oddsValue: string;
  playedLabel: string;
  completedLabel: string;
  onMarkPlayed: () => void;
  onMarkCompleted: () => void;
}

export function WinnerSummaryCard({
  prompt,
  winner,
  sourceLabel,
  sources,
  formatSourceLabel,
  oddsLabel,
  oddsValue,
  playedLabel,
  completedLabel,
  onMarkPlayed,
  onMarkCompleted,
}: WinnerSummaryCardProps) {
  return (
    <div className="winner winner-rich">
      <p className="winner-inline">
        <Trophy className="ui-icon" aria-hidden="true" />
        {prompt}
      </p>
      <strong>{winner}</strong>
      <div className="winner-stats">
        <span>{sourceLabel}</span>
        <SourceAccentChips sources={sources} formatSourceLabel={formatSourceLabel} />
        <span>
          {oddsLabel}: {oddsValue}
        </span>
      </div>
      <div className="button-row">
        <button type="button" className="ghost" onClick={onMarkPlayed}>
          {playedLabel}
        </button>
        <button type="button" className="ghost" onClick={onMarkCompleted}>
          {completedLabel}
        </button>
      </div>
    </div>
  );
}
