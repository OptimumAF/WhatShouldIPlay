import { Filter, RotateCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { HelpTip } from "../../components/HelpTip";

interface FilterValues {
  platform: string;
  tag: string;
  length: string;
  releaseFrom: string;
  releaseTo: string;
  freeOnly: boolean;
  maxPriceUsd: number;
}

interface FiltersPanelProps {
  filters: FilterValues;
  availableTags: string[];
  onPlatformChange: (value: string) => void;
  onTagChange: (value: string) => void;
  onLengthChange: (value: string) => void;
  onReleaseFromChange: (value: string) => void;
  onReleaseToChange: (value: string) => void;
  onMaxPriceChange: (value: number) => void;
  onFreeOnlyChange: (value: boolean) => void;
  onReset: () => void;
}

export function FiltersPanel({
  filters,
  availableTags,
  onPlatformChange,
  onTagChange,
  onLengthChange,
  onReleaseFromChange,
  onReleaseToChange,
  onMaxPriceChange,
  onFreeOnlyChange,
  onReset,
}: FiltersPanelProps) {
  const { t } = useTranslation();

  return (
    <section className="panel" aria-labelledby="filters-heading">
      <h2 id="filters-heading" className="section-heading">
        <span className="heading-label">
          <Filter className="ui-icon" aria-hidden="true" />
          {t("advancedFiltersTitle")}
        </span>
        <HelpTip text={t("helpTips.advancedFilters")} />
      </h2>
      <p className="muted">{t("advancedFiltersDescription")}</p>
      <div className="filters-grid">
        <label className="filter-field">
          <span>{t("filterPlatform")}</span>
          <select value={filters.platform} onChange={(event) => onPlatformChange(event.target.value)}>
            <option value="any">{t("any")}</option>
            <option value="windows">{t("windows")}</option>
            <option value="mac">{t("macos")}</option>
            <option value="linux">{t("linux")}</option>
          </select>
        </label>

        <label className="filter-field">
          <span>{t("filterGenreTag")}</span>
          <select value={filters.tag} onChange={(event) => onTagChange(event.target.value)}>
            <option value="any">{t("any")}</option>
            {availableTags.slice(0, 250).map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </label>

        <label className="filter-field">
          <span>{t("filterEstimatedLength")}</span>
          <select value={filters.length} onChange={(event) => onLengthChange(event.target.value)}>
            <option value="any">{t("any")}</option>
            <option value="short">{t("short")}</option>
            <option value="medium">{t("medium")}</option>
            <option value="long">{t("long")}</option>
          </select>
        </label>

        <label className="filter-field">
          <span>{t("filterReleaseAfter")}</span>
          <input type="date" value={filters.releaseFrom} onChange={(event) => onReleaseFromChange(event.target.value)} />
        </label>

        <label className="filter-field">
          <span>{t("filterReleaseBefore")}</span>
          <input type="date" value={filters.releaseTo} onChange={(event) => onReleaseToChange(event.target.value)} />
        </label>

        <label className="filter-field">
          <span>{t("maxPriceLabel", { price: filters.maxPriceUsd.toFixed(0) })}</span>
          <input
            type="range"
            min={0}
            max={70}
            step={1}
            disabled={filters.freeOnly}
            value={filters.maxPriceUsd}
            onChange={(event) => onMaxPriceChange(Number(event.target.value))}
          />
          <small className="filter-help">{t("maxPriceHelp")}</small>
        </label>

        <label className="inline-check">
          <input type="checkbox" checked={filters.freeOnly} onChange={(event) => onFreeOnlyChange(event.target.checked)} />
          <span>{t("freeOnly")}</span>
          <HelpTip text={t("helpTips.freeOnly")} />
        </label>
      </div>
      <div className="button-row">
        <button type="button" className="ghost" onClick={onReset}>
          <span className="button-label">
            <RotateCw className="ui-icon" aria-hidden="true" />
            {t("resetFilters")}
          </span>
        </button>
      </div>
    </section>
  );
}
