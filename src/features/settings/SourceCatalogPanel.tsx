import { Database } from "lucide-react";
import { useTranslation } from "react-i18next";
import { HelpTip } from "../../components/HelpTip";

type SourceToggleKey = "steamcharts" | "steamdb" | "twitchmetrics" | "itchio" | "manual" | "steamImport";

interface SourceCard {
  source: SourceToggleKey;
  label: string;
  enabled: boolean;
  loadedCount: number;
  loading: boolean;
  fetchedAt: string | null;
  note?: string;
}

interface SourceCatalogPanelProps {
  sourceCards: SourceCard[];
  onToggleSource: (source: SourceToggleKey) => void;
}

export function SourceCatalogPanel({ sourceCards, onToggleSource }: SourceCatalogPanelProps) {
  const { t } = useTranslation();

  return (
    <section className="panel" aria-labelledby="sources-heading">
      <h2 id="sources-heading" className="section-heading">
        <span className="heading-label">
          <Database className="ui-icon" aria-hidden="true" />
          {t("sources")}
        </span>
        <HelpTip text={t("helpTips.sources")} />
      </h2>
      <p className="muted">{t("settingsSection.sources.description")}</p>
      <div className="grid-sources">
        {sourceCards.map((source) => (
          <label key={source.source} className={`source-card ${source.enabled ? "is-enabled" : ""}`}>
            <input type="checkbox" checked={source.enabled} onChange={() => onToggleSource(source.source)} />
            <div>
              <strong>{source.label}</strong>
              {source.loading ? (
                <span className="mini-skeleton" aria-hidden="true" />
              ) : (
                <p>{t("gamesLoaded", { count: source.loadedCount })}</p>
              )}
              {source.fetchedAt ? <small>{t("updatedAt", { value: new Date(source.fetchedAt).toLocaleString() })}</small> : null}
              {source.note ? <small>{source.note}</small> : null}
            </div>
          </label>
        ))}
      </div>
    </section>
  );
}
