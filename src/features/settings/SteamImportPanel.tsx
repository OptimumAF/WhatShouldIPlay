import { Download, KeyRound, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { HelpTip } from "../../components/HelpTip";

interface SteamImportPanelProps {
  steamApiKey: string;
  steamId: string;
  steamImportLoading: boolean;
  steamImportStatus: string;
  onSteamApiKeyChange: (value: string) => void;
  onSteamIdChange: (value: string) => void;
  onImport: () => void;
  onClear: () => void;
}

export function SteamImportPanel({
  steamApiKey,
  steamId,
  steamImportLoading,
  steamImportStatus,
  onSteamApiKeyChange,
  onSteamIdChange,
  onImport,
  onClear,
}: SteamImportPanelProps) {
  const { t } = useTranslation();

  return (
    <section className="panel" aria-labelledby="steam-import-heading">
      <h2 id="steam-import-heading" className="section-heading">
        <span className="heading-label">
          <KeyRound className="ui-icon" aria-hidden="true" />
          {t("steamImportTitle")}
        </span>
        <HelpTip text={t("helpTips.steamImport")} />
      </h2>
      <p className="muted">{t("steamImportDescription")}</p>
      <div className="steam-grid">
        <label htmlFor="steam-api-key" className="sr-only">
          {t("steamApiKey")}
        </label>
        <input
          id="steam-api-key"
          type="password"
          placeholder={t("steamApiKey")}
          value={steamApiKey}
          onChange={(event) => onSteamApiKeyChange(event.target.value)}
          autoComplete="off"
        />
        <label htmlFor="steam-id64" className="sr-only">
          {t("steamId64")}
        </label>
        <input
          id="steam-id64"
          type="text"
          placeholder={t("steamId64")}
          value={steamId}
          onChange={(event) => onSteamIdChange(event.target.value)}
          autoComplete="off"
        />
      </div>
      <div className="button-row">
        <button type="button" onClick={onImport} disabled={steamImportLoading} aria-describedby="steam-import-status">
          <span className="button-label">
            <Download className="ui-icon" aria-hidden="true" />
            {steamImportLoading ? t("importing") : t("importSteamLibrary")}
          </span>
        </button>
        <button type="button" className="ghost" onClick={onClear}>
          <span className="button-label">
            <Trash2 className="ui-icon" aria-hidden="true" />
            {t("clearImport")}
          </span>
        </button>
      </div>
      {steamImportLoading ? (
        <p className="status progress-status" role="status" aria-live="polite">
          <span className="progress-dot" aria-hidden="true" />
          {t("steamImportingStatus")}
        </p>
      ) : null}
      {steamImportStatus ? (
        <p id="steam-import-status" className="status" role="status" aria-live="polite">
          {steamImportStatus}
        </p>
      ) : null}
    </section>
  );
}
