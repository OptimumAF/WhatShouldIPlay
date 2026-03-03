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
          placeholder={"Helldivers 2\nHades II\nMonster Hunter Wilds"}
        />
      ) : null}

      {showHistoryPane ? <SpinHistoryPanel title={t("spinHistoryTitle")} emptyLabel={t("noSpins")} items={historyDisplayItems} /> : null}

      {showSettingsGuidance ? <SettingsGuidancePanel /> : null}
    </>
  );
}
