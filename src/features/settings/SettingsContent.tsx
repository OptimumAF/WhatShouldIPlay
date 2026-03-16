import clsx from "clsx";
import { useEffect, useMemo, useRef, useState } from "react";
import { AdvancedOptionsPanel } from "./AdvancedOptionsPanel";
import { SteamImportPanel } from "./SteamImportPanel";
import { FiltersPanel } from "./FiltersPanel";
import { ExclusionsPanel } from "./ExclusionsPanel";
import { NotificationsPanel } from "./NotificationsPanel";
import { CloudSyncPanel } from "./CloudSyncPanel";
import { SourceCatalogPanel } from "./SourceCatalogPanel";
import { SelectionRulesPanel } from "./SelectionRulesPanel";
import type { AdvancedFilters, SourceToggleKey, SpinSpeedProfile } from "../../lib/appConfig";
import { useTranslation } from "react-i18next";

interface PresetCard {
  id: string;
  label: string;
  description: string;
}

interface SourceCard {
  source: SourceToggleKey;
  label: string;
  enabled: boolean;
  loadedCount: number;
  loading: boolean;
  fetchedAt: string | null;
  note?: string;
}

interface SourceWeightRow {
  source: SourceToggleKey;
  label: string;
  value: number;
  suggested: number;
}

interface SpinSpeedOption {
  id: SpinSpeedProfile;
  label: string;
}

interface CloudProfileOption {
  id: string;
  name: string;
  updatedAtLabel: string;
}

interface CloudConflictState {
  remoteLabel: string;
  localLabel: string;
}

interface CloudRestorePointOption {
  id: string;
  timestampLabel: string;
  reason: string;
}

export interface SettingsContentProps {
  presetCards: PresetCard[];
  activePreset: string;
  onApplyPreset: (presetId: string) => void;
  sourceCards: SourceCard[];
  onToggleSource: (source: SourceToggleKey) => void;
  weightedMode: boolean;
  onWeightedModeChange: (value: boolean) => void;
  cooldownSpins: number;
  onCooldownSpinsChange: (value: number) => void;
  adaptiveRecommendations: boolean;
  onAdaptiveRecommendationsChange: (value: boolean) => void;
  onApplySuggestedWeights: () => void;
  behaviorSignalsCount: number;
  spinSpeedProfile: SpinSpeedProfile;
  spinSpeedOptions: SpinSpeedOption[];
  onSpinSpeedProfileChange: (value: SpinSpeedProfile) => void;
  effectiveSpinDurationMs: number;
  reducedSpinAnimation: boolean;
  onReducedSpinAnimationChange: (value: boolean) => void;
  sourceWeightRows: SourceWeightRow[];
  onSourceWeightChange: (source: SourceToggleKey, value: number) => void;
  loadingData: boolean;
  loadingError: string | null;
  showAdvancedSettings: boolean;
  onShowAdvancedSettingsChange: (value: boolean) => void;
  steamApiKey: string;
  steamId: string;
  steamImportLoading: boolean;
  steamImportStatus: string;
  onSteamApiKeyChange: (value: string) => void;
  onSteamIdChange: (value: string) => void;
  onImportSteamLibrary: () => void;
  onClearSteamImport: () => void;
  filters: AdvancedFilters;
  availableTags: string[];
  onPlatformChange: (value: string) => void;
  onTagChange: (value: string) => void;
  onLengthChange: (value: string) => void;
  onReleaseFromChange: (value: string) => void;
  onReleaseToChange: (value: string) => void;
  onMaxPriceChange: (value: number) => void;
  onFreeOnlyChange: (value: boolean) => void;
  onResetFilters: () => void;
  excludePlayed: boolean;
  excludeCompleted: boolean;
  exclusionInput: string;
  playedGames: string[];
  completedGames: string[];
  onExcludePlayedChange: (value: boolean) => void;
  onExcludeCompletedChange: (value: boolean) => void;
  onExclusionInputChange: (value: string) => void;
  onAddPlayed: () => void;
  onAddCompleted: () => void;
  onRemovePlayed: (name: string) => void;
  onRemoveCompleted: (name: string) => void;
  onClearPlayed: () => void;
  onClearCompleted: () => void;
  notificationsEnabled: boolean;
  trendNotifications: boolean;
  reminderNotifications: boolean;
  reminderIntervalMinutes: number;
  notificationStatus: string;
  onNotificationsEnabledChange: (value: boolean) => void;
  onTrendNotificationsChange: (value: boolean) => void;
  onReminderNotificationsChange: (value: boolean) => void;
  onReminderIntervalChange: (value: number) => void;
  gistToken: string;
  gistId: string;
  cloudSyncLoading: boolean;
  cloudSyncStatus: string;
  onGistTokenChange: (value: string) => void;
  onGistIdChange: (value: string) => void;
  onCreateGistPush: () => void;
  onPushSync: () => void;
  onPullSync: () => void;
  activeAccountProfileId: string;
  accountProfiles: CloudProfileOption[];
  accountProfileDraftName: string;
  onActiveAccountProfileChange: (value: string) => void;
  onAccountProfileDraftNameChange: (value: string) => void;
  onCreateProfile: () => void;
  onSaveCurrentToActive: () => void;
  onApplyActive: () => void;
  onDeleteActive: () => void;
  cloudReferenceLabel: string;
  cloudConflict: CloudConflictState | null;
  onKeepLocal: () => void;
  onApplyRemote: () => void;
  cloudRestorePointOptions: CloudRestorePointOption[];
  onRestorePoint: (id: string) => void;
  onClearRestorePoints: () => void;
}

export function SettingsContent({
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
  onApplySuggestedWeights,
  behaviorSignalsCount,
  spinSpeedProfile,
  spinSpeedOptions,
  onSpinSpeedProfileChange,
  effectiveSpinDurationMs,
  reducedSpinAnimation,
  onReducedSpinAnimationChange,
  sourceWeightRows,
  onSourceWeightChange,
  loadingData,
  loadingError,
  showAdvancedSettings,
  onShowAdvancedSettingsChange,
  steamApiKey,
  steamId,
  steamImportLoading,
  steamImportStatus,
  onSteamApiKeyChange,
  onSteamIdChange,
  onImportSteamLibrary,
  onClearSteamImport,
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
  onExcludePlayedChange,
  onExcludeCompletedChange,
  onExclusionInputChange,
  onAddPlayed,
  onAddCompleted,
  onRemovePlayed,
  onRemoveCompleted,
  onClearPlayed,
  onClearCompleted,
  notificationsEnabled,
  trendNotifications,
  reminderNotifications,
  reminderIntervalMinutes,
  notificationStatus,
  onNotificationsEnabledChange,
  onTrendNotificationsChange,
  onReminderNotificationsChange,
  onReminderIntervalChange,
  gistToken,
  gistId,
  cloudSyncLoading,
  cloudSyncStatus,
  onGistTokenChange,
  onGistIdChange,
  onCreateGistPush,
  onPushSync,
  onPullSync,
  activeAccountProfileId,
  accountProfiles,
  accountProfileDraftName,
  onActiveAccountProfileChange,
  onAccountProfileDraftNameChange,
  onCreateProfile,
  onSaveCurrentToActive,
  onApplyActive,
  onDeleteActive,
  cloudReferenceLabel,
  cloudConflict,
  onKeepLocal,
  onApplyRemote,
  cloudRestorePointOptions,
  onRestorePoint,
  onClearRestorePoints,
}: SettingsContentProps) {
  const { t } = useTranslation();
  const [activeSection, setActiveSection] = useState<"sources" | "rules" | "advanced">("sources");
  const sectionOrder = useMemo(() => ["sources", "rules", "advanced"] as const, []);
  const previousSectionRef = useRef<typeof activeSection>(activeSection);
  const sectionDirection =
    sectionOrder.indexOf(activeSection) >= sectionOrder.indexOf(previousSectionRef.current) ? "is-forward" : "is-backward";

  useEffect(() => {
    previousSectionRef.current = activeSection;
  }, [activeSection]);

  return (
    <>
      <section className="panel settings-section-shell" aria-labelledby="settings-section-heading">
        <h2 id="settings-section-heading" className="section-heading">
          <span className="heading-label">{t("settingsSection.title")}</span>
        </h2>
        <p className="muted">{t("settingsSection.description")}</p>
        <div className="settings-section-switcher" role="tablist" aria-label={t("settingsSection.title")}>
          {(["sources", "rules", "advanced"] as const).map((section) => (
            <button
              key={section}
              type="button"
              className={clsx("ghost settings-section-trigger", activeSection === section && "is-active")}
              role="tab"
              aria-selected={activeSection === section}
              onClick={() => setActiveSection(section)}
            >
              {t(`settingsSection.${section}.title`)}
            </button>
          ))}
        </div>
      </section>

      {activeSection === "sources" ? (
        <div className={clsx("section-transition", sectionDirection)} key="sources">
          <SourceCatalogPanel sourceCards={sourceCards} onToggleSource={onToggleSource} />
          <SteamImportPanel
            steamApiKey={steamApiKey}
            steamId={steamId}
            steamImportLoading={steamImportLoading}
            steamImportStatus={steamImportStatus}
            onSteamApiKeyChange={onSteamApiKeyChange}
            onSteamIdChange={onSteamIdChange}
            onImport={onImportSteamLibrary}
            onClear={onClearSteamImport}
          />
        </div>
      ) : null}

      {activeSection === "rules" ? (
        <div className={clsx("section-transition", sectionDirection)} key="rules">
          <SelectionRulesPanel
            presetCards={presetCards}
            activePreset={activePreset}
            onApplyPreset={onApplyPreset}
            weightedMode={weightedMode}
            onWeightedModeChange={onWeightedModeChange}
            cooldownSpins={cooldownSpins}
            onCooldownSpinsChange={onCooldownSpinsChange}
            adaptiveRecommendations={adaptiveRecommendations}
            onAdaptiveRecommendationsChange={onAdaptiveRecommendationsChange}
            onApplySuggestedWeights={onApplySuggestedWeights}
            behaviorSignalsCount={behaviorSignalsCount}
            spinSpeedProfile={spinSpeedProfile}
            spinSpeedOptions={spinSpeedOptions}
            onSpinSpeedProfileChange={onSpinSpeedProfileChange}
            effectiveSpinDurationMs={effectiveSpinDurationMs}
            reducedSpinAnimation={reducedSpinAnimation}
            onReducedSpinAnimationChange={onReducedSpinAnimationChange}
            weightRows={sourceWeightRows}
            onSourceWeightChange={onSourceWeightChange}
            loadingData={loadingData}
            loadingError={loadingError}
          />
        </div>
      ) : null}

      {activeSection === "advanced" ? (
        <div className={clsx("section-transition", sectionDirection)} key="advanced">
          <AdvancedOptionsPanel
            showAdvancedSettings={showAdvancedSettings}
            onShowAdvancedSettingsChange={onShowAdvancedSettingsChange}
          />

          <div id="advanced-settings-stack" className={clsx("advanced-settings-stack", !showAdvancedSettings && "is-collapsed")}>
            <FiltersPanel
              filters={filters}
              availableTags={availableTags}
              onPlatformChange={onPlatformChange}
              onTagChange={onTagChange}
              onLengthChange={onLengthChange}
              onReleaseFromChange={onReleaseFromChange}
              onReleaseToChange={onReleaseToChange}
              onMaxPriceChange={onMaxPriceChange}
              onFreeOnlyChange={onFreeOnlyChange}
              onReset={onResetFilters}
            />

            <ExclusionsPanel
              excludePlayed={excludePlayed}
              excludeCompleted={excludeCompleted}
              exclusionInput={exclusionInput}
              playedGames={playedGames}
              completedGames={completedGames}
              onExcludePlayedChange={onExcludePlayedChange}
              onExcludeCompletedChange={onExcludeCompletedChange}
              onExclusionInputChange={onExclusionInputChange}
              onAddPlayed={onAddPlayed}
              onAddCompleted={onAddCompleted}
              onRemovePlayed={onRemovePlayed}
              onRemoveCompleted={onRemoveCompleted}
              onClearPlayed={onClearPlayed}
              onClearCompleted={onClearCompleted}
            />

            <NotificationsPanel
              notificationsEnabled={notificationsEnabled}
              trendNotifications={trendNotifications}
              reminderNotifications={reminderNotifications}
              reminderIntervalMinutes={reminderIntervalMinutes}
              notificationStatus={notificationStatus}
              onNotificationsEnabledChange={onNotificationsEnabledChange}
              onTrendNotificationsChange={onTrendNotificationsChange}
              onReminderNotificationsChange={onReminderNotificationsChange}
              onReminderIntervalChange={onReminderIntervalChange}
            />

            <CloudSyncPanel
              gistToken={gistToken}
              gistId={gistId}
              cloudSyncLoading={cloudSyncLoading}
              cloudSyncStatus={cloudSyncStatus}
              onGistTokenChange={onGistTokenChange}
              onGistIdChange={onGistIdChange}
              onCreateGistPush={onCreateGistPush}
              onPushSync={onPushSync}
              onPullSync={onPullSync}
              activeAccountProfileId={activeAccountProfileId}
              accountProfiles={accountProfiles}
              accountProfileDraftName={accountProfileDraftName}
              onActiveAccountProfileChange={onActiveAccountProfileChange}
              onAccountProfileDraftNameChange={onAccountProfileDraftNameChange}
              onCreateProfile={onCreateProfile}
              onSaveCurrentToActive={onSaveCurrentToActive}
              onApplyActive={onApplyActive}
              onDeleteActive={onDeleteActive}
              cloudReferenceLabel={cloudReferenceLabel}
              conflict={cloudConflict}
              onKeepLocal={onKeepLocal}
              onApplyRemote={onApplyRemote}
              restorePoints={cloudRestorePointOptions}
              onRestorePoint={onRestorePoint}
              onClearRestorePoints={onClearRestorePoints}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
