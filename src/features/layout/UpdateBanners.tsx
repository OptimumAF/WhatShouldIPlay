import { useTranslation } from "react-i18next";

interface UpdateBannersProps {
  swUpdateReady: boolean;
  dismissedUpdate: boolean;
  updateInProgress: boolean;
  freshTrendsNotice: boolean;
  onApplyServiceWorkerUpdate: () => void;
  onDismissUpdate: () => void;
  onDismissFreshTrends: () => void;
}

export function UpdateBanners({
  swUpdateReady,
  dismissedUpdate,
  updateInProgress,
  freshTrendsNotice,
  onApplyServiceWorkerUpdate,
  onDismissUpdate,
  onDismissFreshTrends,
}: UpdateBannersProps) {
  const { t } = useTranslation();

  return (
    <>
      {swUpdateReady && !dismissedUpdate ? (
        <section className="update-banner" aria-live="polite">
          <div>
            <strong>{t("updateReadyTitle")}</strong>
            <p>{t("updateReadyDescription")}</p>
          </div>
          <div className="button-row">
            <button type="button" onClick={onApplyServiceWorkerUpdate} disabled={updateInProgress}>
              {updateInProgress ? t("updating") : t("updateNow")}
            </button>
            <button type="button" className="ghost" onClick={onDismissUpdate} disabled={updateInProgress}>
              {t("later")}
            </button>
          </div>
        </section>
      ) : null}

      {freshTrendsNotice ? (
        <section className="update-banner" aria-live="polite">
          <div>
            <strong>{t("trendsReadyTitle")}</strong>
            <p>{t("trendsReadyDescription")}</p>
          </div>
          <div className="button-row">
            <button type="button" className="ghost" onClick={onDismissFreshTrends}>
              {t("dismiss")}
            </button>
          </div>
        </section>
      ) : null}
    </>
  );
}
