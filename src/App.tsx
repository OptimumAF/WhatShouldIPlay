import { useCallback, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { useTranslation } from "react-i18next";
import { normalizeGames } from "./lib/wheel";
import { formatOdds, readStorage } from "./lib/appUtils";
import { fetchTopGames, steamOwnedSchema, type CloudSyncSnapshot } from "./lib/appSchemas";
import {
  defaultFilters,
  modePresets,
  onboardingSteps,
  sanitizeAccountProfiles,
  sanitizeCloudRestorePoints,
  sanitizeCloudSync,
  sanitizeExclusions,
  sanitizeFilters,
  sanitizeNotificationSettings,
  sanitizeSettings,
  sanitizeSteamImport,
  sanitizeThemeMode,
  sourceLabelList,
  spinSpeedProfiles,
  type AccountProfilePreset,
  type AdvancedFilters,
  type BeforeInstallPromptEvent,
  type CloudRestorePoint,
  type EnabledSources,
  type LengthFilter,
  type PlatformFilter,
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
} from "./lib/appConfig";
import { useStoredSettingsState } from "./hooks/useStoredSettingsState";
import { useSpinController } from "./hooks/useSpinController";
import { useLibraryActions } from "./hooks/useLibraryActions";
import { useRuntimeActions } from "./hooks/useRuntimeActions";
import { useWorkspaceLayout } from "./hooks/useWorkspaceLayout";
import { useCloudWorkspace } from "./hooks/useCloudWorkspace";
import { useSettingsPanelViewModels } from "./hooks/useSettingsPanelViewModels";
import { useFeedbackCenter } from "./hooks/useFeedbackCenter";
import { useShellLayoutEffects } from "./hooks/useShellLayoutEffects";
import { useRuntimeEffects } from "./hooks/useRuntimeEffects";
import { useModalFocusEffects } from "./hooks/useModalFocusEffects";
import { useActiveProfileSelection } from "./hooks/useActiveProfileSelection";
import { useNavigationActions } from "./hooks/useNavigationActions";
import { usePersistenceBridge } from "./hooks/usePersistenceBridge";
import { useGamePoolData } from "./hooks/useGamePoolData";
import {
  SW_NOTIFICATION_PREFS_MESSAGE,
  SW_SKIP_WAITING_MESSAGE,
  SW_TOP_GAMES_UPDATED_MESSAGE,
  SW_UPDATE_READY_EVENT,
} from "./lib/pwa";
import { WinnerModal } from "./features/play/WinnerModal";
import { SourcesPanel } from "./features/settings/SourcesPanel";
import { AdvancedOptionsPanel } from "./features/settings/AdvancedOptionsPanel";
import { FiltersPanel } from "./features/settings/FiltersPanel";
import { ExclusionsPanel } from "./features/settings/ExclusionsPanel";
import { NotificationsPanel } from "./features/settings/NotificationsPanel";
import { SteamImportPanel } from "./features/settings/SteamImportPanel";
import { CloudSyncPanel } from "./features/settings/CloudSyncPanel";
import { AppHeader } from "./features/layout/AppHeader";
import { UpdateBanners } from "./features/layout/UpdateBanners";
import { OnboardingModal } from "./features/layout/OnboardingModal";
import { ToastStack } from "./features/layout/ToastStack";
import { WorkspaceShell } from "./features/layout/WorkspaceShell";
import { MainContentPanels } from "./features/layout/MainContentPanels";
import {
  ACTIVE_ACCOUNT_PROFILE_STORAGE_KEY,
  CLOUD_SYNC_REFERENCE_STORAGE_KEY,
  CLOUD_SYNC_RESTORE_POINTS_STORAGE_KEY,
  EXCLUSION_STORAGE_KEY,
  HISTORY_STORAGE_KEY,
  MANUAL_GAMES_STORAGE_KEY,
  NOTIFICATION_STORAGE_KEY,
  ONBOARDING_STORAGE_KEY,
  SETTINGS_STORAGE_KEY,
  STEAM_IMPORT_STORAGE_KEY,
  THEME_STORAGE_KEY,
  ACCOUNT_PROFILES_STORAGE_KEY,
  CLOUD_SYNC_STORAGE_KEY,
} from "./lib/storageKeys";
import type { GameEntry, SourceId } from "./types";


export default function App() {
  const { t } = useTranslation();

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

  const filterExcludedSuffix = filterExcludedCount > 0 ? t("filteredSuffix", { count: filterExcludedCount }) : "";
  const statusExcludedSuffix =
    statusExcludedCount > 0 ? t("statusExcludedSuffix", { count: statusExcludedCount }) : "";
  const cooldownExcludedSuffix =
    cooldownSpins > 0 ? t("cooldownExcludedSuffix", { count: cooldownExcludedCount }) : "";
  const exclusionSummarySuffix = `${filterExcludedSuffix}${statusExcludedSuffix}`;
  const spinProfileConfig = spinSpeedProfiles[spinSpeedProfile];
  const effectiveSpinDurationMs = reducedSpinAnimation ? 760 : spinProfileConfig.durationMs;
  const spinMotion =
    reducedSpinAnimation
      ? { revolutions: 2.2, jitterRatio: 0.1 }
      : {
          revolutions: spinProfileConfig.revolutions,
          jitterRatio: spinProfileConfig.jitterRatio,
        };
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
    topGamesIsLoading: topGamesQuery.isLoading,
    topGamesIsError: topGamesQuery.isError,
    topGamesError: topGamesQuery.error,
    enabledSources,
    manualGamesCount: manualGames.length,
    steamImportGamesCount: steamImportGames.length,
    sourceWeights,
    suggestedSourceWeights,
  });
  return (
    <main className="layout">
      <a className="skip-link" href="#main-content">
        {t("skipToMain")}
      </a>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        <span key={screenReaderPolite.id}>{screenReaderPolite.text}</span>
      </div>
      <div className="sr-only" aria-live="assertive" aria-atomic="true">
        <span key={screenReaderAssertive.id}>{screenReaderAssertive.text}</span>
      </div>
      <AppHeader
        sidebarOpen={sidebarOpen}
        settingsSidebarVisible={settingsSidebarVisible}
        activeTab={activeTab}
        settingsTabActive={settingsTabActive}
        themeMode={themeMode}
        installAvailable={Boolean(installPrompt)}
        onToggleSidebar={handleSidebarToggle}
        onOpenQuickTour={handleOpenQuickTour}
        onInstall={handleInstall}
        onThemeModeChange={setThemeMode}
        onTabChange={handleHeaderTabChange}
      />

      <UpdateBanners
        swUpdateReady={swUpdateReady}
        dismissedUpdate={dismissedUpdate}
        updateInProgress={updateInProgress}
        freshTrendsNotice={freshTrendsNotice}
        onApplyServiceWorkerUpdate={applyServiceWorkerUpdate}
        onDismissUpdate={() => setDismissedUpdate(true)}
        onDismissFreshTrends={() => setFreshTrendsNotice(false)}
      />

      <WorkspaceShell
        settingsSheetMode={settingsSheetMode}
        hideSettingsLabel={t("hideSettings")}
        onCloseSettings={() => setSidebarOpen(false)}
        settingsSidebarVisible={settingsSidebarVisible}
        showSettingsPane={showSettingsPane}
        activeTab={activeTab}
        gameSettingsAriaLabel={t("gameSettingsAria")}
        settingsSheetTitle={t("settingsSheetTitle")}
        settingsContent={
          <>
            <SourcesPanel
              presetCards={presetCards}
              activePreset={activePreset}
              onApplyPreset={(presetId) => {
                const preset = modePresets.find((candidate) => candidate.id === presetId);
                if (!preset) return;
                applyPreset(preset);
              }}
              sourceCards={sourceCards}
              onToggleSource={(source) => {
                setEnabledSources((current) => ({
                  ...current,
                  [source]: !current[source],
                }));
                markCustom();
              }}
              weightedMode={weightedMode}
              onWeightedModeChange={(value) => {
                setWeightedMode(value);
                markCustom();
              }}
              cooldownSpins={cooldownSpins}
              onCooldownSpinsChange={(value) => {
                setCooldownSpins(value);
                markCustom();
              }}
              adaptiveRecommendations={adaptiveRecommendations}
              onAdaptiveRecommendationsChange={(value) => {
                setAdaptiveRecommendations(value);
                markCustom();
              }}
              onApplySuggestedWeights={applySuggestedWeights}
              behaviorSignalsCount={behaviorSignalsCount}
              spinSpeedProfile={spinSpeedProfile}
              spinSpeedOptions={spinSpeedOptions}
              onSpinSpeedProfileChange={(value) => {
                setSpinSpeedProfile(value);
                markCustom();
              }}
              effectiveSpinDurationMs={effectiveSpinDurationMs}
              reducedSpinAnimation={reducedSpinAnimation}
              onReducedSpinAnimationChange={(value) => {
                setReducedSpinAnimation(value);
                markCustom();
              }}
              weightRows={sourceWeightRows}
              onSourceWeightChange={(source, value) => {
                setSourceWeights((current) => ({
                  ...current,
                  [source]: value,
                }));
                markCustom();
              }}
              loadingData={topGamesQuery.isLoading}
              loadingError={sourceLoadError}
            />

            <AdvancedOptionsPanel
              showAdvancedSettings={showAdvancedSettings}
              onShowAdvancedSettingsChange={setShowAdvancedSettings}
            />

            <SteamImportPanel
              steamApiKey={steamApiKey}
              steamId={steamId}
              steamImportLoading={steamImportLoading}
              steamImportStatus={steamImportStatus}
              onSteamApiKeyChange={setSteamApiKey}
              onSteamIdChange={setSteamId}
              onImport={importSteamLibrary}
              onClear={clearSteamImport}
            />

            <div id="advanced-settings-stack" className={clsx("advanced-settings-stack", !showAdvancedSettings && "is-collapsed")}>
              <FiltersPanel
                filters={filters}
                availableTags={availableTags}
                onPlatformChange={(value) => {
                  setFilters((current) => ({ ...current, platform: value as PlatformFilter }));
                  markCustom();
                }}
                onTagChange={(value) => {
                  setFilters((current) => ({ ...current, tag: value }));
                  markCustom();
                }}
                onLengthChange={(value) => {
                  setFilters((current) => ({ ...current, length: value as LengthFilter }));
                  markCustom();
                }}
                onReleaseFromChange={(value) => {
                  setFilters((current) => ({ ...current, releaseFrom: value }));
                  markCustom();
                }}
                onReleaseToChange={(value) => {
                  setFilters((current) => ({ ...current, releaseTo: value }));
                  markCustom();
                }}
                onMaxPriceChange={(value) => {
                  setFilters((current) => ({ ...current, maxPriceUsd: value }));
                  markCustom();
                }}
                onFreeOnlyChange={(value) => {
                  setFilters((current) => ({ ...current, freeOnly: value }));
                  markCustom();
                }}
                onReset={() => {
                  setFilters(defaultFilters);
                  markCustom();
                }}
              />

              <ExclusionsPanel
                excludePlayed={excludePlayed}
                excludeCompleted={excludeCompleted}
                exclusionInput={exclusionInput}
                playedGames={playedGames}
                completedGames={completedGames}
                onExcludePlayedChange={setExcludePlayed}
                onExcludeCompletedChange={setExcludeCompleted}
                onExclusionInputChange={setExclusionInput}
                onAddPlayed={() => addExclusionFromInput("played")}
                onAddCompleted={() => addExclusionFromInput("completed")}
                onRemovePlayed={removePlayedGame}
                onRemoveCompleted={removeCompletedGame}
                onClearPlayed={() => setPlayedGames([])}
                onClearCompleted={() => setCompletedGames([])}
              />

              <NotificationsPanel
                notificationsEnabled={notificationsEnabled}
                trendNotifications={trendNotifications}
                reminderNotifications={reminderNotifications}
                reminderIntervalMinutes={reminderIntervalMinutes}
                notificationStatus={notificationStatus}
                onNotificationsEnabledChange={(value) => {
                  void setNotificationsEnabledWithPermission(value);
                }}
                onTrendNotificationsChange={setTrendNotifications}
                onReminderNotificationsChange={setReminderNotifications}
                onReminderIntervalChange={setReminderIntervalMinutes}
              />

              <CloudSyncPanel
                gistToken={gistToken}
                gistId={gistId}
                cloudSyncLoading={cloudSyncLoading}
                cloudSyncStatus={cloudSyncStatus}
                onGistTokenChange={setGistToken}
                onGistIdChange={setGistId}
                onCreateGistPush={createCloudSyncGist}
                onPushSync={pushCloudSync}
                onPullSync={pullCloudSync}
                activeAccountProfileId={activeAccountProfileId}
                accountProfiles={cloudProfileOptions}
                accountProfileDraftName={accountProfileDraftName}
                onActiveAccountProfileChange={setActiveAccountProfileId}
                onAccountProfileDraftNameChange={setAccountProfileDraftName}
                onCreateProfile={createAccountProfile}
                onSaveCurrentToActive={saveCurrentToActiveProfile}
                onApplyActive={applyActiveAccountProfile}
                onDeleteActive={deleteActiveAccountProfile}
                cloudReferenceLabel={cloudReferenceLabel}
                conflict={cloudConflict}
                onKeepLocal={dismissCloudConflict}
                onApplyRemote={applyPendingCloudConflict}
                restorePoints={cloudRestorePointOptions}
                onRestorePoint={onRestorePoint}
                onClearRestorePoints={onClearRestorePoints}
              />
            </div>
          </>
        }
        mainContent={
          <MainContentPanels
            showPlayPane={showPlayPane}
            activePoolCount={activePool.length}
            exclusionSummarySuffix={exclusionSummarySuffix}
            cooldownExcludedSuffix={cooldownExcludedSuffix}
            advancedFilterExhausted={advancedFilterExhausted}
            statusExhausted={statusExhausted}
            cooldownSaturated={cooldownSaturated}
            games={activePool.map((candidate) => candidate.name)}
            rotation={rotation}
            spinning={spinning}
            spinDurationMs={effectiveSpinDurationMs}
            onSpinEnd={onSpinEnd}
            onSpin={handleSpin}
            onClearHistory={clearHistory}
            winner={winner}
            winnerMeta={winnerMeta}
            formatSourceList={sourceLabelList}
            formatOdds={formatOdds}
            onMarkPlayed={() => markGamesPlayed([winner])}
            onMarkCompleted={() => markGamesCompleted([winner])}
            showLibraryPane={showLibraryPane}
            manualInput={manualInput}
            onManualInputChange={setManualInput}
            onAddManual={addManualGames}
            onClearManual={clearManualGames}
            showHistoryPane={showHistoryPane}
            historyDisplayItems={historyDisplayItems}
            showSettingsGuidance={activeTab === "settings"}
          />
        }
      />

      <OnboardingModal
        show={showOnboarding}
        onboardingCardRef={onboardingCardRef}
        steps={onboardingSteps}
        currentStep={onboardingStep}
        onStepSelect={setOnboardingStep}
        onSkip={() => completeOnboarding("play")}
        onBack={() => setOnboardingStep((current) => current - 1)}
        onNext={() => setOnboardingStep((current) => current + 1)}
        onFinish={() => completeOnboarding("play")}
      />

      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <WinnerModal
        show={showWinnerPopup}
        winner={winner}
        winnerMeta={winnerMeta}
        winnerPulse={winnerPulse}
        winnerPopupRef={winnerPopupRef}
        winnerPopupCloseRef={winnerPopupCloseRef}
        formatSourceList={sourceLabelList}
        formatOdds={formatOdds}
        onClose={() => setShowWinnerPopup(false)}
        onMarkPlayed={() => markGamesPlayed([winner])}
        onMarkCompleted={() => markGamesCompleted([winner])}
      />
    </main>
  );
}
