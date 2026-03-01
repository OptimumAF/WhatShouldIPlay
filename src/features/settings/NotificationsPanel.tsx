import { BellRing } from "lucide-react";
import { useTranslation } from "react-i18next";
import { HelpTip } from "../../components/HelpTip";

interface NotificationsPanelProps {
  notificationsEnabled: boolean;
  trendNotifications: boolean;
  reminderNotifications: boolean;
  reminderIntervalMinutes: number;
  notificationStatus: string;
  onNotificationsEnabledChange: (value: boolean) => void;
  onTrendNotificationsChange: (value: boolean) => void;
  onReminderNotificationsChange: (value: boolean) => void;
  onReminderIntervalChange: (value: number) => void;
}

export function NotificationsPanel({
  notificationsEnabled,
  trendNotifications,
  reminderNotifications,
  reminderIntervalMinutes,
  notificationStatus,
  onNotificationsEnabledChange,
  onTrendNotificationsChange,
  onReminderNotificationsChange,
  onReminderIntervalChange,
}: NotificationsPanelProps) {
  const { t } = useTranslation();

  return (
    <section className="panel" aria-labelledby="notification-heading">
      <h2 id="notification-heading" className="section-heading">
        <span className="heading-label">
          <BellRing className="ui-icon" aria-hidden="true" />
          {t("notificationsTitle")}
        </span>
        <HelpTip text={t("helpTips.notifications")} />
      </h2>
      <p className="muted">{t("notificationsDescription")}</p>
      <div className="odds-controls">
        <label className="inline-check">
          <input type="checkbox" checked={notificationsEnabled} onChange={(event) => onNotificationsEnabledChange(event.target.checked)} />
          <span>{t("notificationsEnabled")}</span>
          <HelpTip text={t("helpTips.notificationsPermission")} />
        </label>
        <label className="inline-check">
          <input
            type="checkbox"
            checked={trendNotifications}
            disabled={!notificationsEnabled}
            onChange={(event) => onTrendNotificationsChange(event.target.checked)}
          />
          <span>{t("newTrendsAlerts")}</span>
          <HelpTip text={t("helpTips.trendAlerts")} />
        </label>
        <label className="inline-check">
          <input
            type="checkbox"
            checked={reminderNotifications}
            disabled={!notificationsEnabled}
            onChange={(event) => onReminderNotificationsChange(event.target.checked)}
          />
          <span>{t("spinReminders")}</span>
          <HelpTip text={t("helpTips.spinReminders")} />
        </label>
        <label className="cooldown-control">
          <span>{t("reminderInterval")}</span>
          <HelpTip text={t("helpTips.reminderInterval")} />
          <input
            type="range"
            min={15}
            max={720}
            step={15}
            disabled={!notificationsEnabled || !reminderNotifications}
            value={reminderIntervalMinutes}
            onChange={(event) => onReminderIntervalChange(Number(event.target.value))}
          />
          <strong>{reminderIntervalMinutes}</strong>
        </label>
      </div>
      {notificationStatus ? (
        <p className="status" role="status" aria-live="polite">
          {notificationStatus}
        </p>
      ) : null}
    </section>
  );
}
