import { Suspense, lazy, type ComponentProps } from "react";
import { AppHeader } from "./AppHeader";
import { UpdateBanners } from "./UpdateBanners";
import { WorkspaceShell } from "./WorkspaceShell";
import type { OnboardingModalProps } from "./OnboardingModal";
import { ToastStack } from "./ToastStack";
import type { WinnerModalProps } from "../play/WinnerModal";
import type { SettingsContentProps } from "../settings/SettingsContent";
import { MainContentPanels, type MainContentPanelsProps } from "./MainContentPanels";

const LazySettingsContent = lazy(async () => import("../settings/SettingsContent").then((module) => ({ default: module.SettingsContent })));
const LazyOnboardingModal = lazy(async () => import("./OnboardingModal").then((module) => ({ default: module.OnboardingModal })));
const LazyWinnerModal = lazy(async () => import("../play/WinnerModal").then((module) => ({ default: module.WinnerModal })));

interface ScreenReaderAnnouncement {
  id: string | number;
  text: string;
}

export interface AppShellViewProps {
  skipToMainLabel: string;
  appHeaderProps: ComponentProps<typeof AppHeader>;
  updateBannerProps: ComponentProps<typeof UpdateBanners>;
  workspaceShellProps: Omit<ComponentProps<typeof WorkspaceShell>, "settingsContent" | "mainContent"> & {
    showSettingsPane: boolean;
  };
  settingsContentProps: SettingsContentProps;
  mainContentProps: MainContentPanelsProps;
  onboardingModalProps: OnboardingModalProps;
  toastStackProps: ComponentProps<typeof ToastStack>;
  winnerModalProps: WinnerModalProps;
  screenReaderPolite: ScreenReaderAnnouncement;
  screenReaderAssertive: ScreenReaderAnnouncement;
}

export function AppShellView({
  skipToMainLabel,
  appHeaderProps,
  updateBannerProps,
  workspaceShellProps,
  settingsContentProps,
  mainContentProps,
  onboardingModalProps,
  toastStackProps,
  winnerModalProps,
  screenReaderPolite,
  screenReaderAssertive,
}: AppShellViewProps) {
  return (
    <main className="layout">
      <a className="skip-link" href="#main-content">
        {skipToMainLabel}
      </a>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        <span key={screenReaderPolite.id}>{screenReaderPolite.text}</span>
      </div>
      <div className="sr-only" aria-live="assertive" aria-atomic="true">
        <span key={screenReaderAssertive.id}>{screenReaderAssertive.text}</span>
      </div>
      <AppHeader {...appHeaderProps} />
      <UpdateBanners {...updateBannerProps} />
      <WorkspaceShell
        {...workspaceShellProps}
        settingsContent={
          workspaceShellProps.showSettingsPane ? (
            <Suspense fallback={<div className="panel secondary-panel settings-loading-shell" aria-hidden="true" />}>
              <LazySettingsContent {...settingsContentProps} />
            </Suspense>
          ) : null
        }
        mainContent={<MainContentPanels {...mainContentProps} />}
      />
      {onboardingModalProps.show ? (
        <Suspense fallback={null}>
          <LazyOnboardingModal {...onboardingModalProps} />
        </Suspense>
      ) : null}
      <ToastStack {...toastStackProps} />
      {winnerModalProps.show ? (
        <Suspense fallback={null}>
          <LazyWinnerModal {...winnerModalProps} />
        </Suspense>
      ) : null}
    </main>
  );
}
