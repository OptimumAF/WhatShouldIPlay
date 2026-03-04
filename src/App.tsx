import { useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { normalizeGames } from "./lib/wheel";
import { formatOdds } from "./lib/appUtils";
import { fetchTopGames, steamOwnedSchema } from "./lib/appSchemas";
import {
  onboardingSteps,
  sanitizeAccountProfiles,
  sanitizeExclusions,
  sanitizeFilters,
  sanitizeNotificationSettings,
  sanitizeSettings,
  sanitizeSteamImport,
  sourceLabelList,
  type AdvancedFilters,
  type EnabledSources,
  type SourceWeights,
  type SpinSpeedProfile,
} from "./lib/appConfig";
import { useStoredSettingsState } from "./hooks/useStoredSettingsState";
import { useSpinController } from "./hooks/useSpinController";
import { useLibraryActions } from "./hooks/useLibraryActions";
import { useRuntimeActions } from "./hooks/useRuntimeActions";
import { useCloudWorkspace } from "./hooks/useCloudWorkspace";
import { useFeedbackCenter } from "./hooks/useFeedbackCenter";
import { useShellLayoutEffects } from "./hooks/useShellLayoutEffects";
import { useRuntimeEffects } from "./hooks/useRuntimeEffects";
import { useModalFocusEffects } from "./hooks/useModalFocusEffects";
import { useActiveProfileSelection } from "./hooks/useActiveProfileSelection";
import { useNavigationActions } from "./hooks/useNavigationActions";
import { usePersistenceBridge } from "./hooks/usePersistenceBridge";
import { useGamePoolData } from "./hooks/useGamePoolData";
import { useUiDerivedData } from "./hooks/useUiDerivedData";
import { useAppState } from "./hooks/useAppState";
import { useSettingsInteractions } from "./hooks/useSettingsInteractions";
import {
  SW_NOTIFICATION_PREFS_MESSAGE,
  SW_SKIP_WAITING_MESSAGE,
  SW_TOP_GAMES_UPDATED_MESSAGE,
  SW_UPDATE_READY_EVENT,
} from "./lib/pwa";
import type { SettingsContentProps } from "./features/settings/SettingsContent";
import type { MainContentPanelsProps } from "./features/layout/MainContentPanels";
import { AppShellView } from "./features/layout/AppShellView";
import { ONBOARDING_STORAGE_KEY } from "./lib/storageKeys";
import type { SourceId } from "./types";

export default function App() {
  const { t } = useTranslation();
  const { initialHistory, settings, library, exclusions, notifications, cloud, runtime, layout } = useAppState();
  const {
    enabledSources, setEnabledSources, sourceWeights, setSourceWeights, weightedMode, setWeightedMode,
    adaptiveRecommendations, setAdaptiveRecommendations, cooldownSpins, setCooldownSpins, spinSpeedProfile,
    setSpinSpeedProfile, reducedSpinAnimation, setReducedSpinAnimation, activePreset, setActivePreset, filters, setFilters,
  } = settings;
  const {
    manualInput, setManualInput, manualGames, setManualGames, steamImportGames, setSteamImportGames,
    steamApiKey, setSteamApiKey, steamId, setSteamId, steamImportStatus, setSteamImportStatus, steamImportLoading,
    setSteamImportLoading,
  } = library;
  const {
    excludePlayed, setExcludePlayed, excludeCompleted, setExcludeCompleted, playedGames, setPlayedGames,
    completedGames, setCompletedGames, exclusionInput, setExclusionInput,
  } = exclusions;
  const {
    notificationsEnabled, setNotificationsEnabled, trendNotifications, setTrendNotifications, reminderNotifications,
    setReminderNotifications, reminderIntervalMinutes, setReminderIntervalMinutes, notificationStatus, setNotificationStatus,
  } = notifications;
  const {
    cloudProvider, gistId, setGistId, gistToken, setGistToken, cloudSyncStatus, setCloudSyncStatus,
    cloudSyncLoading, setCloudSyncLoading, accountProfiles, setAccountProfiles, activeAccountProfileId,
    setActiveAccountProfileId, accountProfileDraftName, setAccountProfileDraftName, cloudSyncReferenceAt,
    setCloudSyncReferenceAt, cloudRestorePoints, setCloudRestorePoints, pendingCloudConflictSnapshot,
    setPendingCloudConflictSnapshot,
  } = cloud;
  const {
    installPrompt, setInstallPrompt, swUpdateReady, setSwUpdateReady, updateInProgress, setUpdateInProgress,
    dismissedUpdate, setDismissedUpdate, freshTrendsNotice, setFreshTrendsNotice,
  } = runtime;
  const {
    sidebarOpen, setSidebarOpen, showAdvancedSettings, setShowAdvancedSettings, themeMode, setThemeMode,
    activeTab, setActiveTab, isMobileLayout, setIsMobileLayout, showOnboarding, setShowOnboarding,
    onboardingStep, setOnboardingStep,
  } = layout;
  const {
    toasts,
    screenReaderPolite,
    screenReaderAssertive,
    dismissToast,
    announceForScreenReader,
    pushToast,
  } = useFeedbackCenter();

  const {
    rotation,
    spinning,
    winner,
    winnerMeta,
    showWinnerPopup,
    winnerPulse,
    spinHistory,
    setShowWinnerPopup,
    setSpinHistory,
    spin,
    onSpinEnd,
    clearHistory,
  } = useSpinController<SourceId>({
    initialHistory,
    onWinnerResolved: (selectedWinner, meta) => {
      announceForScreenReader(
        "success",
        `Winner selected: ${selectedWinner}. Odds ${formatOdds(meta.odds)}. Sources ${sourceLabelList(meta.sources)}.`,
      );
    },
  });
  const winnerPopupCloseRef = useRef<HTMLButtonElement | null>(null);
  const winnerPopupRef = useRef<HTMLDivElement | null>(null);
  const onboardingCardRef = useRef<HTMLDivElement | null>(null);

  const topGamesQuery = useQuery({
    queryKey: ["top-games"],
    queryFn: fetchTopGames,
    staleTime: 1000 * 60 * 10,
  });

  const topGames = topGamesQuery.data;

  const {
    behaviorSignalsCount,
    suggestedSourceWeights,
    availableTags,
    activePool,
    adaptivePoolWeights,
    filterExcludedCount,
    statusExcludedCount,
    cooldownExcludedCount,
    advancedFilterExhausted,
    statusExhausted,
    cooldownSaturated,
  } = useGamePoolData({
    topGames,
    manualGames,
    steamImportGames,
    enabledSources,
    sourceWeights,
    weightedMode,
    playedGames,
    completedGames,
    spinHistory,
    adaptiveRecommendations,
    filters,
    setFilters,
    excludePlayed,
    excludeCompleted,
    cooldownSpins,
  });

  usePersistenceBridge({
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
    steamApiKey,
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
    gistToken,
    accountProfiles,
    activeAccountProfileId,
    cloudRestorePoints,
    cloudSyncReferenceAt,
    themeMode,
  });

  useActiveProfileSelection({
    accountProfiles,
    activeAccountProfileId,
    setActiveAccountProfileId,
  });

  useShellLayoutEffects({
    themeMode,
    setIsMobileLayout,
    activeTab,
    setActiveTab,
    isMobileLayout,
    showOnboarding,
    sidebarOpen,
    setSidebarOpen,
    onboardingStep,
    onboardingSteps,
  });

  useRuntimeEffects({
    t,
    pushToast,
    topGamesIsError: topGamesQuery.isError,
    topGamesError: topGamesQuery.error,
    notificationsEnabled,
    trendNotifications,
    reminderNotifications,
    reminderIntervalMinutes,
    setFreshTrendsNotice,
    setInstallPrompt,
    setSwUpdateReady,
    setDismissedUpdate,
    setUpdateInProgress,
    notificationPrefsMessageType: SW_NOTIFICATION_PREFS_MESSAGE,
    topGamesUpdatedMessageType: SW_TOP_GAMES_UPDATED_MESSAGE,
    updateReadyEventName: SW_UPDATE_READY_EVENT,
  });

  const { completeOnboarding, handleSidebarToggle, handleOpenQuickTour, handleHeaderTabChange } = useNavigationActions({
    activeTab,
    isMobileLayout,
    setShowOnboarding,
    setOnboardingStep,
    setActiveTab,
    setSidebarOpen,
    pushToast,
    t,
    onboardingStorageKey: ONBOARDING_STORAGE_KEY,
  });

  useModalFocusEffects({
    showWinnerPopup,
    winnerPopupRef,
    winnerPopupCloseRef,
    setShowWinnerPopup,
    showOnboarding,
    onboardingCardRef,
    setShowOnboarding,
  });

  const parseSteamOwnedGames = useCallback(
    (raw: unknown) => steamOwnedSchema.parse(raw).response.games ?? [],
    [],
  );

  const {
    markCustom,
    applyPreset,
    applySuggestedWeights,
    addManualGames,
    clearManualGames,
    clearSteamImport,
    markGamesPlayed,
    markGamesCompleted,
    removePlayedGame,
    removeCompletedGame,
    addExclusionFromInput,
    importSteamLibrary,
  } = useLibraryActions<EnabledSources, SourceWeights>({
    normalizeGames,
    t,
    pushToast,
    parseOwnedGames: parseSteamOwnedGames,
    suggestedSourceWeights,
    weightedMode,
    manualInput,
    steamApiKey,
    steamId,
    exclusionInput,
    completedGames,
    setActivePreset,
    setEnabledSources,
    setSourceWeights,
    setWeightedMode,
    setCooldownSpins,
    setManualInput,
    setManualGames,
    setSteamImportGames,
    setSteamImportStatus,
    setSteamImportLoading,
    setPlayedGames,
    setCompletedGames,
    setExclusionInput,
  });
  const { handleInstall, applyServiceWorkerUpdate, setNotificationsEnabledWithPermission } = useRuntimeActions({
    installPrompt,
    skipWaitingMessageType: SW_SKIP_WAITING_MESSAGE,
    clearInstallPrompt: () => setInstallPrompt(null),
    setUpdateInProgress,
    setSwUpdateReady,
    setNotificationsEnabled,
    setNotificationStatus,
    t,
  });

  const { currentSettingsSnapshot, applyStoredSettings } = useStoredSettingsState<
    EnabledSources,
    SourceWeights,
    SpinSpeedProfile,
    AdvancedFilters
  >({
    enabledSources,
    sourceWeights,
    weightedMode,
    adaptiveRecommendations,
    cooldownSpins,
    spinSpeedProfile,
    reducedSpinAnimation,
    activePreset,
    filters,
    sanitizeFilters: (value) => sanitizeFilters(value),
    setEnabledSources,
    setSourceWeights,
    setWeightedMode,
    setAdaptiveRecommendations,
    setCooldownSpins,
    setSpinSpeedProfile,
    setReducedSpinAnimation,
    setActivePreset,
    setFilters,
  });

  const {
    dismissCloudConflict,
    applyPendingCloudConflict,
    createAccountProfile,
    saveCurrentToActiveProfile,
    applyActiveAccountProfile,
    deleteActiveAccountProfile,
    pushCloudSync,
    createCloudSyncGist,
    pullCloudSync,
    cloudProfileOptions,
    cloudReferenceLabel,
    cloudConflict,
    cloudRestorePointOptions,
    onRestorePoint,
    onClearRestorePoints,
  } = useCloudWorkspace({
    t,
    pushToast,
    currentSettingsSnapshot,
    applyStoredSettings,
    spinHistory,
    setSpinHistory,
    manualGames,
    setManualGames,
    steamApiKey,
    setSteamApiKey,
    steamId,
    setSteamId,
    steamImportGames,
    setSteamImportGames,
    excludePlayed,
    setExcludePlayed,
    excludeCompleted,
    setExcludeCompleted,
    playedGames,
    setPlayedGames,
    completedGames,
    setCompletedGames,
    notificationsEnabled,
    setNotificationsEnabled,
    trendNotifications,
    setTrendNotifications,
    reminderNotifications,
    setReminderNotifications,
    reminderIntervalMinutes,
    setReminderIntervalMinutes,
    activeAccountProfileId,
    setActiveAccountProfileId,
    accountProfiles,
    setAccountProfiles,
    accountProfileDraftName,
    setAccountProfileDraftName,
    gistId,
    setGistId,
    gistToken,
    setCloudSyncStatus,
    setCloudSyncLoading,
    cloudSyncReferenceAt,
    setCloudSyncReferenceAt,
    cloudRestorePoints,
    setCloudRestorePoints,
    pendingCloudConflictSnapshot,
    setPendingCloudConflictSnapshot,
    sanitizeSettings,
    sanitizeSteamImport,
    sanitizeExclusions,
    sanitizeNotifications: sanitizeNotificationSettings,
    sanitizeAccountProfiles,
  });

  const {
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
    exclusionSummarySuffix,
    cooldownExcludedSuffix,
    effectiveSpinDurationMs,
    spinMotion,
  } = useUiDerivedData({
    t,
    activeTab,
    isMobileLayout,
    sidebarOpen,
    spinHistory,
    sourceLabelList,
    formatOdds,
    topGames,
    topGamesIsLoading: topGamesQuery.isLoading,
    topGamesIsError: topGamesQuery.isError,
    topGamesError: topGamesQuery.error,
    enabledSources,
    manualGamesCount: manualGames.length,
    steamImportGamesCount: steamImportGames.length,
    sourceWeights,
    suggestedSourceWeights,
    filterExcludedCount,
    statusExcludedCount,
    cooldownSpins,
    cooldownExcludedCount,
    spinSpeedProfile,
    reducedSpinAnimation,
  });
  const {
    onApplyPreset,
    onToggleSource,
    onWeightedModeChange,
    onCooldownSpinsChange,
    onAdaptiveRecommendationsChange,
    onSpinSpeedProfileChange,
    onReducedSpinAnimationChange,
    onSourceWeightChange,
    onPlatformChange,
    onTagChange,
    onLengthChange,
    onReleaseFromChange,
    onReleaseToChange,
    onMaxPriceChange,
    onFreeOnlyChange,
    onResetFilters,
    onAddPlayed,
    onAddCompleted,
    onClearPlayed,
    onClearCompleted,
    onNotificationsEnabledChange,
  } = useSettingsInteractions({
    applyPreset,
    markCustom,
    setEnabledSources,
    setWeightedMode,
    setCooldownSpins,
    setAdaptiveRecommendations,
    setSpinSpeedProfile,
    setReducedSpinAnimation,
    setSourceWeights,
    setFilters,
    addExclusionFromInput,
    setPlayedGames,
    setCompletedGames,
    setNotificationsEnabledWithPermission,
  });

  const handleSpin = () => {
    spin({
      activePool,
      weightedMode,
      adaptiveRecommendations,
      adaptivePoolWeights,
      spinMotion,
      fallbackDurationMs: effectiveSpinDurationMs,
    });
  };

  const settingsContentProps: SettingsContentProps = {
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
    onApplySuggestedWeights: applySuggestedWeights,
    behaviorSignalsCount,
    spinSpeedProfile,
    spinSpeedOptions,
    onSpinSpeedProfileChange,
    effectiveSpinDurationMs,
    reducedSpinAnimation,
    onReducedSpinAnimationChange,
    sourceWeightRows,
    onSourceWeightChange,
    loadingData: topGamesQuery.isLoading,
    loadingError: sourceLoadError,
    showAdvancedSettings,
    onShowAdvancedSettingsChange: setShowAdvancedSettings,
    steamApiKey,
    steamId,
    steamImportLoading,
    steamImportStatus,
    onSteamApiKeyChange: setSteamApiKey,
    onSteamIdChange: setSteamId,
    onImportSteamLibrary: importSteamLibrary,
    onClearSteamImport: clearSteamImport,
    filters,
    availableTags,
    onPlatformChange,
    onTagChange,
    onLengthChange,
    onReleaseFromChange,
    onReleaseToChange,
    onMaxPriceChange,
    onFreeOnlyChange,
    onResetFilters,
    excludePlayed,
    excludeCompleted,
    exclusionInput,
    playedGames,
    completedGames,
    onExcludePlayedChange: setExcludePlayed,
    onExcludeCompletedChange: setExcludeCompleted,
    onExclusionInputChange: setExclusionInput,
    onAddPlayed,
    onAddCompleted,
    onRemovePlayed: removePlayedGame,
    onRemoveCompleted: removeCompletedGame,
    onClearPlayed,
    onClearCompleted,
    notificationsEnabled,
    trendNotifications,
    reminderNotifications,
    reminderIntervalMinutes,
    notificationStatus,
    onNotificationsEnabledChange,
    onTrendNotificationsChange: setTrendNotifications,
    onReminderNotificationsChange: setReminderNotifications,
    onReminderIntervalChange: setReminderIntervalMinutes,
    gistToken,
    gistId,
    cloudSyncLoading,
    cloudSyncStatus,
    onGistTokenChange: setGistToken,
    onGistIdChange: setGistId,
    onCreateGistPush: createCloudSyncGist,
    onPushSync: pushCloudSync,
    onPullSync: pullCloudSync,
    activeAccountProfileId,
    accountProfiles: cloudProfileOptions,
    accountProfileDraftName,
    onActiveAccountProfileChange: setActiveAccountProfileId,
    onAccountProfileDraftNameChange: setAccountProfileDraftName,
    onCreateProfile: createAccountProfile,
    onSaveCurrentToActive: saveCurrentToActiveProfile,
    onApplyActive: applyActiveAccountProfile,
    onDeleteActive: deleteActiveAccountProfile,
    cloudReferenceLabel,
    cloudConflict,
    onKeepLocal: dismissCloudConflict,
    onApplyRemote: applyPendingCloudConflict,
    cloudRestorePointOptions,
    onRestorePoint,
    onClearRestorePoints,
  };

  const mainContentProps: MainContentPanelsProps = {
    showPlayPane,
    activePoolCount: activePool.length,
    exclusionSummarySuffix,
    cooldownExcludedSuffix,
    advancedFilterExhausted,
    statusExhausted,
    cooldownSaturated,
    games: activePool.map((candidate) => candidate.name),
    rotation,
    spinning,
    spinDurationMs: effectiveSpinDurationMs,
    onSpinEnd,
    onSpin: handleSpin,
    onClearHistory: clearHistory,
    winner,
    winnerMeta,
    formatSourceList: sourceLabelList,
    formatOdds,
    onMarkPlayed: () => markGamesPlayed([winner]),
    onMarkCompleted: () => markGamesCompleted([winner]),
    showLibraryPane,
    manualInput,
    onManualInputChange: setManualInput,
    onAddManual: addManualGames,
    onClearManual: clearManualGames,
    showHistoryPane,
    historyDisplayItems,
    showSettingsGuidance: activeTab === "settings",
  };

  const appHeaderProps = {
    sidebarOpen,
    settingsSidebarVisible,
    activeTab,
    settingsTabActive,
    themeMode,
    installAvailable: Boolean(installPrompt),
    onToggleSidebar: handleSidebarToggle,
    onOpenQuickTour: handleOpenQuickTour,
    onInstall: handleInstall,
    onThemeModeChange: setThemeMode,
    onTabChange: handleHeaderTabChange,
  };

  const updateBannerProps = {
    swUpdateReady,
    dismissedUpdate,
    updateInProgress,
    freshTrendsNotice,
    onApplyServiceWorkerUpdate: applyServiceWorkerUpdate,
    onDismissUpdate: () => setDismissedUpdate(true),
    onDismissFreshTrends: () => setFreshTrendsNotice(false),
  };

  const onboardingModalProps = {
    show: showOnboarding,
    onboardingCardRef,
    steps: onboardingSteps,
    currentStep: onboardingStep,
    onStepSelect: setOnboardingStep,
    onSkip: () => completeOnboarding("play"),
    onBack: () => setOnboardingStep((current) => current - 1),
    onNext: () => setOnboardingStep((current) => current + 1),
    onFinish: () => completeOnboarding("play"),
  };

  const winnerModalProps = {
    show: showWinnerPopup,
    winner,
    winnerMeta,
    winnerPulse,
    winnerPopupRef,
    winnerPopupCloseRef,
    formatSourceList: sourceLabelList,
    formatOdds,
    onClose: () => setShowWinnerPopup(false),
    onMarkPlayed: () => markGamesPlayed([winner]),
    onMarkCompleted: () => markGamesCompleted([winner]),
  };

  const workspaceShellProps = {
    settingsSheetMode,
    hideSettingsLabel: t("hideSettings"),
    onCloseSettings: () => setSidebarOpen(false),
    settingsSidebarVisible,
    showSettingsPane,
    activeTab,
    gameSettingsAriaLabel: t("gameSettingsAria"),
    settingsSheetTitle: t("settingsSheetTitle"),
  };

  const toastStackProps = {
    toasts,
    onDismiss: dismissToast,
  };

  return (
    <AppShellView
      skipToMainLabel={t("skipToMain")}
      appHeaderProps={appHeaderProps}
      updateBannerProps={updateBannerProps}
      workspaceShellProps={workspaceShellProps}
      settingsContentProps={settingsContentProps}
      mainContentProps={mainContentProps}
      onboardingModalProps={onboardingModalProps}
      toastStackProps={toastStackProps}
      winnerModalProps={winnerModalProps}
      screenReaderPolite={screenReaderPolite}
      screenReaderAssertive={screenReaderAssertive}
    />
  );
}
