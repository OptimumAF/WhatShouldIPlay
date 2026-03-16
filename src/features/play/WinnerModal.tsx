import type { RefObject } from "react";
import { useTranslation } from "react-i18next";
import { SourceAccentChips } from "../../components/SourceAccentChips";
import type { SourceId } from "../../types";

interface WinnerMeta {
  sources: SourceId[];
  odds: number;
  appId?: number;
  url?: string;
}

export interface WinnerModalProps {
  show: boolean;
  winner: string;
  winnerMeta: WinnerMeta | null;
  winnerPulse: number;
  winnerPopupRef: RefObject<HTMLDivElement | null>;
  winnerPopupCloseRef: RefObject<HTMLButtonElement | null>;
  formatSourceList: (sources: SourceId[]) => string;
  formatOdds: (odds: number) => string;
  onClose: () => void;
  onMarkPlayed: () => void;
  onMarkCompleted: () => void;
}

export function WinnerModal({
  show,
  winner,
  winnerMeta,
  winnerPulse,
  winnerPopupRef,
  winnerPopupCloseRef,
  formatSourceList,
  formatOdds,
  onClose,
  onMarkPlayed,
  onMarkCompleted,
}: WinnerModalProps) {
  const { t } = useTranslation();

  if (!show || !winner || !winnerMeta) {
    return null;
  }

  return (
    <div className="winner-overlay" onClick={onClose}>
      <div
        ref={winnerPopupRef}
        className="winner-popup"
        key={winnerPulse}
        role="dialog"
        aria-modal="true"
        aria-labelledby="winner-title"
        aria-describedby="winner-description"
        onClick={(event) => event.stopPropagation()}
        tabIndex={-1}
      >
        <div className="winner-glow" />
        <div className="winner-burst winner-burst-a" aria-hidden="true" />
        <div className="winner-burst winner-burst-b" aria-hidden="true" />
        <p className="winner-tag">{t("winner")}</p>
        <h3 id="winner-title">{winner}</h3>
        <SourceAccentChips sources={winnerMeta.sources} formatSourceLabel={formatSourceList} />
        <div className="winner-moment-grid">
          <div>
            <span>{t("spinOdds")}</span>
            <strong>{formatOdds(winnerMeta.odds)}</strong>
          </div>
          <div>
            <span>{t("sourceLabel")}</span>
            <strong>{formatSourceList(winnerMeta.sources)}</strong>
          </div>
        </div>
        <p id="winner-description">{t("commitNow")}</p>
        <div className="button-row">
          {winnerMeta.appId ? (
            <a className="button-link" href={`https://store.steampowered.com/app/${winnerMeta.appId}/`} target="_blank" rel="noreferrer">
              {t("openSteam")}
            </a>
          ) : null}
          {winnerMeta.url ? (
            <a className="button-link ghost-link" href={winnerMeta.url} target="_blank" rel="noreferrer">
              {t("viewSource")}
            </a>
          ) : null}
          <button type="button" className="ghost" onClick={onMarkPlayed}>
            {t("winnerActions.played")}
          </button>
          <button type="button" className="ghost" onClick={onMarkCompleted}>
            {t("winnerActions.completed")}
          </button>
          <button type="button" onClick={onClose} ref={winnerPopupCloseRef}>
            {t("nice")}
          </button>
        </div>
      </div>
    </div>
  );
}
