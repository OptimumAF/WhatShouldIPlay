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

interface UseApplyCloudSnapshotInput<TSettings, TSpinHistory, TSteamImport, TExclusions, TNotifications, TProfile> {
  safeParseSnapshot: (raw: unknown) => SafeParseSuccess | SafeParseFailure;
  invalidSnapshotMessage: string;
  sanitizeSettings: (raw: unknown) => TSettings;
  applyStoredSettings: (settings: TSettings) => void;
  mapSpinHistory: (entries: SnapshotSpinHistoryEntry[]) => TSpinHistory[];
  setSpinHistory: (entries: TSpinHistory[]) => void;
  normalizeManualGames: (entries: string[]) => string[];
  setManualGames: (entries: string[]) => void;
  sanitizeSteamImport: (raw: unknown) => TSteamImport;
  setSteamImport: (value: TSteamImport) => void;
  sanitizeExclusions: (raw: unknown) => TExclusions;
  setExclusions: (value: TExclusions) => void;
  sanitizeNotifications: (raw: unknown) => TNotifications;
  setNotifications: (value: TNotifications) => void;
  sanitizeAccountProfiles: (raw: unknown) => TProfile[];
  setProfiles: (profiles: TProfile[], incomingActiveId: string) => void;
  setCloudSyncReferenceAt: (value: string) => void;
  clearPendingCloudConflict: () => void;
}

export const useApplyCloudSnapshot = <
  TSettings,
  TSpinHistory,
  TSteamImport,
  TExclusions,
  TNotifications,
  TProfile,
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
  setSteamImport,
  sanitizeExclusions,
  setExclusions,
  sanitizeNotifications,
  setNotifications,
  sanitizeAccountProfiles,
  setProfiles,
  setCloudSyncReferenceAt,
  clearPendingCloudConflict,
}: UseApplyCloudSnapshotInput<TSettings, TSpinHistory, TSteamImport, TExclusions, TNotifications, TProfile>) => {
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
        setSteamImport(sanitizeSteamImport(snapshot.steamImport));
      }

      if (snapshot.exclusions) {
        setExclusions(sanitizeExclusions(snapshot.exclusions));
      }

      if (snapshot.notifications) {
        setNotifications(sanitizeNotifications(snapshot.notifications));
      }

      if (snapshot.profiles?.items) {
        const incomingProfiles = sanitizeAccountProfiles(snapshot.profiles.items);
        setProfiles(incomingProfiles, snapshot.profiles.activeProfileId ?? "");
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
      setCloudSyncReferenceAt,
      setExclusions,
      setManualGames,
      setNotifications,
      setProfiles,
      setSpinHistory,
      setSteamImport,
    ],
  );

  return { applyCloudSnapshot };
};
