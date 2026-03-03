import { useCallback } from "react";
import { cloudSyncSnapshotSchema, type CloudSyncSnapshot } from "../lib/appSchemas";
import type {
  AccountProfilePreset,
  CloudRestorePoint,
  SpinHistoryItem,
  StoredExclusions,
  StoredNotificationSettings,
  StoredSettings,
  StoredSteamImport,
} from "../lib/appConfig";
import type { GameEntry, SourceId } from "../types";
import { normalizeGames } from "../lib/wheel";
import { MAX_CLOUD_RESTORE_POINTS } from "../lib/storageKeys";
import { useCloudSnapshotBuilders } from "./useCloudSnapshotBuilders";
import { useApplyCloudSnapshot } from "./useApplyCloudSnapshot";
import { useCloudProfileActions } from "./useCloudProfileActions";
import { useCloudSyncTransport } from "./useCloudSyncTransport";
import { useCloudPanelData } from "./useCloudPanelData";

type ToastTone = "info" | "success" | "error";

interface UseCloudWorkspaceInput {
  t: (key: string, options?: Record<string, unknown>) => string;
  pushToast: (tone: ToastTone, text: string) => void;
  currentSettingsSnapshot: () => StoredSettings;
  applyStoredSettings: (settings: StoredSettings) => void;
  spinHistory: SpinHistoryItem[];
  setSpinHistory: (updater: SpinHistoryItem[] | ((current: SpinHistoryItem[]) => SpinHistoryItem[])) => void;
  manualGames: string[];
  setManualGames: (entries: string[]) => void;
  steamApiKey: string;
  setSteamApiKey: (value: string) => void;
  steamId: string;
  setSteamId: (value: string) => void;
  steamImportGames: GameEntry[];
  setSteamImportGames: (entries: GameEntry[]) => void;
  excludePlayed: boolean;
  setExcludePlayed: (value: boolean) => void;
  excludeCompleted: boolean;
  setExcludeCompleted: (value: boolean) => void;
  playedGames: string[];
  setPlayedGames: (entries: string[]) => void;
  completedGames: string[];
  setCompletedGames: (entries: string[]) => void;
  notificationsEnabled: boolean;
  setNotificationsEnabled: (value: boolean) => void;
  trendNotifications: boolean;
  setTrendNotifications: (value: boolean) => void;
  reminderNotifications: boolean;
  setReminderNotifications: (value: boolean) => void;
  reminderIntervalMinutes: number;
  setReminderIntervalMinutes: (value: number) => void;
  activeAccountProfileId: string;
  setActiveAccountProfileId: (value: string) => void;
  accountProfiles: AccountProfilePreset[];
  setAccountProfiles: (
    updater: AccountProfilePreset[] | ((current: AccountProfilePreset[]) => AccountProfilePreset[]),
  ) => void;
  accountProfileDraftName: string;
  setAccountProfileDraftName: (value: string) => void;
  gistId: string;
  setGistId: (value: string) => void;
  gistToken: string;
  setCloudSyncStatus: (value: string) => void;
  setCloudSyncLoading: (value: boolean) => void;
  cloudSyncReferenceAt: string;
  setCloudSyncReferenceAt: (value: string) => void;
  cloudRestorePoints: CloudRestorePoint[];
  setCloudRestorePoints: (
    updater: CloudRestorePoint[] | ((current: CloudRestorePoint[]) => CloudRestorePoint[]),
  ) => void;
  pendingCloudConflictSnapshot: CloudSyncSnapshot | null;
  setPendingCloudConflictSnapshot: (value: CloudSyncSnapshot | null) => void;
  sanitizeSettings: (raw: StoredSettings | null) => StoredSettings;
  sanitizeSteamImport: (raw: StoredSteamImport | null) => StoredSteamImport;
  sanitizeExclusions: (raw: StoredExclusions | null) => StoredExclusions;
  sanitizeNotifications: (raw: StoredNotificationSettings | null) => StoredNotificationSettings;
  sanitizeAccountProfiles: (raw: AccountProfilePreset[] | null) => AccountProfilePreset[];
}

export const useCloudWorkspace = ({
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
  sanitizeNotifications,
  sanitizeAccountProfiles,
}: UseCloudWorkspaceInput) => {
  const applyCloudRestorePointsUpdater = useCallback(
    (updater: (current: CloudRestorePoint[]) => CloudRestorePoint[]) => {
      setCloudRestorePoints(updater);
    },
    [setCloudRestorePoints],
  );
  const setCloudRestorePointsEntries = useCallback(
    (entries: CloudRestorePoint[]) => {
      setCloudRestorePoints(entries);
    },
    [setCloudRestorePoints],
  );
  const setSpinHistoryEntries = useCallback(
    (entries: SpinHistoryItem[]) => {
      setSpinHistory(entries);
    },
    [setSpinHistory],
  );
  const setAccountProfilesEntries = useCallback(
    (entries: AccountProfilePreset[]) => {
      setAccountProfiles(entries);
    },
    [setAccountProfiles],
  );
  const applyAccountProfilesUpdater = useCallback(
    (updater: (current: AccountProfilePreset[]) => AccountProfilePreset[]) => {
      setAccountProfiles(updater);
    },
    [setAccountProfiles],
  );

  const { buildCloudSnapshot, pushCloudRestorePoint } = useCloudSnapshotBuilders<
    StoredSettings,
    GameEntry,
    SpinHistoryItem,
    CloudSyncSnapshot
  >({
    currentSettingsSnapshot,
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
    activeAccountProfileId,
    accountProfiles,
    maxCloudRestorePoints: MAX_CLOUD_RESTORE_POINTS,
    setCloudRestorePoints: applyCloudRestorePointsUpdater,
  });

  const mapSnapshotSpinHistory = useCallback(
    (entries: Array<{ sources: string[] } & Record<string, unknown>>): SpinHistoryItem[] =>
      entries.map(
        (entry) =>
          ({
            ...entry,
            sources: entry.sources as SourceId[],
          }) as SpinHistoryItem,
      ),
    [],
  );
  const safeParseCloudSnapshot = useCallback(
    (raw: unknown) => cloudSyncSnapshotSchema.safeParse(raw) as { success: true; data: CloudSyncSnapshot } | { success: false },
    [],
  );
  const clearPendingCloudConflict = useCallback(() => {
    setPendingCloudConflictSnapshot(null);
  }, [setPendingCloudConflictSnapshot]);

  const { applyCloudSnapshot } = useApplyCloudSnapshot<
    StoredSettings,
    SpinHistoryItem,
    GameEntry,
    StoredSteamImport,
    StoredExclusions,
    StoredNotificationSettings,
    AccountProfilePreset
  >({
    safeParseSnapshot: safeParseCloudSnapshot,
    invalidSnapshotMessage: t("messages.cloudSnapshotInvalid"),
    sanitizeSettings: (raw) => sanitizeSettings(raw as StoredSettings | null),
    applyStoredSettings,
    mapSpinHistory: mapSnapshotSpinHistory,
    setSpinHistory: setSpinHistoryEntries,
    normalizeManualGames: normalizeGames,
    setManualGames,
    sanitizeSteamImport: (raw) => sanitizeSteamImport(raw as StoredSteamImport | null),
    setSteamApiKey,
    setSteamId,
    setSteamImportGames,
    sanitizeExclusions: (raw) => sanitizeExclusions(raw as StoredExclusions | null),
    setExcludePlayed,
    setExcludeCompleted,
    setPlayedGames,
    setCompletedGames,
    sanitizeNotifications: (raw) => sanitizeNotifications(raw as StoredNotificationSettings | null),
    setNotificationsEnabled,
    setTrendNotifications,
    setReminderNotifications,
    setReminderIntervalMinutes,
    sanitizeAccountProfiles: (raw) => sanitizeAccountProfiles(raw as AccountProfilePreset[] | null),
    setAccountProfiles: setAccountProfilesEntries,
    setActiveAccountProfileId,
    setCloudSyncReferenceAt,
    clearPendingCloudConflict,
  });

  const {
    dismissCloudConflict,
    applyPendingCloudConflict,
    restoreFromCloudPoint,
    createAccountProfile,
    saveCurrentToActiveProfile,
    applyActiveAccountProfile,
    deleteActiveAccountProfile,
  } = useCloudProfileActions<StoredSettings, CloudSyncSnapshot>({
    t,
    pushToast,
    accountProfileDraftName,
    setAccountProfileDraftName,
    activeAccountProfileId,
    setActiveAccountProfileId,
    accountProfiles,
    setAccountProfiles: applyAccountProfilesUpdater,
    pendingCloudConflictSnapshot,
    setPendingCloudConflictSnapshot,
    setCloudSyncStatus,
    currentSettingsSnapshot,
    applyStoredSettings,
    pushCloudRestorePoint,
    applyCloudSnapshot,
  });

  const parseCloudSnapshot = useCallback((raw: unknown) => cloudSyncSnapshotSchema.parse(raw), []);

  const { pushCloudSync, createCloudSyncGist, pullCloudSync } = useCloudSyncTransport({
    gistId,
    gistToken,
    cloudSyncReferenceAt,
    t,
    pushToast,
    buildCloudSnapshot,
    parseCloudSnapshot,
    applyCloudSnapshot,
    pushCloudRestorePoint,
    setGistId,
    setCloudSyncReferenceAt,
    setPendingCloudConflictSnapshot,
    setCloudSyncStatus,
    setCloudSyncLoading,
  });

  const {
    cloudProfileOptions,
    cloudReferenceLabel,
    cloudConflict,
    cloudRestorePointOptions,
    onRestorePoint,
    onClearRestorePoints,
  } = useCloudPanelData<AccountProfilePreset, CloudSyncSnapshot, CloudRestorePoint>({
    accountProfiles,
    cloudSyncReferenceAt,
    pendingCloudConflictSnapshot,
    cloudRestorePoints,
    restoreFromCloudPoint,
    setCloudRestorePoints: setCloudRestorePointsEntries,
    t,
    pushToast,
  });

  return {
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
  };
};
