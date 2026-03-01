import * as Accordion from "@radix-ui/react-accordion";
import { ChevronsUpDown, Settings2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { HelpTip } from "../../components/HelpTip";

interface AdvancedOptionsPanelProps {
  showAdvancedSettings: boolean;
  onShowAdvancedSettingsChange: (value: boolean) => void;
}

export function AdvancedOptionsPanel({
  showAdvancedSettings,
  onShowAdvancedSettingsChange,
}: AdvancedOptionsPanelProps) {
  const { t } = useTranslation();

  return (
    <section className="panel" aria-labelledby="advanced-filters-heading">
      <h2 id="advanced-filters-heading" className="section-heading">
        <span className="heading-label">
          <Settings2 className="ui-icon" aria-hidden="true" />
          {t("advancedOptionsTitle")}
        </span>
        <HelpTip text={t("helpTips.advancedControls")} />
      </h2>
      <p className="muted">{t("advancedOptionsDescription")}</p>
      <Accordion.Root
        type="single"
        collapsible
        value={showAdvancedSettings ? "advanced" : undefined}
        onValueChange={(value) => onShowAdvancedSettingsChange(value === "advanced")}
      >
        <Accordion.Item value="advanced" className="advanced-toggle-item">
          <Accordion.Header className="sr-only">{t("advancedSettingsToggleLabel")}</Accordion.Header>
          <Accordion.Trigger className="ghost advanced-toggle-trigger" aria-controls="advanced-settings-stack">
            <span className="button-label">
              <ChevronsUpDown className="ui-icon" aria-hidden="true" />
              {showAdvancedSettings ? t("hideAdvancedOptions") : t("showAdvancedOptions")}
            </span>
          </Accordion.Trigger>
        </Accordion.Item>
      </Accordion.Root>
    </section>
  );
}
