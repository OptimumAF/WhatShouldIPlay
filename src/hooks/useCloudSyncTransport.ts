import { useCallback } from "react";
import { createSyncGist, pullSyncSnapshot, updateSyncGist } from "../lib/cloudSyncClient";
import { formatSyncTimestamp } from "../lib/appUtils";

type ToastTone = "info" | "success" | "error";

interface BaseSnapshot {
  exportedAt?: string;
}

interface UseCloudSyncTransportInput<TSnapshot extends BaseSnapshot> {
  gistId: string;
  gistToken: string;
  cloudSyncReferenceAt: string;
  t: (key: string, options?: Record<string, unknown>) => string;
  pushToast: (tone: ToastTone, text: string) => void;
  buildCloudSnapshot: () => TSnapshot;
  parseCloudSnapshot: (raw: unknown) => TSnapshot;
  applyCloudSnapshot: (snapshot: TSnapshot) => void;
  pushCloudRestorePoint: (reason: string) => void;
  setGistId: (value: string) => void;
  setCloudSyncReferenceAt: (value: string) => void;
  setPendingCloudConflictSnapshot: (value: TSnapshot | null) => void;
  setCloudSyncStatus: (value: string) => void;
  setCloudSyncLoading: (value: boolean) => void;
}

export const useCloudSyncTransport = <TSnapshot extends BaseSnapshot>({
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
}: UseCloudSyncTransportInput<TSnapshot>) => {
  const pushCloudSync = useCallback(async () => {
    const token = gistToken.trim();
    if (!token) {
      setCloudSyncStatus(t("messages.cloudTokenRequired"));
      pushToast("error", t("messages.cloudNeedsToken"));
      return;
    }
    if (!gistId.trim()) {
      setCloudSyncStatus(t("messages.cloudNeedGistOrCreate"));
      pushToast("error", t("messages.cloudProvideGistBeforePush"));
      return;
    }

    setCloudSyncLoading(true);
    setCloudSyncStatus(t("messages.cloudUploading"));
    try {
      const snapshot = buildCloudSnapshot();
      await updateSyncGist({
        gistId: gistId.trim(),
        token,
        snapshot,
      });
      setCloudSyncReferenceAt(snapshot.exportedAt ?? new Date().toISOString());
      setPendingCloudConflictSnapshot(null);
      setCloudSyncStatus(t("messages.cloudUploaded"));
      pushToast("success", t("messages.cloudUploaded"));
    } catch (error) {
      const message = (error as Error).message;
      setCloudSyncStatus(message);
      pushToast("error", `${message} Check token permissions and gist access, then retry.`);
    } finally {
      setCloudSyncLoading(false);
    }
  }, [
    buildCloudSnapshot,
    gistId,
    gistToken,
    pushToast,
    setCloudSyncLoading,
    setCloudSyncReferenceAt,
    setCloudSyncStatus,
    setPendingCloudConflictSnapshot,
    t,
  ]);

  const createCloudSyncGist = useCallback(async () => {
    const token = gistToken.trim();
    if (!token) {
      setCloudSyncStatus(t("messages.cloudTokenRequired"));
      pushToast("error", t("messages.cloudNeedTokenCreate"));
      return;
    }

    setCloudSyncLoading(true);
    setCloudSyncStatus(t("messages.cloudCreatingGist"));
    try {
      const snapshot = buildCloudSnapshot();
      const createdGistId = await createSyncGist({
        token,
        snapshot,
      });
      setGistId(createdGistId);
      setCloudSyncReferenceAt(snapshot.exportedAt ?? new Date().toISOString());
      setPendingCloudConflictSnapshot(null);
      setCloudSyncStatus(`Created sync gist ${createdGistId}.`);
      pushToast("success", `Created sync gist ${createdGistId}.`);
    } catch (error) {
      const message = (error as Error).message;
      if (message === "GitHub API did not return gist id.") {
        setCloudSyncStatus(t("messages.cloudMissingGistId"));
        pushToast("error", t("messages.cloudMissingGistId"));
        return;
      }
      setCloudSyncStatus(message);
      pushToast("error", `${message} Verify token scope and GitHub API availability.`);
    } finally {
      setCloudSyncLoading(false);
    }
  }, [
    buildCloudSnapshot,
    gistToken,
    pushToast,
    setCloudSyncLoading,
    setCloudSyncReferenceAt,
    setCloudSyncStatus,
    setGistId,
    setPendingCloudConflictSnapshot,
    t,
  ]);

  const pullCloudSync = useCallback(async () => {
    const token = gistToken.trim();
    if (!token) {
      setCloudSyncStatus(t("messages.cloudTokenRequired"));
      pushToast("error", t("messages.cloudNeedTokenPull"));
      return;
    }
    if (!gistId.trim()) {
      setCloudSyncStatus(t("messages.cloudNeedGistPull"));
      pushToast("error", t("messages.cloudProvideGistBeforePull"));
      return;
    }

    setCloudSyncLoading(true);
    setCloudSyncStatus(t("messages.cloudDownloading"));
    try {
      const parsed = await pullSyncSnapshot({
        gistId: gistId.trim(),
        token,
        noFileError: t("messages.cloudNoSyncFile"),
        emptyFileError: t("messages.cloudEmptySyncFile"),
      });
      const remoteSnapshot = parseCloudSnapshot(parsed);
      const remoteTimestamp = remoteSnapshot.exportedAt;
      const remoteMillis = remoteTimestamp ? Date.parse(remoteTimestamp) : NaN;
      const referenceMillis = cloudSyncReferenceAt ? Date.parse(cloudSyncReferenceAt) : NaN;
      if (
        remoteTimestamp &&
        cloudSyncReferenceAt &&
        Number.isFinite(remoteMillis) &&
        Number.isFinite(referenceMillis) &&
        remoteMillis < referenceMillis
      ) {
        setPendingCloudConflictSnapshot(remoteSnapshot);
        setCloudSyncStatus(
          t("cloudConflictOlder", {
            remote: formatSyncTimestamp(remoteTimestamp, t("unknown")),
            local: formatSyncTimestamp(cloudSyncReferenceAt, t("unknown")),
          }),
        );
        pushToast("info", t("messages.cloudConflictChoose"));
      } else {
        pushCloudRestorePoint(t("messages.cloudRestorePointBeforePulledApply"));
        applyCloudSnapshot(remoteSnapshot);
        setCloudSyncStatus(t("messages.cloudDownloadedApplied"));
        pushToast("success", t("messages.cloudDownloadedApplied"));
      }
    } catch (error) {
      const message = (error as Error).message;
      setCloudSyncStatus(message);
      pushToast("error", `${message} ${t("messages.retryHint")}`);
    } finally {
      setCloudSyncLoading(false);
    }
  }, [
    applyCloudSnapshot,
    cloudSyncReferenceAt,
    gistId,
    gistToken,
    parseCloudSnapshot,
    pushCloudRestorePoint,
    pushToast,
    setCloudSyncLoading,
    setCloudSyncStatus,
    setPendingCloudConflictSnapshot,
    t,
  ]);

  return {
    pushCloudSync,
    createCloudSyncGist,
    pullCloudSync,
  };
};
