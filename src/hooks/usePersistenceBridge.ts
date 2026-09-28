import { useMemo } from "react";
import type {
  AccountProfilePreset,
  AdvancedFilters,
  CloudRestorePoint,
  EnabledSources,
  SourceWeights,
  SpinHistoryItem,
  SpinSpeedProfile,
  StoredCloudSync,
  StoredExclusions,
  StoredNotificationSettings,
  StoredSettings,
  StoredSteamImport,
  ThemeMode,
} from "../lib/appConfig";
import type { GameEntry } from "../types";
import { useAppPersistence } from "./useAppPersistence";

interface UsePersistenceBridgeInput {
  enabledSources: EnabledSources;
  sourceWeights: SourceWeights;
  weightedMode: boolean;
  adaptiveRecommendations: boolean;
  cooldownSpins: number;
  spinSpeedProfile: SpinSpeedProfile;
  reducedSpinAnimation: boolean;
  activePreset: string;
  filters: AdvancedFilters;
  spinHistory: SpinHistoryItem[];
  manualGames: string[];
  steamId: string;
  steamImportGames: GameEntry[];
  excludePlayed: boolean;
  excludeCompleted: boolean;
  playedGames: string[];
  completedGames: string[];
  notificationsEnabled: boolean;
  trendNotifications: boolean;
  reminderNotifications: boolean;
  reminderIntervalMinutes: number;
  cloudProvider: StoredCloudSync["provider"];
  gistId: string;
  accountProfiles: AccountProfilePreset[];
  activeAccountProfileId: string;
  cloudRestorePoints: CloudRestorePoint[];
  cloudSyncReferenceAt: string;
  themeMode: ThemeMode;
}

export const usePersistenceBridge = ({
  enabledSources,
  sourceWeights,
  weightedMode,
  adaptiveRecommendations,
  cooldownSpins,
  spinSpeedProfile,
  reducedSpinAnimation,
  activePreset,
  filters,
  spinHistory,
  manualGames,
  steamId,
  steamImportGames,
  excludePlayed,
  excludeCompleted,
  playedGames,
  completedGames,
  notificationsEnabled,
  trendNotifications,
  reminderNotifications,
  reminderIntervalMinutes,
  cloudProvider,
  gistId,
  accountProfiles,
  activeAccountProfileId,
  cloudRestorePoints,
  cloudSyncReferenceAt,
  themeMode,
}: UsePersistenceBridgeInput) => {
  const persistedSettings = useMemo<StoredSettings>(
    () => ({
      enabledSources,
      sourceWeights,
      weightedMode,
      adaptiveRecommendations,
      cooldownSpins,
      spinSpeedProfile,
      reducedSpinAnimation,
      activePreset,
      filters,
    }),
    [
      activePreset,
      adaptiveRecommendations,
      cooldownSpins,
      enabledSources,
      filters,
      reducedSpinAnimation,
      sourceWeights,
      spinSpeedProfile,
      weightedMode,
    ],
  );
  const persistedSteamImport = useMemo<Pick<StoredSteamImport, "steamId" | "steamImportGames">>(
    () => ({
      steamId,
      steamImportGames,
    }),
    [steamId, steamImportGames],
  );
  const persistedExclusions = useMemo<StoredExclusions>(
    () => ({
      excludePlayed,
      excludeCompleted,
      playedGames,
      completedGames,
    }),
    [completedGames, excludeCompleted, excludePlayed, playedGames],
  );
  const persistedNotifications = useMemo<StoredNotificationSettings>(
    () => ({
      notificationsEnabled,
      trendNotifications,
      reminderNotifications,
      reminderIntervalMinutes,
    }),
    [notificationsEnabled, reminderIntervalMinutes, reminderNotifications, trendNotifications],
  );
  const persistedCloudSync = useMemo<Pick<StoredCloudSync, "provider" | "gistId">>(
    () => ({
      provider: cloudProvider,
      gistId,
    }),
    [cloudProvider, gistId],
  );

  useAppPersistence({
    settings: persistedSettings,
    spinHistory,
    manualGames,
    steamImport: persistedSteamImport,
    exclusions: persistedExclusions,
    notifications: persistedNotifications,
    cloudSync: persistedCloudSync,
    accountProfiles,
    activeAccountProfileId,
    cloudRestorePoints,
    cloudSyncReferenceAt,
    themeMode,
  });
};
