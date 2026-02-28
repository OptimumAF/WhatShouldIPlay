import { Trophy } from "lucide-react";

interface WinnerSummaryCardProps {
  prompt: string;
  winner: string;
  sourceLabel: string;
  sourceValue: string;
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
  sourceValue,
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
        <span>
          {sourceLabel}: {sourceValue}
        </span>
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
