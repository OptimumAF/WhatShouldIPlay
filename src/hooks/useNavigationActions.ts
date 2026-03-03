import { useCallback } from "react";
import type { WorkspaceTab } from "../lib/appConfig";

type ToastTone = "info" | "success" | "error";

interface UseNavigationActionsInput {
  activeTab: WorkspaceTab;
  isMobileLayout: boolean;
  setShowOnboarding: (value: boolean) => void;
  setOnboardingStep: (value: number) => void;
  setActiveTab: (value: WorkspaceTab) => void;
  setSidebarOpen: (value: boolean | ((current: boolean) => boolean)) => void;
  pushToast: (tone: ToastTone, text: string) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
  onboardingStorageKey: string;
}

export const useNavigationActions = ({
  activeTab,
  isMobileLayout,
  setShowOnboarding,
  setOnboardingStep,
  setActiveTab,
  setSidebarOpen,
  pushToast,
  t,
  onboardingStorageKey,
}: UseNavigationActionsInput) => {
  const completeOnboarding = useCallback(
    (nextTab: WorkspaceTab = "play") => {
      setShowOnboarding(false);
      setOnboardingStep(0);
      setActiveTab(nextTab);
      if (nextTab === "settings") {
        setSidebarOpen(true);
      }
      localStorage.setItem(onboardingStorageKey, JSON.stringify(true));
      pushToast("success", t("messages.quickStartComplete"));
    },
    [onboardingStorageKey, pushToast, setActiveTab, setOnboardingStep, setShowOnboarding, setSidebarOpen, t],
  );

  const handleSidebarToggle = useCallback(
    () =>
      setSidebarOpen((current) => {
        const next = !current;
        if (!next && activeTab === "settings") {
          setActiveTab("play");
        }
        return next;
      }),
    [activeTab, setActiveTab, setSidebarOpen],
  );

  const handleOpenQuickTour = useCallback(() => {
    setOnboardingStep(0);
    setShowOnboarding(true);
  }, [setOnboardingStep, setShowOnboarding]);

  const handleHeaderTabChange = useCallback(
    (value: WorkspaceTab) => {
      if (value === "settings") {
        if (isMobileLayout) {
          setSidebarOpen(true);
          return;
        }
        setActiveTab("settings");
        return;
      }
      setActiveTab(value);
    },
    [isMobileLayout, setActiveTab, setSidebarOpen],
  );

  return {
    completeOnboarding,
    handleSidebarToggle,
    handleOpenQuickTour,
    handleHeaderTabChange,
  };
};
