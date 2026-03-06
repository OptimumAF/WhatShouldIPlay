import { useMemo } from "react";

interface SpinHistoryEntry<TSource extends string> {
  name: string;
  spunAt: string;
  sources: TSource[];
  odds: number;
}

interface HistoryDisplayItem {
  key: string;
  name: string;
  meta: string;
  odds: string;
}

interface UseWorkspaceLayoutInput<TSource extends string, TTab extends string> {
  activeTab: TTab;
  settingsTabValue: TTab;
  playTabValue: TTab;
  libraryTabValue: TTab;
  historyTabValue: TTab;
  isMobileLayout: boolean;
  sidebarOpen: boolean;
  spinHistory: SpinHistoryEntry<TSource>[];
  sourceLabelList: (sources: TSource[]) => string;
  formatOdds: (odds: number) => string;
}

export const useWorkspaceLayout = <TSource extends string, TTab extends string>({
  activeTab,
  settingsTabValue,
  playTabValue,
  libraryTabValue,
  historyTabValue,
  isMobileLayout,
  sidebarOpen,
  spinHistory,
  sourceLabelList,
  formatOdds,
}: UseWorkspaceLayoutInput<TSource, TTab>) => {
  const showSettingsPane = isMobileLayout ? sidebarOpen : sidebarOpen || activeTab === settingsTabValue;
  const showPlayPane = activeTab === playTabValue;
  const showLibraryPane = activeTab === libraryTabValue;
  const showHistoryPane = activeTab === historyTabValue;
  const settingsSidebarVisible = showSettingsPane;
  const settingsSheetMode = isMobileLayout && settingsSidebarVisible;
  const settingsTabActive = activeTab === settingsTabValue || settingsSheetMode;

  const historyDisplayItems = useMemo<HistoryDisplayItem[]>(
    () =>
      spinHistory.slice(0, 10).map((item, index) => ({
        key: `${item.name}-${item.spunAt}-${index}`,
        name: item.name,
        meta: `${new Date(item.spunAt).toLocaleString()} | ${sourceLabelList(item.sources)}`,
        odds: formatOdds(item.odds),
      })),
    [formatOdds, sourceLabelList, spinHistory],
  );

  return {
    showSettingsPane,
    showPlayPane,
    showLibraryPane,
    showHistoryPane,
    settingsSidebarVisible,
    settingsSheetMode,
    settingsTabActive,
    historyDisplayItems,
  };
};
