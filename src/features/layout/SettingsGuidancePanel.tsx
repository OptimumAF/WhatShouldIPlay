import { Settings2 } from "lucide-react";
import { useTranslation } from "react-i18next";

export function SettingsGuidancePanel() {
  const { t } = useTranslation();

  return (
    <section className="panel" aria-label={t("settingsGuidanceAria")}>
      <h2 className="section-heading">
        <span className="heading-label">
          <Settings2 className="ui-icon" aria-hidden="true" />
          {t("settingsGuidanceTitle")}
        </span>
      </h2>
      <p className="muted">{t("settingsGuidanceDescription")}</p>
    </section>
  );
}
