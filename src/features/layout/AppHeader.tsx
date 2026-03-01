import * as Tabs from "@radix-ui/react-tabs";
import { Download, History, Library, PanelLeft, Play, Settings2, WandSparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

type HeaderTab = "play" | "library" | "history" | "settings";
type ThemeMode = "system" | "light" | "dark" | "high-contrast";

interface AppHeaderProps {
  sidebarOpen: boolean;
  settingsSidebarVisible: boolean;
  activeTab: HeaderTab;
  settingsTabActive: boolean;
  themeMode: ThemeMode;
  installAvailable: boolean;
  onToggleSidebar: () => void;
  onOpenQuickTour: () => void;
  onInstall: () => void;
  onThemeModeChange: (value: ThemeMode) => void;
  onTabChange: (value: HeaderTab) => void;
}

export function AppHeader({
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
}: AppHeaderProps) {
  const { t, i18n } = useTranslation();

  return (
    <header className="hero">
      <p className="kicker">{t("appName")}</p>
      <h1>{t("heroTitle")}</h1>
      <p>{t("heroDescription")}</p>
      <div className="hero-actions">
        <button type="button" className="ghost" aria-controls="settings-sidebar" aria-expanded={settingsSidebarVisible} onClick={onToggleSidebar}>
          <span className="button-label">
            <PanelLeft className="ui-icon" aria-hidden="true" />
            {sidebarOpen ? t("hideSettings") : t("showSettings")}
          </span>
        </button>
        <button type="button" className="ghost" onClick={onOpenQuickTour}>
          <span className="button-label">
            <WandSparkles className="ui-icon" aria-hidden="true" />
            {t("quickTour")}
          </span>
        </button>
        {installAvailable ? (
          <button type="button" className="ghost" onClick={onInstall}>
            <span className="button-label">
              <Download className="ui-icon" aria-hidden="true" />
              {t("installApp")}
            </span>
          </button>
        ) : null}
        <label className="lang-picker">
          <span className="sr-only">{t("language.label")}</span>
          <select
            value={i18n.resolvedLanguage?.startsWith("es") ? "es" : "en"}
            onChange={(event) => {
              void i18n.changeLanguage(event.target.value);
            }}
          >
            <option value="en">{t("language.english")}</option>
            <option value="es">{t("language.spanish")}</option>
          </select>
        </label>
        <label className="theme-picker">
          <span className="sr-only">{t("theme.label")}</span>
          <select
            value={themeMode}
            onChange={(event) => {
              onThemeModeChange(event.target.value as ThemeMode);
            }}
          >
            <option value="system">{t("theme.system")}</option>
            <option value="light">{t("theme.light")}</option>
            <option value="dark">{t("theme.dark")}</option>
            <option value="high-contrast">{t("theme.highContrast")}</option>
          </select>
        </label>
      </div>
      <Tabs.Root
        value={settingsTabActive ? "settings" : activeTab}
        onValueChange={(value) => {
          if (value === "settings" || value === "play" || value === "library" || value === "history") {
            onTabChange(value);
          }
        }}
      >
        <Tabs.List className="task-nav" aria-label={t("workspaceSectionsAria")}>
          <Tabs.Trigger value="play" className="ghost task-trigger">
            <span className="button-label">
              <Play className="ui-icon" aria-hidden="true" />
              {t("tabs.play")}
            </span>
          </Tabs.Trigger>
          <Tabs.Trigger value="library" className="ghost task-trigger">
            <span className="button-label">
              <Library className="ui-icon" aria-hidden="true" />
              {t("tabs.library")}
            </span>
          </Tabs.Trigger>
          <Tabs.Trigger value="history" className="ghost task-trigger">
            <span className="button-label">
              <History className="ui-icon" aria-hidden="true" />
              {t("tabs.history")}
            </span>
          </Tabs.Trigger>
          <Tabs.Trigger value="settings" className="ghost task-trigger">
            <span className="button-label">
              <Settings2 className="ui-icon" aria-hidden="true" />
              {t("tabs.settings")}
            </span>
          </Tabs.Trigger>
        </Tabs.List>
      </Tabs.Root>
    </header>
  );
}
