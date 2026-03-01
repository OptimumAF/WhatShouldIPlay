import clsx from "clsx";
import { useTranslation } from "react-i18next";

interface ToastItem {
  id: string;
  tone: "info" | "success" | "error";
  text: string;
}

interface ToastStackProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export function ToastStack({ toasts, onDismiss }: ToastStackProps) {
  const { t } = useTranslation();

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="toast-stack" role="status" aria-live="polite" aria-label={t("toastRegionLabel")}>
      {toasts.map((toast) => (
        <div key={toast.id} className={clsx("toast", toast.tone)}>
          <p>{toast.text}</p>
          <button type="button" className="ghost compact" onClick={() => onDismiss(toast.id)}>
            {t("dismissToast")}
          </button>
        </div>
      ))}
    </div>
  );
}
