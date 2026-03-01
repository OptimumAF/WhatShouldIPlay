import { Cloud, Download, FilePlus2, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import { HelpTip } from "../../components/HelpTip";

interface CloudProfileOption {
  id: string;
  name: string;
  updatedAtLabel: string;
}

interface CloudRestorePointOption {
  id: string;
  timestampLabel: string;
  reason: string;
}

interface CloudConflictState {
  remoteLabel: string;
  localLabel: string;
}

interface CloudSyncPanelProps {
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
  conflict: CloudConflictState | null;
  onKeepLocal: () => void;
  onApplyRemote: () => void;
  restorePoints: CloudRestorePointOption[];
  onRestorePoint: (id: string) => void;
  onClearRestorePoints: () => void;
}

export function CloudSyncPanel({
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
  conflict,
  onKeepLocal,
  onApplyRemote,
  restorePoints,
  onRestorePoint,
  onClearRestorePoints,
}: CloudSyncPanelProps) {
  const { t } = useTranslation();

  return (
    <section className="panel" aria-labelledby="cloud-sync-heading">
      <h2 id="cloud-sync-heading" className="section-heading">
        <span className="heading-label">
          <Cloud className="ui-icon" aria-hidden="true" />
          {t("cloudSyncTitle")}
        </span>
        <HelpTip text={t("helpTips.cloudSync")} />
      </h2>
      <p className="muted">{t("cloudSyncDescription")}</p>
      <div className="steam-grid">
        <label htmlFor="cloud-token" className="sr-only">
          {t("cloudTokenLabel")}
        </label>
        <input
          id="cloud-token"
          type="password"
          placeholder={t("cloudTokenPlaceholder")}
          value={gistToken}
          onChange={(event) => onGistTokenChange(event.target.value)}
          autoComplete="off"
        />
        <label htmlFor="cloud-gist-id" className="sr-only">
          {t("cloudGistIdLabel")}
        </label>
        <input
          id="cloud-gist-id"
          type="text"
          placeholder={t("cloudGistIdPlaceholder")}
          value={gistId}
          onChange={(event) => onGistIdChange(event.target.value)}
          autoComplete="off"
        />
      </div>
      <div className="button-row">
        <button type="button" onClick={onCreateGistPush} disabled={cloudSyncLoading}>
          <span className="button-label">
            <FilePlus2 className="ui-icon" aria-hidden="true" />
            {cloudSyncLoading ? t("updating") : t("createGistPush")}
          </span>
        </button>
        <button type="button" className="ghost" onClick={onPushSync} disabled={cloudSyncLoading}>
          <span className="button-label">
            <Upload className="ui-icon" aria-hidden="true" />
            {t("pushSync")}
          </span>
        </button>
        <button type="button" className="ghost" onClick={onPullSync} disabled={cloudSyncLoading}>
          <span className="button-label">
            <Download className="ui-icon" aria-hidden="true" />
            {t("pullSync")}
          </span>
        </button>
      </div>

      <div className="cloud-account-profiles">
        <strong>{t("accountProfilesTitle")}</strong>
        <p className="muted">{t("accountProfilesDescription")}</p>
        <div className="steam-grid">
          <label className="filter-field" htmlFor="account-profile-select">
            <span>{t("activeProfile")}</span>
            <select id="account-profile-select" value={activeAccountProfileId} onChange={(event) => onActiveAccountProfileChange(event.target.value)}>
              <option value="">{t("none")}</option>
              {accountProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name} ({profile.updatedAtLabel})
                </option>
              ))}
            </select>
          </label>
          <label className="filter-field" htmlFor="account-profile-name">
            <span>{t("newProfileName")}</span>
            <input
              id="account-profile-name"
              type="text"
              value={accountProfileDraftName}
              onChange={(event) => onAccountProfileDraftNameChange(event.target.value)}
              placeholder={t("newProfilePlaceholder")}
            />
          </label>
        </div>
        <div className="button-row">
          <button type="button" className="ghost" onClick={onCreateProfile}>
            {t("createProfile")}
          </button>
          <button type="button" className="ghost" onClick={onSaveCurrentToActive} disabled={!activeAccountProfileId}>
            {t("saveCurrentToActive")}
          </button>
          <button type="button" className="ghost" onClick={onApplyActive} disabled={!activeAccountProfileId}>
            {t("applyActive")}
          </button>
          <button type="button" className="ghost" onClick={onDeleteActive} disabled={!activeAccountProfileId}>
            {t("deleteActive")}
          </button>
        </div>
        {accountProfiles.length > 0 ? (
          <p className="muted">{t("profilesStored", { count: accountProfiles.length })}</p>
        ) : (
          <p className="muted">{t("noProfilesSaved")}</p>
        )}
      </div>

      <p className="muted">{t("cloudReference", { value: cloudReferenceLabel })}</p>
      {conflict ? (
        <div className="cloud-sync-conflict" role="alert">
          <p>
            {t("cloudConflictOlder", {
              remote: conflict.remoteLabel,
              local: conflict.localLabel,
            })}
          </p>
          <div className="button-row">
            <button type="button" className="ghost" onClick={onKeepLocal} disabled={cloudSyncLoading}>
              {t("keepLocal")}
            </button>
            <button type="button" onClick={onApplyRemote} disabled={cloudSyncLoading}>
              {t("applyRemoteAnyway")}
            </button>
          </div>
        </div>
      ) : null}

      {restorePoints.length > 0 ? (
        <div className="cloud-restore-points">
          <strong>{t("restorePointsTitle")}</strong>
          <ul>
            {restorePoints.map((point) => (
              <li key={point.id}>
                <span>
                  {point.timestampLabel} | {point.reason}
                </span>
                <button type="button" className="ghost compact" onClick={() => onRestorePoint(point.id)}>
                  {t("restore")}
                </button>
              </li>
            ))}
          </ul>
          <div className="button-row">
            <button type="button" className="ghost compact" onClick={onClearRestorePoints}>
              {t("clearRestorePoints")}
            </button>
          </div>
        </div>
      ) : null}

      {cloudSyncLoading ? (
        <p className="status progress-status" role="status" aria-live="polite">
          <span className="progress-dot" aria-hidden="true" />
          {t("syncingWithGist")}
        </p>
      ) : null}
      {cloudSyncStatus ? (
        <p className="status" role="status" aria-live="polite">
          {cloudSyncStatus}
        </p>
      ) : null}
    </section>
  );
}
