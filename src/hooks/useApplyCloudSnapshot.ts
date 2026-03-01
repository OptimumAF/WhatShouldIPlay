import { useCallback } from "react";

interface SnapshotSpinHistoryEntry {
  sources: string[];
  [key: string]: unknown;
}

interface SnapshotLike {
  exportedAt?: string;
  settings?: unknown;
  spinHistory?: SnapshotSpinHistoryEntry[];
  manualGames?: string[];
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
  mapSpinHistory: (entries: SnapshotSpinHistoryEntry[]) => TSpinHistory[];
  setSpinHistory: (entries: TSpinHistory[]) => void;
  normalizeManualGames: (entries: string[]) => string[];
  setManualGames: (entries: string[]) => void;
  sanitizeSteamImport: (raw: unknown) => TSteamImport;
  setSteamApiKey: (value: string) => void;
  setSteamId: (value: string) => void;
  setSteamImportGames: (entries: TGameEntry[]) => void;
  sanitizeExclusions: (raw: unknown) => TExclusions;
  setExcludePlayed: (value: boolean) => void;
  setExcludeCompleted: (value: boolean) => void;
  setPlayedGames: (entries: string[]) => void;
  setCompletedGames: (entries: string[]) => void;
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
  setManualGames,
  sanitizeSteamImport,
  setSteamApiKey,
  setSteamId,
  setSteamImportGames,
  sanitizeExclusions,
  setExcludePlayed,
  setExcludeCompleted,
  setPlayedGames,
  setCompletedGames,
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

      if (snapshot.settings) {
        applyStoredSettings(sanitizeSettings(snapshot.settings));
      }

      if (snapshot.spinHistory) {
        setSpinHistory(mapSpinHistory(snapshot.spinHistory).slice(0, 50));
      }

      if (snapshot.manualGames) {
        setManualGames(normalizeManualGames(snapshot.manualGames));
      }

      if (snapshot.steamImport) {
        const sanitized = sanitizeSteamImport(snapshot.steamImport);
        setSteamApiKey(sanitized.steamApiKey);
        setSteamId(sanitized.steamId);
        setSteamImportGames(sanitized.steamImportGames);
      }

      if (snapshot.exclusions) {
        const sanitized = sanitizeExclusions(snapshot.exclusions);
        setExcludePlayed(sanitized.excludePlayed);
        setExcludeCompleted(sanitized.excludeCompleted);
        setPlayedGames(sanitized.playedGames);
        setCompletedGames(sanitized.completedGames);
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
      setManualGames,
      setNotificationsEnabled,
      setPlayedGames,
      setReminderIntervalMinutes,
      setReminderNotifications,
      setSpinHistory,
      setSteamApiKey,
      setSteamId,
      setSteamImportGames,
      setTrendNotifications,
    ],
  );

  return { applyCloudSnapshot };
};
