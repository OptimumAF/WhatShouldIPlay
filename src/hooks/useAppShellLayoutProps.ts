import type { ComponentProps, RefObject } from "react";
import { AppHeader } from "../features/layout/AppHeader";
import { OnboardingModal } from "../features/layout/OnboardingModal";
import { ToastStack } from "../features/layout/ToastStack";
import { UpdateBanners } from "../features/layout/UpdateBanners";
import { WorkspaceShell } from "../features/layout/WorkspaceShell";
import { WinnerModal } from "../features/play/WinnerModal";
import type { WorkspaceTab } from "../lib/appConfig";

type TranslateFn = (key: string) => string;
type ThemeMode = ComponentProps<typeof AppHeader>["themeMode"];
type HeaderTab = ComponentProps<typeof AppHeader>["activeTab"];
type WinnerMeta = ComponentProps<typeof WinnerModal>["winnerMeta"];
type ToastItems = ComponentProps<typeof ToastStack>["toasts"];
type OnboardingSteps = ComponentProps<typeof OnboardingModal>["steps"];
type SourceFormatter = ComponentProps<typeof WinnerModal>["formatSourceList"];
type OddsFormatter = ComponentProps<typeof WinnerModal>["formatOdds"];

interface ScreenReaderAnnouncement {
  id: string | number;
  text: string;
}

interface UseAppShellLayoutPropsInput {
  t: TranslateFn;
  sidebarOpen: boolean;
  settingsSidebarVisible: boolean;
  activeTab: HeaderTab;
  settingsTabActive: boolean;
  themeMode: ThemeMode;
  installAvailable: boolean;
  swUpdateReady: boolean;
  dismissedUpdate: boolean;
  updateInProgress: boolean;
  freshTrendsNotice: boolean;
  settingsSheetMode: boolean;
  showSettingsPane: boolean;
  showOnboarding: boolean;
  onboardingStep: number;
  onboardingSteps: OnboardingSteps;
  toasts: ToastItems;
  winner: string;
  winnerMeta: WinnerMeta;
  winnerPulse: number;
  showWinnerPopup: boolean;
  winnerPopupRef: RefObject<HTMLDivElement | null>;
  winnerPopupCloseRef: RefObject<HTMLButtonElement | null>;
  onboardingCardRef: RefObject<HTMLDivElement | null>;
  screenReaderPolite: ScreenReaderAnnouncement;
  screenReaderAssertive: ScreenReaderAnnouncement;
  onToggleSidebar: () => void;
  onOpenQuickTour: () => void;
  onInstall: () => void;
  onThemeModeChange: (value: ThemeMode) => void;
  onTabChange: (value: HeaderTab) => void;
  onApplyServiceWorkerUpdate: () => void;
  onDismissUpdate: () => void;
  onDismissFreshTrends: () => void;
  onCloseSettings: () => void;
  onStepSelect: (index: number) => void;
  onSkipOnboarding: () => void;
  onBackOnboarding: () => void;
  onNextOnboarding: () => void;
  onFinishOnboarding: () => void;
  onDismissToast: (id: string) => void;
  formatSourceList: SourceFormatter;
  formatOdds: OddsFormatter;
  onCloseWinner: () => void;
  onMarkWinnerPlayed: () => void;
  onMarkWinnerCompleted: () => void;
}

interface UseAppShellLayoutPropsOutput {
  skipToMainLabel: string;
  appHeaderProps: ComponentProps<typeof AppHeader>;
  updateBannerProps: ComponentProps<typeof UpdateBanners>;
  workspaceShellProps: Omit<ComponentProps<typeof WorkspaceShell>, "settingsContent" | "mainContent">;
  onboardingModalProps: ComponentProps<typeof OnboardingModal>;
  toastStackProps: ComponentProps<typeof ToastStack>;
  winnerModalProps: ComponentProps<typeof WinnerModal>;
  screenReaderPolite: ScreenReaderAnnouncement;
  screenReaderAssertive: ScreenReaderAnnouncement;
}

export const useAppShellLayoutProps = ({
  t,
  sidebarOpen,
  settingsSidebarVisible,
  activeTab,
  settingsTabActive,
  themeMode,
  installAvailable,
  swUpdateReady,
  dismissedUpdate,
  updateInProgress,
  freshTrendsNotice,
  settingsSheetMode,
  showSettingsPane,
  showOnboarding,
  onboardingStep,
  onboardingSteps,
  toasts,
  winner,
  winnerMeta,
  winnerPulse,
  showWinnerPopup,
  winnerPopupRef,
  winnerPopupCloseRef,
  onboardingCardRef,
  screenReaderPolite,
  screenReaderAssertive,
  onToggleSidebar,
  onOpenQuickTour,
  onInstall,
  onThemeModeChange,
  onTabChange,
  onApplyServiceWorkerUpdate,
  onDismissUpdate,
  onDismissFreshTrends,
  onCloseSettings,
  onStepSelect,
  onSkipOnboarding,
  onBackOnboarding,
  onNextOnboarding,
  onFinishOnboarding,
  onDismissToast,
  formatSourceList,
  formatOdds,
  onCloseWinner,
  onMarkWinnerPlayed,
  onMarkWinnerCompleted,
}: UseAppShellLayoutPropsInput): UseAppShellLayoutPropsOutput => {
  const appHeaderProps: ComponentProps<typeof AppHeader> = {
    sidebarOpen,
    settingsSidebarVisible,
    activeTab,
    settingsTabActive,
    themeMode,
    installAvailable,
    onToggleSidebar,
    onOpenQuickTour,
    onInstall,
    onThemeModeChange,
    onTabChange,
  };

  const updateBannerProps: ComponentProps<typeof UpdateBanners> = {
    swUpdateReady,
    dismissedUpdate,
    updateInProgress,
    freshTrendsNotice,
    onApplyServiceWorkerUpdate,
    onDismissUpdate,
    onDismissFreshTrends,
  };

  const workspaceShellProps: Omit<ComponentProps<typeof WorkspaceShell>, "settingsContent" | "mainContent"> = {
    settingsSheetMode,
    hideSettingsLabel: t("hideSettings"),
    onCloseSettings,
    settingsSidebarVisible,
    showSettingsPane,
    activeTab: activeTab as WorkspaceTab,
    gameSettingsAriaLabel: t("gameSettingsAria"),
    settingsSheetTitle: t("settingsSheetTitle"),
  };

  const onboardingModalProps: ComponentProps<typeof OnboardingModal> = {
    show: showOnboarding,
    onboardingCardRef,
    steps: onboardingSteps,
    currentStep: onboardingStep,
    onStepSelect,
    onSkip: onSkipOnboarding,
    onBack: onBackOnboarding,
    onNext: onNextOnboarding,
    onFinish: onFinishOnboarding,
  };

  const toastStackProps: ComponentProps<typeof ToastStack> = {
    toasts,
    onDismiss: onDismissToast,
  };

  const winnerModalProps: ComponentProps<typeof WinnerModal> = {
    show: showWinnerPopup,
    winner,
    winnerMeta,
    winnerPulse,
    winnerPopupRef,
    winnerPopupCloseRef,
    formatSourceList,
    formatOdds,
    onClose: onCloseWinner,
    onMarkPlayed: onMarkWinnerPlayed,
    onMarkCompleted: onMarkWinnerCompleted,
  };

  return {
    skipToMainLabel: t("skipToMain"),
    appHeaderProps,
    updateBannerProps,
    workspaceShellProps,
    onboardingModalProps,
    toastStackProps,
    winnerModalProps,
    screenReaderPolite,
    screenReaderAssertive,
  };
};
