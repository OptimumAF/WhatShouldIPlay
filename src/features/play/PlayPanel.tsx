import { useTranslation } from "react-i18next";
import { Download, Eraser, Gamepad2, RotateCw, Settings2, SquareLibrary } from "lucide-react";
import { Wheel } from "../../components/Wheel";
import { WinnerSummaryCard } from "../../components/WinnerSummaryCard";
import type { SourceId } from "../../types";

const DESKTOP_RELEASES_URL = "https://github.com/OptimumAF/WhatShouldIPlay/releases/latest";

interface PlayWinnerMeta {
  sources: SourceId[];
  odds: number;
}

interface PlayPanelProps {
  activePoolCount: number;
  activePresetLabel: string;
  enabledSourceLabels: string[];
  weightedMode: boolean;
  cooldownSpins: number;
  exclusionSummarySuffix: string;
  cooldownExcludedSuffix: string;
  advancedFilterExhausted: boolean;
  statusExhausted: boolean;
  cooldownSaturated: boolean;
  games: string[];
  rotation: number;
  spinning: boolean;
  spinDurationMs: number;
  onSpinEnd: () => void;
  onSpin: () => void;
  onClearHistory: () => void;
  winner: string;
  winnerMeta: PlayWinnerMeta | null;
  formatSourceList: (sources: SourceId[]) => string;
  formatOdds: (odds: number) => string;
  onMarkPlayed: () => void;
  onMarkCompleted: () => void;
  onOpenLibrary: () => void;
  onOpenSettings: () => void;
}

export function PlayPanel({
  activePoolCount,
  activePresetLabel,
  enabledSourceLabels,
  weightedMode,
  cooldownSpins,
  exclusionSummarySuffix,
  cooldownExcludedSuffix,
  advancedFilterExhausted,
  statusExhausted,
  cooldownSaturated,
  games,
  rotation,
  spinning,
  spinDurationMs,
  onSpinEnd,
  onSpin,
  onClearHistory,
  winner,
  winnerMeta,
  formatSourceList,
  formatOdds,
  onMarkPlayed,
  onMarkCompleted,
  onOpenLibrary,
  onOpenSettings,
}: PlayPanelProps) {
  const { t } = useTranslation();

  return (
    <section className="panel play-stage" aria-labelledby="wheel-heading">
      <h2 id="wheel-heading" className="section-heading">
        <span className="heading-label">
          <Gamepad2 className="ui-icon" aria-hidden="true" />
          {t("wheelTitle")}
        </span>
      </h2>
      <p className="muted">
        {t("poolSummary", {
          count: activePoolCount,
          statusExcluded: exclusionSummarySuffix,
          cooldownExcluded: cooldownExcludedSuffix,
        })}
      </p>
      <div className="setup-summary-strip" aria-label={t("setupSummaryTitle")}>
        <div className="setup-summary-item">
          <span>{t("setupPreset")}</span>
          <strong>{activePresetLabel}</strong>
        </div>
        <div className="setup-summary-item">
          <span>{t("setupSources")}</span>
          <strong>{enabledSourceLabels.join(" + ") || t("none")}</strong>
        </div>
        <div className="setup-summary-item">
          <span>{t("setupOddsMode")}</span>
          <strong>{weightedMode ? t("weightedWheel") : t("equalOdds")}</strong>
        </div>
        <div className="setup-summary-item">
          <span>{t("setupCooldown")}</span>
          <strong>{cooldownSpins}</strong>
        </div>
      </div>
      {advancedFilterExhausted ? <p className="status">{t("advancedFilterExhausted")}</p> : null}
      {statusExhausted ? <p className="status">{t("statusExhausted")}</p> : null}
      {cooldownSaturated ? <p className="status">{t("cooldownExhausted")}</p> : null}
      {activePoolCount === 0 ? (
        <section className="import-empty-state" aria-label={t("importFirst.title")}>
          <div className="import-empty-state-copy">
            <p className="kicker">{t("quickStart")}</p>
            <h3>{t("importFirst.title")}</h3>
            <p className="muted">{t("importFirst.description")}</p>
          </div>
          <div className="import-empty-grid">
            <button type="button" className="ghost import-empty-card" onClick={onOpenLibrary}>
              <SquareLibrary className="ui-icon" aria-hidden="true" />
              <strong>{t("importFirst.manualTitle")}</strong>
              <span>{t("importFirst.manualDescription")}</span>
            </button>
            <button type="button" className="ghost import-empty-card" onClick={onOpenSettings}>
              <Settings2 className="ui-icon" aria-hidden="true" />
              <strong>{t("importFirst.steamTitle")}</strong>
              <span>{t("importFirst.steamDescription")}</span>
            </button>
            <a className="ghost import-empty-card import-empty-link" href={DESKTOP_RELEASES_URL} target="_blank" rel="noreferrer">
              <Download className="ui-icon" aria-hidden="true" />
              <strong>{t("importFirst.desktopTitle")}</strong>
              <span>{t("importFirst.desktopDescription")}</span>
            </a>
          </div>
        </section>
      ) : null}
      <Wheel
        games={games}
        rotation={rotation}
        spinning={spinning}
        spinDurationMs={spinDurationMs}
        onSpinEnd={onSpinEnd}
      />
      <div className="button-row play-stage-actions">
        <button type="button" onClick={onSpin} disabled={spinning || activePoolCount === 0}>
          <span className="button-label">
            <RotateCw className="ui-icon" aria-hidden="true" />
            {spinning ? t("spinning") : t("spinTheWheel")}
          </span>
        </button>
        <button type="button" className="ghost" onClick={onClearHistory}>
          <span className="button-label">
            <Eraser className="ui-icon" aria-hidden="true" />
            {t("clearHistory")}
          </span>
        </button>
      </div>
      {winner && winnerMeta ? (
        <WinnerSummaryCard
          prompt={t("youShouldPlay")}
          winner={winner}
          sourceLabel={t("sourceLabel")}
          sourceValue={formatSourceList(winnerMeta.sources)}
          oddsLabel={t("spinOdds")}
          oddsValue={formatOdds(winnerMeta.odds)}
          playedLabel={t("winnerActions.played")}
          completedLabel={t("winnerActions.completed")}
          onMarkPlayed={onMarkPlayed}
          onMarkCompleted={onMarkCompleted}
        />
      ) : null}
    </section>
  );
}
