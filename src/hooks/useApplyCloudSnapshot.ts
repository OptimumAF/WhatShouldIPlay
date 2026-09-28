import { useCallback } from "react";
import { sanitizeManualRecords, type ManualGameRecord } from "../lib/manualIdentity";
import type { GameStatusRecord } from "../lib/appConfig";
import type { SourceId } from "../types";

interface SnapshotSpinHistoryEntry {
  sources: SourceId[];
  [key: string]: unknown;
}

interface SnapshotLike {
  exportedAt?: string;
  settings?: unknown;
  spinHistory?: SnapshotSpinHistoryEntry[];
  manualGames?: string[];
  manualRecords?: ManualGameRecord[];
  steamImport?: unknown;
  exclusions?: unknown;
  notifications?: unknown;
  profiles?: {
    activeProfileId?: string;
    items?: unknown[];
  };
}

interface SafeParseSuccess {
  success: true;
  data: SnapshotLike;
}

interface SafeParseFailure {
  success: false;
}

interface SteamImportShape<TGameEntry> {
  steamApiKey: string;
  steamId: string;
  steamImportGames: TGameEntry[];
}

interface ExclusionsShape {
  excludePlayed: boolean;
  excludeCompleted: boolean;
  playedGames: string[];
  completedGames: string[];
  playedRecords: GameStatusRecord[];
  completedRecords: GameStatusRecord[];
}

interface NotificationsShape {
  notificationsEnabled: boolean;
  trendNotifications: boolean;
  reminderNotifications: boolean;
  reminderIntervalMinutes: number;
}

interface ProfileShape {
  id: string;
}

interface UseApplyCloudSnapshotInput<
  TSettings,
  TSpinHistory,
  TGameEntry,
  TSteamImport extends SteamImportShape<TGameEntry>,
  TExclusions extends ExclusionsShape,
  TNotifications extends NotificationsShape,
  TProfile extends ProfileShape,
> {
  safeParseSnapshot: (raw: unknown) => SafeParseSuccess | SafeParseFailure;
  invalidSnapshotMessage: string;
  sanitizeSettings: (raw: unknown) => TSettings;
  applyStoredSettings: (settings: TSettings) => void;
  mapSpinHistory: (entries: SnapshotSpinHistoryEntry[], records: ManualGameRecord[]) => TSpinHistory[];
  setSpinHistory: (entries: TSpinHistory[]) => void;
  normalizeManualGames: (entries: string[]) => string[];
  manualRecords: ManualGameRecord[];
  setManualRecords: (entries: ManualGameRecord[]) => void;
  sanitizeSteamImport: (raw: unknown) => TSteamImport;
  setSteamId: (value: string) => void;
  setSteamImportGames: (entries: TGameEntry[]) => void;
  sanitizeExclusions: (raw: unknown) => TExclusions;
  migrateExclusions: (exclusions: TExclusions, records: ManualGameRecord[], raw: unknown) => TExclusions;
  setExcludePlayed: (value: boolean) => void;
  setExcludeCompleted: (value: boolean) => void;
  setPlayedGames: (entries: string[]) => void;
  setCompletedGames: (entries: string[]) => void;
  setPlayedRecords: (entries: GameStatusRecord[]) => void;
  setCompletedRecords: (entries: GameStatusRecord[]) => void;
  sanitizeNotifications: (raw: unknown) => TNotifications;
  setNotificationsEnabled: (value: boolean) => void;
  setTrendNotifications: (value: boolean) => void;
  setReminderNotifications: (value: boolean) => void;
  setReminderIntervalMinutes: (value: number) => void;
  sanitizeAccountProfiles: (raw: unknown) => TProfile[];
  setAccountProfiles: (profiles: TProfile[]) => void;
  setActiveAccountProfileId: (value: string) => void;
  setCloudSyncReferenceAt: (value: string) => void;
  clearPendingCloudConflict: () => void;
}

export const useApplyCloudSnapshot = <
  TSettings,
  TSpinHistory,
  TGameEntry,
  TSteamImport extends SteamImportShape<TGameEntry>,
  TExclusions extends ExclusionsShape,
  TNotifications extends NotificationsShape,
  TProfile extends ProfileShape,
>({
  safeParseSnapshot,
  invalidSnapshotMessage,
  sanitizeSettings,
  applyStoredSettings,
  mapSpinHistory,
  setSpinHistory,
  normalizeManualGames,
  manualRecords,
  setManualRecords,
  sanitizeSteamImport,
  setSteamId,
  setSteamImportGames,
  sanitizeExclusions,
  migrateExclusions,
  setExcludePlayed,
  setExcludeCompleted,
  setPlayedGames,
  setCompletedGames,
  setPlayedRecords,
  setCompletedRecords,
  sanitizeNotifications,
  setNotificationsEnabled,
  setTrendNotifications,
  setReminderNotifications,
  setReminderIntervalMinutes,
  sanitizeAccountProfiles,
  setAccountProfiles,
  setActiveAccountProfileId,
  setCloudSyncReferenceAt,
  clearPendingCloudConflict,
}: UseApplyCloudSnapshotInput<
  TSettings,
  TSpinHistory,
  TGameEntry,
  TSteamImport,
  TExclusions,
  TNotifications,
  TProfile
>) => {
  const applyCloudSnapshot = useCallback(
    (rawSnapshot: unknown, options?: { updateReference?: boolean }) => {
      const parsed = safeParseSnapshot(rawSnapshot);
      if (!parsed.success) {
        throw new Error(invalidSnapshotMessage);
      }
      const snapshot = parsed.data;
      const incomingManualRecords = snapshot.manualRecords || snapshot.manualGames
        ? sanitizeManualRecords(snapshot.manualRecords ?? null, normalizeManualGames(snapshot.manualGames ?? []))
        : manualRecords;

      if (snapshot.settings) {
        applyStoredSettings(sanitizeSettings(snapshot.settings));
      }

      if (snapshot.spinHistory) {
        setSpinHistory(mapSpinHistory(snapshot.spinHistory, incomingManualRecords).slice(0, 50));
      }

      if (snapshot.manualRecords || snapshot.manualGames) setManualRecords(incomingManualRecords);

      if (snapshot.steamImport) {
        const sanitized = sanitizeSteamImport(snapshot.steamImport);
        setSteamId(sanitized.steamId);
        setSteamImportGames(sanitized.steamImportGames);
      }

      if (snapshot.exclusions) {
        const sanitized = migrateExclusions(sanitizeExclusions(snapshot.exclusions), incomingManualRecords, snapshot.exclusions);
        setExcludePlayed(sanitized.excludePlayed);
        setExcludeCompleted(sanitized.excludeCompleted);
        setPlayedGames(sanitized.playedGames);
        setCompletedGames(sanitized.completedGames);
        setPlayedRecords(sanitized.playedRecords);
        setCompletedRecords(sanitized.completedRecords);
      }

      if (snapshot.notifications) {
        const sanitized = sanitizeNotifications(snapshot.notifications);
        setNotificationsEnabled(sanitized.notificationsEnabled);
        setTrendNotifications(sanitized.trendNotifications);
        setReminderNotifications(sanitized.reminderNotifications);
        setReminderIntervalMinutes(sanitized.reminderIntervalMinutes);
      }

      if (snapshot.profiles?.items) {
        const incomingProfiles = sanitizeAccountProfiles(snapshot.profiles.items);
        setAccountProfiles(incomingProfiles);
        const incomingActiveId = snapshot.profiles.activeProfileId ?? "";
        const resolvedActiveId = incomingProfiles.some((profile) => profile.id === incomingActiveId)
          ? incomingActiveId
          : incomingProfiles[0]?.id ?? "";
        setActiveAccountProfileId(resolvedActiveId);
      }

      if (options?.updateReference !== false) {
        setCloudSyncReferenceAt(snapshot.exportedAt ?? new Date().toISOString());
      }

      clearPendingCloudConflict();
    },
    [
      applyStoredSettings,
      clearPendingCloudConflict,
      invalidSnapshotMessage,
      mapSpinHistory,
      manualRecords,
      migrateExclusions,
      normalizeManualGames,
      safeParseSnapshot,
      sanitizeAccountProfiles,
      sanitizeExclusions,
      sanitizeNotifications,
      sanitizeSettings,
      sanitizeSteamImport,
      setAccountProfiles,
      setActiveAccountProfileId,
      setCloudSyncReferenceAt,
      setCompletedGames,
      setExcludeCompleted,
      setExcludePlayed,
      setManualRecords,
      setNotificationsEnabled,
      setPlayedGames,
      setPlayedRecords,
      setCompletedRecords,
      setReminderIntervalMinutes,
      setReminderNotifications,
      setSpinHistory,
      setSteamId,
      setSteamImportGames,
      setTrendNotifications,
    ],
  );

  return { applyCloudSnapshot };
};
