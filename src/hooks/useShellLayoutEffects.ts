import { useEffect } from "react";
import type { OnboardingStep, ThemeMode, WorkspaceTab } from "../lib/appConfig";

interface UseShellLayoutEffectsInput {
  themeMode: ThemeMode;
  setIsMobileLayout: (value: boolean) => void;
  activeTab: WorkspaceTab;
  setActiveTab: (value: WorkspaceTab) => void;
  isMobileLayout: boolean;
  showOnboarding: boolean;
  sidebarOpen: boolean;
  setSidebarOpen: (value: boolean) => void;
  onboardingStep: number;
  onboardingSteps: OnboardingStep[];
}

export const useShellLayoutEffects = ({
  themeMode,
  setIsMobileLayout,
  activeTab,
  setActiveTab,
  isMobileLayout,
  showOnboarding,
  sidebarOpen,
  setSidebarOpen,
  onboardingStep,
  onboardingSteps,
}: UseShellLayoutEffectsInput) => {
  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const applyTheme = () => {
      const resolvedTheme = themeMode === "system" ? (mediaQuery.matches ? "dark" : "light") : themeMode;
      root.dataset.theme = resolvedTheme;
    };

    applyTheme();
    if (themeMode !== "system") {
      return;
    }

    const onThemeChange = () => applyTheme();
    mediaQuery.addEventListener("change", onThemeChange);
    return () => {
      mediaQuery.removeEventListener("change", onThemeChange);
    };
  }, [themeMode]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 980px)");
    const applyLayoutMode = () => {
      setIsMobileLayout(mediaQuery.matches);
    };
    applyLayoutMode();
    mediaQuery.addEventListener("change", applyLayoutMode);
    return () => {
      mediaQuery.removeEventListener("change", applyLayoutMode);
    };
  }, [setIsMobileLayout]);

  useEffect(() => {
    if (activeTab !== "settings") return;
    setSidebarOpen(true);
    if (isMobileLayout && !showOnboarding) {
      setActiveTab("play");
    }
  }, [activeTab, isMobileLayout, setActiveTab, setSidebarOpen, showOnboarding]);

  useEffect(() => {
    if (!isMobileLayout || !sidebarOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileLayout, sidebarOpen]);

  useEffect(() => {
    if (!showOnboarding) return;
    const step = onboardingSteps[onboardingStep];
    if (!step) return;
    setActiveTab(step.focusTab);
    if (step.focusTab === "settings") {
      setSidebarOpen(true);
    }
  }, [onboardingStep, onboardingSteps, setActiveTab, setSidebarOpen, showOnboarding]);
};
