import { useCallback } from "react";
import { serializePortableSnapshot } from "../lib/portableSnapshot";
import type { CloudSyncSnapshot } from "../lib/appSchemas";
import type { ManualGameRecord } from "../lib/manualIdentity";
import type { GameStatusRecord } from "../lib/appConfig";
import type { SourceId } from "../types";

interface SpinHistoryLike {
  sources: SourceId[];
}

interface AccountProfileLike<TSettings> {
  id: string;
  name: string;
  updatedAt: string;
  settings: TSettings;
}

interface CloudRestorePoint<TSnapshot> {
  id: string;
  createdAt: string;
  reason: string;
  snapshot: TSnapshot;
}

interface UseCloudSnapshotBuildersInput<TSettings, TGameEntry, TSpinHistory extends SpinHistoryLike, TSnapshot> {
  currentSettingsSnapshot: () => TSettings;
  spinHistory: TSpinHistory[];
  manualGames: string[];
  manualRecords: ManualGameRecord[];
  steamId: string;
  steamImportGames: TGameEntry[];
  excludePlayed: boolean;
  excludeCompleted: boolean;
  playedGames: string[];
  completedGames: string[];
  playedRecords: GameStatusRecord[];
  completedRecords: GameStatusRecord[];
  notificationsEnabled: boolean;
  trendNotifications: boolean;
  reminderNotifications: boolean;
  reminderIntervalMinutes: number;
  activeAccountProfileId: string;
  accountProfiles: AccountProfileLike<TSettings>[];
  maxCloudRestorePoints: number;
  setCloudRestorePoints: (
    updater: (current: CloudRestorePoint<TSnapshot>[]) => CloudRestorePoint<TSnapshot>[],
  ) => void;
}

export const useCloudSnapshotBuilders = <
  TSettings,
  TGameEntry,
  TSpinHistory extends SpinHistoryLike,
  TSnapshot,
>({
  currentSettingsSnapshot,
  spinHistory,
  manualGames,
  manualRecords,
  steamId,
  steamImportGames,
  excludePlayed,
  excludeCompleted,
  playedGames,
  completedGames,
  playedRecords,
  completedRecords,
  notificationsEnabled,
  trendNotifications,
  reminderNotifications,
  reminderIntervalMinutes,
  activeAccountProfileId,
  accountProfiles,
  maxCloudRestorePoints,
  setCloudRestorePoints,
}: UseCloudSnapshotBuildersInput<TSettings, TGameEntry, TSpinHistory, TSnapshot>) => {
  const buildCloudSnapshot = useCallback(
    (): CloudSyncSnapshot => serializePortableSnapshot({
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: currentSettingsSnapshot(),
      spinHistory: spinHistory.slice(0, 50),
      manualGames,
      manualRecords,
      steamImport: {
        steamId,
        steamImportGames,
      },
      exclusions: {
        excludePlayed,
        excludeCompleted,
        playedGames,
        completedGames,
        playedRecords,
        completedRecords,
      },
      notifications: {
        notificationsEnabled,
        trendNotifications,
        reminderNotifications,
        reminderIntervalMinutes,
      },
      profiles: {
        activeProfileId: activeAccountProfileId || undefined,
        items: accountProfiles.map((profile) => ({
          id: profile.id,
          name: profile.name,
          updatedAt: profile.updatedAt,
          settings: profile.settings,
        })),
      },
    }),
    [
      accountProfiles,
      activeAccountProfileId,
      completedGames,
      completedRecords,
      currentSettingsSnapshot,
      excludeCompleted,
      excludePlayed,
      manualGames,
      manualRecords,
      notificationsEnabled,
      playedGames,
      playedRecords,
      reminderIntervalMinutes,
      reminderNotifications,
      spinHistory,
      steamId,
      steamImportGames,
      trendNotifications,
    ],
  );

  const pushCloudRestorePoint = useCallback(
    (reason: string) => {
      const snapshot = buildCloudSnapshot() as unknown as TSnapshot;
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const point: CloudRestorePoint<TSnapshot> = {
        id,
        createdAt: new Date().toISOString(),
        reason,
        snapshot,
      };
      setCloudRestorePoints((current) => [point, ...current].slice(0, maxCloudRestorePoints));
    },
    [buildCloudSnapshot, maxCloudRestorePoints, setCloudRestorePoints],
  );

  return {
    buildCloudSnapshot,
    pushCloudRestorePoint,
  };
};
