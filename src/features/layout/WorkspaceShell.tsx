import type { ReactNode } from "react";
import clsx from "clsx";
import { X } from "lucide-react";

interface WorkspaceShellProps {
  settingsSheetMode: boolean;
  hideSettingsLabel: string;
  onCloseSettings: () => void;
  settingsSidebarVisible: boolean;
  showSettingsPane: boolean;
  activeTab: string;
  gameSettingsAriaLabel: string;
  settingsSheetTitle: string;
  settingsContent: ReactNode;
  mainContent: ReactNode;
}

export function WorkspaceShell({
  settingsSheetMode,
  hideSettingsLabel,
  onCloseSettings,
  settingsSidebarVisible,
  showSettingsPane,
  activeTab,
  gameSettingsAriaLabel,
  settingsSheetTitle,
  settingsContent,
  mainContent,
}: WorkspaceShellProps) {
  return (
    <>
      {settingsSheetMode ? (
        <button type="button" className="settings-sheet-backdrop" aria-label={hideSettingsLabel} onClick={onCloseSettings} />
      ) : null}

      <div
        className={clsx(
          "workspace",
          !settingsSidebarVisible && "sidebar-collapsed",
          !showSettingsPane && "settings-tab-hidden",
          `tab-${activeTab}`,
        )}
        id="main-content"
      >
        <aside
          id="settings-sidebar"
          aria-label={gameSettingsAriaLabel}
          className={clsx("settings-sidebar", !settingsSidebarVisible && "is-collapsed")}
          role={settingsSheetMode ? "dialog" : undefined}
          aria-modal={settingsSheetMode ? true : undefined}
        >
          {settingsSheetMode ? (
            <div className="settings-sheet-head">
              <strong>{settingsSheetTitle}</strong>
              <button type="button" className="ghost compact settings-sheet-close" onClick={onCloseSettings}>
                <span className="button-label">
                  <X className="ui-icon" aria-hidden="true" />
                  {hideSettingsLabel}
                </span>
              </button>
            </div>
          ) : null}
          {settingsContent}
        </aside>

        <div className="content-stack">{mainContent}</div>
      </div>
    </>
  );
}
