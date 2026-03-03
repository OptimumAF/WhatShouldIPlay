import { spinSpeedProfiles, type SourceWeights, type SpinHistoryItem, type SpinSpeedProfile, type WorkspaceTab } from "../lib/appConfig";
import { useSettingsPanelViewModels } from "./useSettingsPanelViewModels";
import { useWorkspaceLayout } from "./useWorkspaceLayout";
import type { SourceId, TopGamesPayload } from "../types";

interface UseUiDerivedDataInput {
  t: (key: string, options?: Record<string, unknown>) => string;
  activeTab: WorkspaceTab;
  isMobileLayout: boolean;
  sidebarOpen: boolean;
  spinHistory: SpinHistoryItem[];
  sourceLabelList: (sources: SourceId[]) => string;
  formatOdds: (odds: number) => string;
  topGames: TopGamesPayload | undefined;
  topGamesIsLoading: boolean;
  topGamesIsError: boolean;
  topGamesError: unknown;
  enabledSources: Record<"steamcharts" | "steamdb" | "twitchmetrics" | "itchio" | "manual" | "steamImport", boolean>;
  manualGamesCount: number;
  steamImportGamesCount: number;
  sourceWeights: SourceWeights;
  suggestedSourceWeights: SourceWeights;
  filterExcludedCount: number;
  statusExcludedCount: number;
  cooldownSpins: number;
  cooldownExcludedCount: number;
  spinSpeedProfile: SpinSpeedProfile;
  reducedSpinAnimation: boolean;
}

export const useUiDerivedData = ({
  t,
  activeTab,
  isMobileLayout,
  sidebarOpen,
  spinHistory,
  sourceLabelList,
  formatOdds,
  topGames,
  topGamesIsLoading,
  topGamesIsError,
  topGamesError,
  enabledSources,
  manualGamesCount,
  steamImportGamesCount,
  sourceWeights,
  suggestedSourceWeights,
  filterExcludedCount,
  statusExcludedCount,
  cooldownSpins,
  cooldownExcludedCount,
  spinSpeedProfile,
  reducedSpinAnimation,
}: UseUiDerivedDataInput) => {
  const {
    showSettingsPane,
    showPlayPane,
    showLibraryPane,
    showHistoryPane,
    settingsSidebarVisible,
    settingsSheetMode,
    settingsTabActive,
    historyDisplayItems,
  } = useWorkspaceLayout<SourceId, WorkspaceTab>({
    activeTab,
    settingsTabValue: "settings",
    playTabValue: "play",
    libraryTabValue: "library",
    historyTabValue: "history",
    isMobileLayout,
    sidebarOpen,
    spinHistory,
    sourceLabelList,
    formatOdds,
  });

  const { presetCards, sourceCards, sourceWeightRows, spinSpeedOptions, sourceLoadError } = useSettingsPanelViewModels({
    t,
    topGames,
    topGamesIsLoading,
    topGamesIsError,
    topGamesError,
    enabledSources,
    manualGamesCount,
    steamImportGamesCount,
    sourceWeights,
    suggestedSourceWeights,
  });

  const filterExcludedSuffix = filterExcludedCount > 0 ? t("filteredSuffix", { count: filterExcludedCount }) : "";
  const statusExcludedSuffix = statusExcludedCount > 0 ? t("statusExcludedSuffix", { count: statusExcludedCount }) : "";
  const cooldownExcludedSuffix = cooldownSpins > 0 ? t("cooldownExcludedSuffix", { count: cooldownExcludedCount }) : "";
  const exclusionSummarySuffix = `${filterExcludedSuffix}${statusExcludedSuffix}`;
  const spinProfileConfig = spinSpeedProfiles[spinSpeedProfile];
  const effectiveSpinDurationMs = reducedSpinAnimation ? 760 : spinProfileConfig.durationMs;
  const spinMotion = reducedSpinAnimation
    ? { revolutions: 2.2, jitterRatio: 0.1 }
    : {
        revolutions: spinProfileConfig.revolutions,
        jitterRatio: spinProfileConfig.jitterRatio,
      };

  return {
    showSettingsPane,
    showPlayPane,
    showLibraryPane,
    showHistoryPane,
    settingsSidebarVisible,
    settingsSheetMode,
    settingsTabActive,
    historyDisplayItems,
    presetCards,
    sourceCards,
    sourceWeightRows,
    spinSpeedOptions,
    sourceLoadError,
    filterExcludedSuffix,
    statusExcludedSuffix,
    cooldownExcludedSuffix,
    exclusionSummarySuffix,
    effectiveSpinDurationMs,
    spinMotion,
  };
};
