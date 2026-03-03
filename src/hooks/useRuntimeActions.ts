import { useCallback } from "react";

interface UseRuntimeActionsInput {
  installPrompt: {
    prompt: () => Promise<void>;
    userChoice: Promise<unknown>;
  } | null;
  skipWaitingMessageType: string;
  clearInstallPrompt: () => void;
  setUpdateInProgress: (value: boolean) => void;
  setSwUpdateReady: (value: boolean) => void;
  setNotificationsEnabled: (value: boolean) => void;
  setNotificationStatus: (value: string) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}

export const useRuntimeActions = ({
  installPrompt,
  skipWaitingMessageType,
  clearInstallPrompt,
  setUpdateInProgress,
  setSwUpdateReady,
  setNotificationsEnabled,
  setNotificationStatus,
  t,
}: UseRuntimeActionsInput) => {
  const handleInstall = useCallback(async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    clearInstallPrompt();
  }, [clearInstallPrompt, installPrompt]);

  const applyServiceWorkerUpdate = useCallback(async () => {
    if (!("serviceWorker" in navigator)) return;

    setUpdateInProgress(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration?.waiting) {
        setSwUpdateReady(false);
        setUpdateInProgress(false);
        return;
      }

      registration.waiting.postMessage({ type: skipWaitingMessageType });
      window.setTimeout(() => {
        window.location.reload();
      }, 1800);
    } catch {
      setUpdateInProgress(false);
    }
  }, [setSwUpdateReady, setUpdateInProgress, skipWaitingMessageType]);

  const setNotificationsEnabledWithPermission = useCallback(
    async (enabled: boolean) => {
      if (!enabled) {
        setNotificationsEnabled(false);
        setNotificationStatus(t("notificationsDisabledStatus"));
        return;
      }

      if (!("Notification" in window)) {
        setNotificationsEnabled(false);
        setNotificationStatus(t("notificationsUnsupportedStatus"));
        return;
      }

      if (Notification.permission === "granted") {
        setNotificationsEnabled(true);
        setNotificationStatus(t("notificationsEnabledStatus"));
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        setNotificationsEnabled(true);
        setNotificationStatus(t("notificationsEnabledStatus"));
      } else {
        setNotificationsEnabled(false);
        setNotificationStatus(t("notificationsDeniedStatus"));
      }
    },
    [setNotificationStatus, setNotificationsEnabled, t],
  );

  return {
    handleInstall,
    applyServiceWorkerUpdate,
    setNotificationsEnabledWithPermission,
  };
};
