import { useCallback, useMemo } from "react";
import { formatSyncTimestamp } from "../lib/appUtils";

type ToastTone = "info" | "success" | "error";

interface ProfileLike {
  id: string;
  name: string;
  updatedAt: string;
}

interface SnapshotLike {
  exportedAt?: string;
}

interface RestorePointLike<TSnapshot extends SnapshotLike> {
  id: string;
  createdAt: string;
  reason: string;
  snapshot: TSnapshot;
}

interface UseCloudPanelDataInput<TProfile extends ProfileLike, TSnapshot extends SnapshotLike, TRestorePoint extends RestorePointLike<TSnapshot>> {
  accountProfiles: TProfile[];
  cloudSyncReferenceAt: string;
  pendingCloudConflictSnapshot: TSnapshot | null;
  cloudRestorePoints: TRestorePoint[];
  restoreFromCloudPoint: (point: TRestorePoint) => void;
  setCloudRestorePoints: (points: TRestorePoint[]) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
  pushToast: (tone: ToastTone, text: string) => void;
}

export const useCloudPanelData = <
  TProfile extends ProfileLike,
  TSnapshot extends SnapshotLike,
  TRestorePoint extends RestorePointLike<TSnapshot>,
>({
  accountProfiles,
  cloudSyncReferenceAt,
  pendingCloudConflictSnapshot,
  cloudRestorePoints,
  restoreFromCloudPoint,
  setCloudRestorePoints,
  t,
  pushToast,
}: UseCloudPanelDataInput<TProfile, TSnapshot, TRestorePoint>) => {
  const cloudProfileOptions = useMemo(
    () =>
      accountProfiles.map((profile) => ({
        id: profile.id,
        name: profile.name,
        updatedAtLabel: formatSyncTimestamp(profile.updatedAt, t("unknown")),
      })),
    [accountProfiles, t],
  );

  const cloudReferenceLabel = useMemo(
    () => formatSyncTimestamp(cloudSyncReferenceAt, t("unknown")),
    [cloudSyncReferenceAt, t],
  );

  const cloudConflict = useMemo(
    () =>
      pendingCloudConflictSnapshot
        ? {
            remoteLabel: formatSyncTimestamp(pendingCloudConflictSnapshot.exportedAt, t("unknown")),
            localLabel: formatSyncTimestamp(cloudSyncReferenceAt, t("unknown")),
          }
        : null,
    [cloudSyncReferenceAt, pendingCloudConflictSnapshot, t],
  );

  const cloudRestorePointOptions = useMemo(
    () =>
      cloudRestorePoints.map((point) => ({
        id: point.id,
        timestampLabel: formatSyncTimestamp(point.createdAt, t("unknown")),
        reason: point.reason,
      })),
    [cloudRestorePoints, t],
  );

  const onRestorePoint = useCallback(
    (id: string) => {
      const point = cloudRestorePoints.find((entry) => entry.id === id);
      if (!point) return;
      restoreFromCloudPoint(point);
    },
    [cloudRestorePoints, restoreFromCloudPoint],
  );

  const onClearRestorePoints = useCallback(() => {
    setCloudRestorePoints([]);
    pushToast("info", t("messages.cloudRestorePointsCleared"));
  }, [pushToast, setCloudRestorePoints, t]);

  return {
    cloudProfileOptions,
    cloudReferenceLabel,
    cloudConflict,
    cloudRestorePointOptions,
    onRestorePoint,
    onClearRestorePoints,
  };
};
