import { useState } from "react";
import { type CloudSyncSnapshot } from "../lib/appSchemas";
import { readStorage } from "../lib/appUtils";
import {
  sanitizeAccountProfiles,
  sanitizeCloudRestorePoints,
  sanitizeCloudSync,
  sanitizeExclusions,
  sanitizeFilters,
  sanitizeNotificationSettings,
  sanitizeSettings,
  sanitizeSteamImport,
  sanitizeThemeMode,
  type AccountProfilePreset,
  type AdvancedFilters,
  type BeforeInstallPromptEvent,
  type CloudRestorePoint,
  type EnabledSources,
  type SourceWeights,
  type SpinHistoryItem,
  type SpinSpeedProfile,
  type StoredCloudSync,
  type StoredExclusions,
  type StoredNotificationSettings,
  type StoredSettings,
  type StoredSteamImport,
  type ThemeMode,
  type WorkspaceTab,
} from "../lib/appConfig";
import { normalizeGames } from "../lib/wheel";
import {
  ACTIVE_ACCOUNT_PROFILE_STORAGE_KEY,
  ACCOUNT_PROFILES_STORAGE_KEY,
  CLOUD_SYNC_REFERENCE_STORAGE_KEY,
  CLOUD_SYNC_RESTORE_POINTS_STORAGE_KEY,
  CLOUD_SYNC_STORAGE_KEY,
  EXCLUSION_STORAGE_KEY,
  HISTORY_STORAGE_KEY,
  MANUAL_GAMES_STORAGE_KEY,
  NOTIFICATION_STORAGE_KEY,
  ONBOARDING_STORAGE_KEY,
  SETTINGS_STORAGE_KEY,
  STEAM_IMPORT_STORAGE_KEY,
  THEME_STORAGE_KEY,
} from "../lib/storageKeys";
import type { GameEntry } from "../types";

export const useAppState = () => {
  const initialSettings = sanitizeSettings(readStorage<StoredSettings | null>(SETTINGS_STORAGE_KEY, null));
  const initialHistory = readStorage<SpinHistoryItem[]>(HISTORY_STORAGE_KEY, []);
  const initialManualGames = normalizeGames(readStorage<string[]>(MANUAL_GAMES_STORAGE_KEY, []));
  const initialSteamImport = sanitizeSteamImport(readStorage<StoredSteamImport | null>(STEAM_IMPORT_STORAGE_KEY, null));
  const initialExclusions = sanitizeExclusions(readStorage<StoredExclusions | null>(EXCLUSION_STORAGE_KEY, null));
  const initialNotifications = sanitizeNotificationSettings(
    readStorage<StoredNotificationSettings | null>(NOTIFICATION_STORAGE_KEY, null),
  );
  const initialCloudSync = sanitizeCloudSync(readStorage<StoredCloudSync | null>(CLOUD_SYNC_STORAGE_KEY, null));
  const initialAccountProfiles = sanitizeAccountProfiles(
    readStorage<AccountProfilePreset[] | null>(ACCOUNT_PROFILES_STORAGE_KEY, null),
  );
  const initialActiveAccountProfileId = readStorage<string | null>(ACTIVE_ACCOUNT_PROFILE_STORAGE_KEY, null) ?? "";
  const normalizedInitialActiveProfileId = initialAccountProfiles.some((profile) => profile.id === initialActiveAccountProfileId)
    ? initialActiveAccountProfileId
    : initialAccountProfiles[0]?.id ?? "";
  const initialCloudRestorePoints = sanitizeCloudRestorePoints(
    readStorage<CloudRestorePoint[] | null>(CLOUD_SYNC_RESTORE_POINTS_STORAGE_KEY, null),
  );
  const initialCloudSyncReference = readStorage<string | null>(CLOUD_SYNC_REFERENCE_STORAGE_KEY, null) ?? "";
  const initialThemeMode = sanitizeThemeMode(readStorage<ThemeMode | null>(THEME_STORAGE_KEY, null));
  const initialOnboardingDone = readStorage<boolean | null>(ONBOARDING_STORAGE_KEY, null) === true;

  const [enabledSources, setEnabledSources] = useState<EnabledSources>(initialSettings.enabledSources);
  const [sourceWeights, setSourceWeights] = useState<SourceWeights>(initialSettings.sourceWeights);
  const [weightedMode, setWeightedMode] = useState(initialSettings.weightedMode);
  const [adaptiveRecommendations, setAdaptiveRecommendations] = useState(initialSettings.adaptiveRecommendations);
  const [cooldownSpins, setCooldownSpins] = useState(initialSettings.cooldownSpins);
  const [spinSpeedProfile, setSpinSpeedProfile] = useState<SpinSpeedProfile>(initialSettings.spinSpeedProfile);
  const [reducedSpinAnimation, setReducedSpinAnimation] = useState(initialSettings.reducedSpinAnimation);
  const [activePreset, setActivePreset] = useState(initialSettings.activePreset);
  const [filters, setFilters] = useState<AdvancedFilters>(sanitizeFilters(initialSettings.filters));

  const [manualInput, setManualInput] = useState("");
  const [manualGames, setManualGames] = useState<string[]>(initialManualGames);
  const [steamImportGames, setSteamImportGames] = useState<GameEntry[]>(initialSteamImport.steamImportGames);
  const [steamApiKey, setSteamApiKey] = useState(initialSteamImport.steamApiKey);
  const [steamId, setSteamId] = useState(initialSteamImport.steamId);
  const [steamImportStatus, setSteamImportStatus] = useState<string>("");
  const [steamImportLoading, setSteamImportLoading] = useState(false);
  const [excludePlayed, setExcludePlayed] = useState(initialExclusions.excludePlayed);
  const [excludeCompleted, setExcludeCompleted] = useState(initialExclusions.excludeCompleted);
  const [playedGames, setPlayedGames] = useState<string[]>(initialExclusions.playedGames);
  const [completedGames, setCompletedGames] = useState<string[]>(initialExclusions.completedGames);
  const [exclusionInput, setExclusionInput] = useState("");
  const [notificationsEnabled, setNotificationsEnabled] = useState(initialNotifications.notificationsEnabled);
  const [trendNotifications, setTrendNotifications] = useState(initialNotifications.trendNotifications);
  const [reminderNotifications, setReminderNotifications] = useState(initialNotifications.reminderNotifications);
  const [reminderIntervalMinutes, setReminderIntervalMinutes] = useState(initialNotifications.reminderIntervalMinutes);
  const [notificationStatus, setNotificationStatus] = useState("");
  const [freshTrendsNotice, setFreshTrendsNotice] = useState(false);
  const [cloudProvider] = useState<StoredCloudSync["provider"]>(initialCloudSync.provider);
  const [gistId, setGistId] = useState(initialCloudSync.gistId);
  const [gistToken, setGistToken] = useState(initialCloudSync.gistToken);
  const [cloudSyncStatus, setCloudSyncStatus] = useState("");
  const [cloudSyncLoading, setCloudSyncLoading] = useState(false);
  const [accountProfiles, setAccountProfiles] = useState<AccountProfilePreset[]>(initialAccountProfiles);
  const [activeAccountProfileId, setActiveAccountProfileId] = useState(normalizedInitialActiveProfileId);
  const [accountProfileDraftName, setAccountProfileDraftName] = useState("");
  const [cloudSyncReferenceAt, setCloudSyncReferenceAt] = useState(initialCloudSyncReference);
  const [cloudRestorePoints, setCloudRestorePoints] = useState<CloudRestorePoint[]>(initialCloudRestorePoints);
  const [pendingCloudConflictSnapshot, setPendingCloudConflictSnapshot] = useState<CloudSyncSnapshot | null>(null);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [swUpdateReady, setSwUpdateReady] = useState(false);
  const [updateInProgress, setUpdateInProgress] = useState(false);
  const [dismissedUpdate, setDismissedUpdate] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>(initialThemeMode);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("play");
  const [isMobileLayout, setIsMobileLayout] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(!initialOnboardingDone);
  const [onboardingStep, setOnboardingStep] = useState(0);

  return {
    initialHistory,
    enabledSources,
    setEnabledSources,
    sourceWeights,
    setSourceWeights,
    weightedMode,
    setWeightedMode,
    adaptiveRecommendations,
    setAdaptiveRecommendations,
    cooldownSpins,
    setCooldownSpins,
    spinSpeedProfile,
    setSpinSpeedProfile,
    reducedSpinAnimation,
    setReducedSpinAnimation,
    activePreset,
    setActivePreset,
    filters,
    setFilters,
    manualInput,
    setManualInput,
    manualGames,
    setManualGames,
    steamImportGames,
    setSteamImportGames,
    steamApiKey,
    setSteamApiKey,
    steamId,
    setSteamId,
    steamImportStatus,
    setSteamImportStatus,
    steamImportLoading,
    setSteamImportLoading,
    excludePlayed,
    setExcludePlayed,
    excludeCompleted,
    setExcludeCompleted,
    playedGames,
    setPlayedGames,
    completedGames,
    setCompletedGames,
    exclusionInput,
    setExclusionInput,
    notificationsEnabled,
    setNotificationsEnabled,
    trendNotifications,
    setTrendNotifications,
    reminderNotifications,
    setReminderNotifications,
    reminderIntervalMinutes,
    setReminderIntervalMinutes,
    notificationStatus,
    setNotificationStatus,
    freshTrendsNotice,
    setFreshTrendsNotice,
    cloudProvider,
    gistId,
    setGistId,
    gistToken,
    setGistToken,
    cloudSyncStatus,
    setCloudSyncStatus,
    cloudSyncLoading,
    setCloudSyncLoading,
    accountProfiles,
    setAccountProfiles,
    activeAccountProfileId,
    setActiveAccountProfileId,
    accountProfileDraftName,
    setAccountProfileDraftName,
    cloudSyncReferenceAt,
    setCloudSyncReferenceAt,
    cloudRestorePoints,
    setCloudRestorePoints,
    pendingCloudConflictSnapshot,
    setPendingCloudConflictSnapshot,
    installPrompt,
    setInstallPrompt,
    swUpdateReady,
    setSwUpdateReady,
    updateInProgress,
    setUpdateInProgress,
    dismissedUpdate,
    setDismissedUpdate,
    sidebarOpen,
    setSidebarOpen,
    showAdvancedSettings,
    setShowAdvancedSettings,
    themeMode,
    setThemeMode,
    activeTab,
    setActiveTab,
    isMobileLayout,
    setIsMobileLayout,
    showOnboarding,
    setShowOnboarding,
    onboardingStep,
    setOnboardingStep,
  };
};
