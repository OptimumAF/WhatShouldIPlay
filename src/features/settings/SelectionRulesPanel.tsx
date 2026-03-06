import { SlidersHorizontal, WandSparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { HelpTip } from "../../components/HelpTip";

type SourceToggleKey = "steamcharts" | "steamdb" | "twitchmetrics" | "itchio" | "manual" | "steamImport";
type SpinSpeedProfile = "cinematic" | "balanced" | "rapid";

interface PresetCard {
  id: string;
  label: string;
  description: string;
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

interface SelectionRulesPanelProps {
  presetCards: PresetCard[];
  activePreset: string;
  onApplyPreset: (presetId: string) => void;
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

export function SelectionRulesPanel({
  presetCards,
  activePreset,
  onApplyPreset,
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
}: SelectionRulesPanelProps) {
  const { t } = useTranslation();

  return (
    <>
      <section className="panel" aria-labelledby="mode-presets-heading">
        <h2 id="mode-presets-heading" className="section-heading">
          <span className="heading-label">
            <SlidersHorizontal className="ui-icon" aria-hidden="true" />
            {t("settingsSection.rules.title")}
          </span>
          <HelpTip text={t("helpTips.weightedWheel")} />
        </h2>
        <p className="muted">{t("settingsSection.rules.description")}</p>
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
      </section>

      <section className="panel" aria-labelledby="weights-heading">
        <h2 id="weights-heading" className="section-heading">
          <span className="heading-label">
            <WandSparkles className="ui-icon" aria-hidden="true" />
            {t("perSourceMultipliers")}
          </span>
          <HelpTip text={t("helpTips.perSourceMultipliers")} />
        </h2>
        <p className="muted">{t("settingsSection.rules.weightsDescription")}</p>

        <div className="weights-grid">
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
