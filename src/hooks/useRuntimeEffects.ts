import { useEffect, useRef } from "react";
import type { BeforeInstallPromptEvent } from "../lib/appConfig";

type ToastTone = "info" | "success" | "error";

interface UseRuntimeEffectsInput {
  t: (key: string, options?: Record<string, unknown>) => string;
  pushToast: (tone: ToastTone, text: string) => void;
  topGamesIsError: boolean;
  topGamesError: unknown;
  notificationsEnabled: boolean;
  trendNotifications: boolean;
  reminderNotifications: boolean;
  reminderIntervalMinutes: number;
  setFreshTrendsNotice: (value: boolean) => void;
  setInstallPrompt: (value: BeforeInstallPromptEvent | null) => void;
  setSwUpdateReady: (value: boolean) => void;
  setDismissedUpdate: (value: boolean) => void;
  setUpdateInProgress: (value: boolean) => void;
  notificationPrefsMessageType: string;
  topGamesUpdatedMessageType: string;
  updateReadyEventName: string;
}

export const useRuntimeEffects = ({
  t,
  pushToast,
  topGamesIsError,
  topGamesError,
  notificationsEnabled,
  trendNotifications,
  reminderNotifications,
  reminderIntervalMinutes,
  setFreshTrendsNotice,
  setInstallPrompt,
  setSwUpdateReady,
  setDismissedUpdate,
  setUpdateInProgress,
  notificationPrefsMessageType,
  topGamesUpdatedMessageType,
  updateReadyEventName,
}: UseRuntimeEffectsInput) => {
  const lastTopGamesErrorRef = useRef("");

  useEffect(() => {
    if (!topGamesIsError) {
      lastTopGamesErrorRef.current = "";
      return;
    }
    const errorText = (topGamesError as Error)?.message ?? t("messages.topGamesLoadError");
    if (lastTopGamesErrorRef.current === errorText) return;
    lastTopGamesErrorRef.current = errorText;
    pushToast("error", `${errorText} ${t("messages.retryHint")}`);
  }, [pushToast, t, topGamesError, topGamesIsError]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const postPrefs = async () => {
      const payload = {
        enabled: notificationsEnabled,
        newTrends: trendNotifications,
      };
      try {
        const registration = await navigator.serviceWorker.ready;
        registration.active?.postMessage({ type: notificationPrefsMessageType, payload });
        navigator.serviceWorker.controller?.postMessage({ type: notificationPrefsMessageType, payload });
      } catch {
        // Best effort only.
      }
    };

    void postPrefs();
  }, [notificationPrefsMessageType, notificationsEnabled, trendNotifications]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const onServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type !== topGamesUpdatedMessageType) return;
      setFreshTrendsNotice(true);
    };

    navigator.serviceWorker.addEventListener("message", onServiceWorkerMessage);
    return () => {
      navigator.serviceWorker.removeEventListener("message", onServiceWorkerMessage);
    };
  }, [setFreshTrendsNotice, topGamesUpdatedMessageType]);

  useEffect(() => {
    if (!notificationsEnabled || !reminderNotifications) return;
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") return;

      navigator.serviceWorker.ready
        .then((registration) => {
          registration.showNotification(t("messages.reminderTitle"), {
            body: t("messages.reminderBody"),
            tag: "pickagame-reminder",
          });
        })
        .catch(() => {
          // Ignore transient notification failures.
        });
    }, Math.max(15, reminderIntervalMinutes) * 60 * 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [notificationsEnabled, reminderIntervalMinutes, reminderNotifications, t]);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      const promptEvent = event as BeforeInstallPromptEvent;
      promptEvent.preventDefault();
      setInstallPrompt(promptEvent);
    };

    const onInstalled = () => {
      setInstallPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt as EventListener);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt as EventListener);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [setInstallPrompt]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;

    const refreshUpdateState = async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (cancelled) return;
        setSwUpdateReady(Boolean(registration?.waiting));
      } catch {
        if (cancelled) return;
        setSwUpdateReady(false);
      }
    };

    const onUpdateReady = () => {
      setDismissedUpdate(false);
      setUpdateInProgress(false);
      void refreshUpdateState();
    };

    const onControllerChange = () => {
      window.location.reload();
    };

    window.addEventListener(updateReadyEventName, onUpdateReady);
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    void refreshUpdateState();

    return () => {
      cancelled = true;
      window.removeEventListener(updateReadyEventName, onUpdateReady);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, [setDismissedUpdate, setSwUpdateReady, setUpdateInProgress, updateReadyEventName]);
};
