import { ManualGamesPanel } from "../../components/ManualGamesPanel";
import { SpinHistoryPanel } from "../../components/SpinHistoryPanel";
import { useTranslation } from "react-i18next";
import { PlayPanel } from "../play/PlayPanel";
import { SettingsGuidancePanel } from "./SettingsGuidancePanel";
import type { SourceId } from "../../types";

interface WinnerMeta {
  sources: SourceId[];
  odds: number;
}

interface HistoryDisplayItem {
  key: string;
  name: string;
  meta: string;
  odds: string;
}

export interface MainContentPanelsProps {
  showPlayPane: boolean;
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
  winnerMeta: WinnerMeta | null;
  formatSourceList: (sources: SourceId[]) => string;
  formatOdds: (odds: number) => string;
  onMarkPlayed: () => void;
  onMarkCompleted: () => void;
  onOpenLibrary: () => void;
  onOpenSettings: () => void;
  showLibraryPane: boolean;
  manualInput: string;
  onManualInputChange: (value: string) => void;
  onAddManual: () => void;
  onClearManual: () => void;
  showHistoryPane: boolean;
  historyDisplayItems: HistoryDisplayItem[];
  showSettingsGuidance: boolean;
}

export function MainContentPanels({
  showPlayPane,
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
  showLibraryPane,
  manualInput,
  onManualInputChange,
  onAddManual,
  onClearManual,
  showHistoryPane,
  historyDisplayItems,
  showSettingsGuidance,
}: MainContentPanelsProps) {
  const { t } = useTranslation();

  return (
    <>
      {showPlayPane ? (
        <PlayPanel
          activePoolCount={activePoolCount}
          activePresetLabel={activePresetLabel}
          enabledSourceLabels={enabledSourceLabels}
          weightedMode={weightedMode}
          cooldownSpins={cooldownSpins}
          exclusionSummarySuffix={exclusionSummarySuffix}
          cooldownExcludedSuffix={cooldownExcludedSuffix}
          advancedFilterExhausted={advancedFilterExhausted}
          statusExhausted={statusExhausted}
          cooldownSaturated={cooldownSaturated}
          games={games}
          rotation={rotation}
          spinning={spinning}
          spinDurationMs={spinDurationMs}
          onSpinEnd={onSpinEnd}
          onSpin={onSpin}
          onClearHistory={onClearHistory}
          winner={winner}
          winnerMeta={winnerMeta}
          formatSourceList={formatSourceList}
          formatOdds={formatOdds}
          onMarkPlayed={onMarkPlayed}
          onMarkCompleted={onMarkCompleted}
          onOpenLibrary={onOpenLibrary}
          onOpenSettings={onOpenSettings}
        />
      ) : null}

      {showLibraryPane ? (
        <ManualGamesPanel
          title={t("manualListTitle")}
          description={t("manualListDescription")}
          inputValue={manualInput}
          onInputChange={onManualInputChange}
          onAdd={onAddManual}
          onClear={onClearManual}
          addLabel={t("addGames")}
          clearLabel={t("clearManual")}
          placeholder={t("manualListPlaceholder")}
        />
      ) : null}

      {showHistoryPane ? <SpinHistoryPanel title={t("spinHistoryTitle")} emptyLabel={t("noSpins")} items={historyDisplayItems} /> : null}

      {showSettingsGuidance ? <SettingsGuidancePanel /> : null}
    </>
  );
}
