import { useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { useTranslation } from "react-i18next";
import { normalizeGames } from "./lib/wheel";
import { formatOdds } from "./lib/appUtils";
import { fetchTopGames, steamOwnedSchema } from "./lib/appSchemas";
import {
  defaultFilters,
  modePresets,
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
  type LengthFilter,
  type PlatformFilter,
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
import { ONBOARDING_STORAGE_KEY } from "./lib/storageKeys";
import type { SourceId } from "./types";


export default function App() {
  const { t } = useTranslation();
  const {
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
  } = useAppState();
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
