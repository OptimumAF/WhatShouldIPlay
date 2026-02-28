import { History } from "lucide-react";

export interface SpinHistoryDisplayItem {
  key: string;
  name: string;
  meta: string;
  odds: string;
}

interface SpinHistoryPanelProps {
  title: string;
  emptyLabel: string;
  items: SpinHistoryDisplayItem[];
}

export function SpinHistoryPanel({ title, emptyLabel, items }: SpinHistoryPanelProps) {
  return (
    <section className="panel" aria-labelledby="history-heading">
      <h2 id="history-heading" className="section-heading">
        <span className="heading-label">
          <History className="ui-icon" aria-hidden="true" />
          {title}
        </span>
      </h2>
      {items.length === 0 ? (
        <p className="muted">{emptyLabel}</p>
      ) : (
        <ul className="history-list" aria-label="Recent spin results">
          {items.map((item) => (
            <li key={item.key}>
              <div>
                <strong>{item.name}</strong>
                <small>{item.meta}</small>
              </div>
              <span>{item.odds}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
