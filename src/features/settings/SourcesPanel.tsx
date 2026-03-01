import { Database, SlidersHorizontal, WandSparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { HelpTip } from "../../components/HelpTip";

type SourceToggleKey = "steamcharts" | "steamdb" | "twitchmetrics" | "itchio" | "manual" | "steamImport";
type SpinSpeedProfile = "cinematic" | "balanced" | "rapid";

interface PresetCard {
  id: string;
  label: string;
  description: string;
}

interface SourceCard {
  source: SourceToggleKey;
  label: string;
  enabled: boolean;
  loadedCount: number;
  loading: boolean;
  fetchedAt: string | null;
  note?: string;
}

interface WeightRow {
  source: SourceToggleKey;
  label: string;
  value: number;
  suggested: number;
}

interface SpinSpeedOption {
  id: SpinSpeedProfile;
  label: string;
}

interface SourcesPanelProps {
  presetCards: PresetCard[];
  activePreset: string;
  onApplyPreset: (presetId: string) => void;
  sourceCards: SourceCard[];
  onToggleSource: (source: SourceToggleKey) => void;
  weightedMode: boolean;
  onWeightedModeChange: (value: boolean) => void;
  cooldownSpins: number;
  onCooldownSpinsChange: (value: number) => void;
  adaptiveRecommendations: boolean;
  onAdaptiveRecommendationsChange: (value: boolean) => void;
  onApplySuggestedWeights: () => void;
  behaviorSignalsCount: number;
  spinSpeedProfile: SpinSpeedProfile;
  spinSpeedOptions: SpinSpeedOption[];
  onSpinSpeedProfileChange: (value: SpinSpeedProfile) => void;
  effectiveSpinDurationMs: number;
  reducedSpinAnimation: boolean;
  onReducedSpinAnimationChange: (value: boolean) => void;
  weightRows: WeightRow[];
  onSourceWeightChange: (source: SourceToggleKey, value: number) => void;
  loadingData: boolean;
  loadingError: string | null;
}

export function SourcesPanel({
  presetCards,
  activePreset,
  onApplyPreset,
  sourceCards,
  onToggleSource,
  weightedMode,
  onWeightedModeChange,
  cooldownSpins,
  onCooldownSpinsChange,
  adaptiveRecommendations,
  onAdaptiveRecommendationsChange,
  onApplySuggestedWeights,
  behaviorSignalsCount,
  spinSpeedProfile,
  spinSpeedOptions,
  onSpinSpeedProfileChange,
  effectiveSpinDurationMs,
  reducedSpinAnimation,
  onReducedSpinAnimationChange,
  weightRows,
  onSourceWeightChange,
  loadingData,
  loadingError,
}: SourcesPanelProps) {
  const { t } = useTranslation();

  return (
    <>
      <section className="panel" aria-labelledby="mode-presets-heading">
        <h2 id="mode-presets-heading" className="section-heading">
          <span className="heading-label">
            <SlidersHorizontal className="ui-icon" aria-hidden="true" />
            {t("presets")}
          </span>
        </h2>
        <div className="preset-grid">
          {presetCards.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`preset-card ${activePreset === preset.id ? "is-active" : ""}`}
              onClick={() => onApplyPreset(preset.id)}
            >
              <strong>{preset.label}</strong>
              <span>{preset.description}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel" aria-labelledby="sources-heading">
        <h2 id="sources-heading" className="section-heading">
          <span className="heading-label">
            <Database className="ui-icon" aria-hidden="true" />
            {t("sources")}
          </span>
          <HelpTip text={t("helpTips.sources")} />
        </h2>
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

        <div className="odds-controls">
          <label className="inline-check">
            <input type="checkbox" checked={weightedMode} onChange={(event) => onWeightedModeChange(event.target.checked)} />
            <span>{t("weightedWheel")}</span>
            <HelpTip text={t("helpTips.weightedWheel")} />
          </label>
          <label className="cooldown-control">
            <span>{t("cooldownSpins")}</span>
            <HelpTip text={t("helpTips.cooldown")} />
            <input
              type="range"
              min={0}
              max={20}
              value={cooldownSpins}
              onChange={(event) => onCooldownSpinsChange(Number(event.target.value))}
            />
            <strong>{cooldownSpins}</strong>
          </label>
        </div>

        <div className="odds-controls">
          <label className="inline-check">
            <input
              type="checkbox"
              checked={adaptiveRecommendations}
              onChange={(event) => onAdaptiveRecommendationsChange(event.target.checked)}
            />
            <span>{t("adaptiveRecommendations")}</span>
            <HelpTip text={t("helpTips.adaptive")} />
          </label>
          <button type="button" className="ghost" onClick={onApplySuggestedWeights} disabled={behaviorSignalsCount < 3}>
            <span className="button-label">
              <WandSparkles className="ui-icon" aria-hidden="true" />
              {t("applySuggestedWeights")}
            </span>
          </button>
        </div>
        <p className="muted">{t("behaviorSignalsTracked", { count: behaviorSignalsCount })}</p>

        <div className="spin-motion-grid">
          <label className="filter-field">
            <span>{t("spinSpeedProfile")}</span>
            <select value={spinSpeedProfile} onChange={(event) => onSpinSpeedProfileChange(event.target.value as SpinSpeedProfile)}>
              {spinSpeedOptions.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.label}
                </option>
              ))}
            </select>
            <small className="filter-help">{t("approxSpinTime", { seconds: (effectiveSpinDurationMs / 1000).toFixed(1) })}</small>
          </label>
          <label className="inline-check">
            <input
              type="checkbox"
              checked={reducedSpinAnimation}
              onChange={(event) => onReducedSpinAnimationChange(event.target.checked)}
            />
            <span>{t("reducedSpinAnimation")}</span>
            <HelpTip text={t("helpTips.reducedSpin")} />
          </label>
        </div>

        <div className="weights-grid">
          <p className="muted">
            {t("perSourceMultipliers")}
            <HelpTip text={t("helpTips.perSourceMultipliers")} />
          </p>
          {weightRows.map((weight) => (
            <label key={weight.source} className="weight-row">
              <span>{weight.label}</span>
              <input
                type="range"
                min={0.1}
                max={3}
                step={0.1}
                disabled={!weightedMode}
                value={weight.value}
                onChange={(event) => onSourceWeightChange(weight.source, Number(event.target.value))}
              />
              <strong>{weight.value.toFixed(1)}x</strong>
            </label>
          ))}
        </div>

        <div className="weights-grid">
          <p className="muted">
            {t("suggestedMultipliers")}
            <HelpTip text={t("helpTips.suggestedMultipliers")} />
          </p>
          {weightRows.map((weight) => (
            <div key={`suggested-${weight.source}`} className="weight-row suggested-row" aria-live="polite">
              <span>{weight.label}</span>
              <div className="suggested-bar" aria-hidden="true" />
              <strong>{weight.suggested.toFixed(1)}x</strong>
            </div>
          ))}
        </div>

        {loadingData ? (
          <p className="status" role="status" aria-live="polite">
            {t("loadingData")}
          </p>
        ) : null}
        {loadingError ? (
          <p className="status error" role="alert">
            {loadingError}
          </p>
        ) : null}
      </section>
    </>
  );
}
