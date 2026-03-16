import type { SourceId } from "../types";

interface SourceAccentChipsProps {
  sources: SourceId[];
  formatSourceLabel: (sources: SourceId[]) => string;
}

export function SourceAccentChips({ sources, formatSourceLabel }: SourceAccentChipsProps) {
  return (
    <div className="source-chip-row" aria-label={formatSourceLabel(sources)}>
      {sources.map((source) => (
        <span key={source} className="source-chip" data-source={source}>
          {formatSourceLabel([source])}
        </span>
      ))}
    </div>
  );
}
