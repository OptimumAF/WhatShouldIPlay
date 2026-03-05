import type { ComponentProps } from "react";
import { AppHeader } from "./AppHeader";
import { UpdateBanners } from "./UpdateBanners";
import { WorkspaceShell } from "./WorkspaceShell";
import { OnboardingModal } from "./OnboardingModal";
import { ToastStack } from "./ToastStack";
import { WinnerModal } from "../play/WinnerModal";
import { SettingsContent, type SettingsContentProps } from "../settings/SettingsContent";
import { MainContentPanels, type MainContentPanelsProps } from "./MainContentPanels";

interface ScreenReaderAnnouncement {
  id: string | number;
  text: string;
}

export interface AppShellViewProps {
  skipToMainLabel: string;
  appHeaderProps: ComponentProps<typeof AppHeader>;
  updateBannerProps: ComponentProps<typeof UpdateBanners>;
  workspaceShellProps: Omit<ComponentProps<typeof WorkspaceShell>, "settingsContent" | "mainContent">;
  settingsContentProps: SettingsContentProps;
  mainContentProps: MainContentPanelsProps;
  onboardingModalProps: ComponentProps<typeof OnboardingModal>;
  toastStackProps: ComponentProps<typeof ToastStack>;
  winnerModalProps: ComponentProps<typeof WinnerModal>;
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
        settingsContent={<SettingsContent {...settingsContentProps} />}
        mainContent={<MainContentPanels {...mainContentProps} />}
      />
      <OnboardingModal {...onboardingModalProps} />
      <ToastStack {...toastStackProps} />
      <WinnerModal {...winnerModalProps} />
    </main>
  );
}
