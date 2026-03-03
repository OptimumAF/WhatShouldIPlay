import { useCallback, useEffect, useRef, useState } from "react";
import type { ScreenReaderAnnouncement, ToastMessage } from "../lib/appConfig";

export const useFeedbackCenter = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [screenReaderPolite, setScreenReaderPolite] = useState<ScreenReaderAnnouncement>({ id: 0, text: "" });
  const [screenReaderAssertive, setScreenReaderAssertive] = useState<ScreenReaderAnnouncement>({ id: 0, text: "" });
  const toastTimeoutsRef = useRef<number[]>([]);
  const announcementCounterRef = useRef(0);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const announceForScreenReader = useCallback((tone: ToastMessage["tone"], text: string) => {
    const cleaned = text.trim();
    if (!cleaned) return;
    announcementCounterRef.current += 1;
    const payload = { id: announcementCounterRef.current, text: cleaned };
    if (tone === "error") {
      setScreenReaderAssertive(payload);
      return;
    }
    setScreenReaderPolite(payload);
  }, []);

  const pushToast = useCallback(
    (tone: ToastMessage["tone"], text: string) => {
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setToasts((current) => [...current, { id, tone, text }]);
      announceForScreenReader(tone, text);
      const timeoutId = window.setTimeout(() => {
        dismissToast(id);
      }, 5200);
      toastTimeoutsRef.current.push(timeoutId);
    },
    [announceForScreenReader, dismissToast],
  );

  useEffect(() => {
    return () => {
      toastTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
      toastTimeoutsRef.current = [];
    };
  }, []);

  return {
    toasts,
    screenReaderPolite,
    screenReaderAssertive,
    dismissToast,
    announceForScreenReader,
    pushToast,
  };
};
