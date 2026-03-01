import { useCallback } from "react";
import { formatSyncTimestamp } from "../lib/appUtils";

type ToastTone = "info" | "success" | "error";

interface AccountProfilePreset<TSettings> {
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

interface UseCloudProfileActionsInput<TSettings, TSnapshot> {
  t: (key: string, options?: Record<string, unknown>) => string;
  pushToast: (tone: ToastTone, text: string) => void;
  accountProfileDraftName: string;
  setAccountProfileDraftName: (value: string) => void;
  activeAccountProfileId: string;
  setActiveAccountProfileId: (value: string) => void;
  accountProfiles: AccountProfilePreset<TSettings>[];
  setAccountProfiles: (updater: (current: AccountProfilePreset<TSettings>[]) => AccountProfilePreset<TSettings>[]) => void;
  pendingCloudConflictSnapshot: TSnapshot | null;
  setPendingCloudConflictSnapshot: (value: TSnapshot | null) => void;
  setCloudSyncStatus: (value: string) => void;
  currentSettingsSnapshot: () => TSettings;
  applyStoredSettings: (settings: TSettings) => void;
  pushCloudRestorePoint: (reason: string) => void;
  applyCloudSnapshot: (rawSnapshot: unknown, options?: { updateReference?: boolean }) => void;
}

export const useCloudProfileActions = <TSettings, TSnapshot>({
  t,
  pushToast,
  accountProfileDraftName,
  setAccountProfileDraftName,
  activeAccountProfileId,
  setActiveAccountProfileId,
  accountProfiles,
  setAccountProfiles,
  pendingCloudConflictSnapshot,
  setPendingCloudConflictSnapshot,
  setCloudSyncStatus,
  currentSettingsSnapshot,
  applyStoredSettings,
  pushCloudRestorePoint,
  applyCloudSnapshot,
}: UseCloudProfileActionsInput<TSettings, TSnapshot>) => {
  const dismissCloudConflict = useCallback(() => {
    setPendingCloudConflictSnapshot(null);
    setCloudSyncStatus(t("messages.cloudKeepLocalStatus"));
    pushToast("info", t("messages.cloudKeepLocalToast"));
  }, [pushToast, setCloudSyncStatus, setPendingCloudConflictSnapshot, t]);

  const applyPendingCloudConflict = useCallback(() => {
    if (!pendingCloudConflictSnapshot) return;
    pushCloudRestorePoint(t("messages.cloudRestorePointBeforeRemoteConflict"));
    applyCloudSnapshot(pendingCloudConflictSnapshot);
    setCloudSyncStatus(t("messages.cloudAppliedRemoteStatus"));
    pushToast("success", t("messages.cloudAppliedRemoteToast"));
  }, [applyCloudSnapshot, pendingCloudConflictSnapshot, pushCloudRestorePoint, pushToast, setCloudSyncStatus, t]);

  const restoreFromCloudPoint = useCallback(
    (point: CloudRestorePoint<TSnapshot>) => {
      pushCloudRestorePoint(t("messages.cloudRestorePointBeforeLocalRecovery"));
      applyCloudSnapshot(point.snapshot, { updateReference: false });
      setCloudSyncStatus(
        t("messages.cloudRestoredPointStatus", { value: formatSyncTimestamp(point.createdAt, t("unknown")) }),
      );
      pushToast("success", t("messages.cloudRestoredPointToast"));
    },
    [applyCloudSnapshot, pushCloudRestorePoint, pushToast, setCloudSyncStatus, t],
  );

  const createAccountProfile = useCallback(() => {
    const name = accountProfileDraftName.trim();
    if (!name) {
      pushToast("error", t("messages.profileNameRequired"));
      return;
    }
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const profile: AccountProfilePreset<TSettings> = {
      id,
      name,
      updatedAt: new Date().toISOString(),
      settings: currentSettingsSnapshot(),
    };
    setAccountProfiles((current) => [profile, ...current].slice(0, 20));
    setActiveAccountProfileId(id);
    setAccountProfileDraftName("");
    setCloudSyncStatus(t("messages.profileCreatedStatus", { name }));
    pushToast("success", t("messages.profileCreated", { name }));
  }, [
    accountProfileDraftName,
    currentSettingsSnapshot,
    pushToast,
    setAccountProfileDraftName,
    setAccountProfiles,
    setActiveAccountProfileId,
    setCloudSyncStatus,
    t,
  ]);

  const saveCurrentToActiveProfile = useCallback(() => {
    if (!activeAccountProfileId) {
      pushToast("error", t("messages.profileSelectOrCreate"));
      return;
    }
    const timestamp = new Date().toISOString();
    let saved = false;
    setAccountProfiles((current) =>
      current.map((profile) => {
        if (profile.id !== activeAccountProfileId) return profile;
        saved = true;
        return {
          ...profile,
          updatedAt: timestamp,
          settings: currentSettingsSnapshot(),
        };
      }),
    );
    if (!saved) {
      pushToast("error", t("messages.profileNotFound"));
      return;
    }
    setCloudSyncStatus(t("messages.profileSavedActive"));
    pushToast("success", t("messages.profileSavedActive"));
  }, [activeAccountProfileId, currentSettingsSnapshot, pushToast, setAccountProfiles, setCloudSyncStatus, t]);

  const applyActiveAccountProfile = useCallback(() => {
    if (!activeAccountProfileId) {
      pushToast("error", t("messages.profileSelectFirst"));
      return;
    }
    const profile = accountProfiles.find((entry) => entry.id === activeAccountProfileId);
    if (!profile) {
      pushToast("error", t("messages.profileNotFound"));
      return;
    }
    pushCloudRestorePoint(t("messages.cloudRestorePointBeforeProfileApply", { name: profile.name }));
    applyStoredSettings(profile.settings);
    setCloudSyncStatus(t("messages.profileApplied", { name: profile.name }));
    pushToast("success", t("messages.profileApplied", { name: profile.name }));
  }, [accountProfiles, activeAccountProfileId, applyStoredSettings, pushCloudRestorePoint, pushToast, setCloudSyncStatus, t]);

  const deleteActiveAccountProfile = useCallback(() => {
    if (!activeAccountProfileId) {
      pushToast("error", t("messages.profileSelectFirst"));
      return;
    }
    let removedName = "";
    setAccountProfiles((current) => {
      return current.filter((profile) => {
        if (profile.id !== activeAccountProfileId) return true;
        removedName = profile.name;
        return false;
      });
    });
    if (!removedName) {
      pushToast("error", t("messages.profileNotFound"));
      return;
    }
    setCloudSyncStatus(t("messages.profileDeleted", { name: removedName }));
    pushToast("info", t("messages.profileDeleted", { name: removedName }));
  }, [activeAccountProfileId, pushToast, setAccountProfiles, setCloudSyncStatus, t]);

  return {
    dismissCloudConflict,
    applyPendingCloudConflict,
    restoreFromCloudPoint,
    createAccountProfile,
    saveCurrentToActiveProfile,
    applyActiveAccountProfile,
    deleteActiveAccountProfile,
  };
};
