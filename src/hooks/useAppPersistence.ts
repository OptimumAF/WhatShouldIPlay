import { useEffect } from "react";
import {
  ACCOUNT_PROFILES_STORAGE_KEY,
  ACTIVE_ACCOUNT_PROFILE_STORAGE_KEY,
  CLOUD_SYNC_REFERENCE_STORAGE_KEY,
  CLOUD_SYNC_RESTORE_POINTS_STORAGE_KEY,
  CLOUD_SYNC_STORAGE_KEY,
  EXCLUSION_STORAGE_KEY,
  HISTORY_STORAGE_KEY,
  MANUAL_GAMES_STORAGE_KEY,
  NOTIFICATION_STORAGE_KEY,
  SETTINGS_STORAGE_KEY,
  STEAM_IMPORT_STORAGE_KEY,
  THEME_STORAGE_KEY,
} from "../lib/storageKeys";

interface AppPersistenceInput {
  settings: unknown;
  spinHistory: unknown[];
  manualGames: string[];
  steamImport: unknown;
  exclusions: unknown;
  notifications: unknown;
  cloudSync: unknown;
  accountProfiles: unknown[];
  activeAccountProfileId: string;
  cloudRestorePoints: unknown[];
  cloudSyncReferenceAt: string;
  themeMode: string;
}

const writeStorage = (key: string, value: unknown) => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Swallow write failures (quota/private mode) so runtime UX stays usable.
  }
};

export const useAppPersistence = ({
  settings,
  spinHistory,
  manualGames,
  steamImport,
  exclusions,
  notifications,
  cloudSync,
  accountProfiles,
  activeAccountProfileId,
  cloudRestorePoints,
  cloudSyncReferenceAt,
  themeMode,
}: AppPersistenceInput) => {
  useEffect(() => {
    writeStorage(SETTINGS_STORAGE_KEY, settings);
  }, [settings]);

  useEffect(() => {
    writeStorage(HISTORY_STORAGE_KEY, spinHistory.slice(0, 50));
  }, [spinHistory]);

  useEffect(() => {
    writeStorage(MANUAL_GAMES_STORAGE_KEY, manualGames);
  }, [manualGames]);

  useEffect(() => {
    writeStorage(STEAM_IMPORT_STORAGE_KEY, steamImport);
  }, [steamImport]);

  useEffect(() => {
    writeStorage(EXCLUSION_STORAGE_KEY, exclusions);
  }, [exclusions]);

  useEffect(() => {
    writeStorage(NOTIFICATION_STORAGE_KEY, notifications);
  }, [notifications]);

  useEffect(() => {
    writeStorage(CLOUD_SYNC_STORAGE_KEY, cloudSync);
  }, [cloudSync]);

  useEffect(() => {
    writeStorage(ACCOUNT_PROFILES_STORAGE_KEY, accountProfiles);
  }, [accountProfiles]);

  useEffect(() => {
    writeStorage(ACTIVE_ACCOUNT_PROFILE_STORAGE_KEY, activeAccountProfileId);
  }, [activeAccountProfileId]);

  useEffect(() => {
    writeStorage(CLOUD_SYNC_RESTORE_POINTS_STORAGE_KEY, cloudRestorePoints);
  }, [cloudRestorePoints]);

  useEffect(() => {
    writeStorage(CLOUD_SYNC_REFERENCE_STORAGE_KEY, cloudSyncReferenceAt);
  }, [cloudSyncReferenceAt]);

  useEffect(() => {
    writeStorage(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);
};
