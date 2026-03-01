import { Ban, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { HelpTip } from "../../components/HelpTip";

interface ExclusionsPanelProps {
  excludePlayed: boolean;
  excludeCompleted: boolean;
  exclusionInput: string;
  playedGames: string[];
  completedGames: string[];
  onExcludePlayedChange: (value: boolean) => void;
  onExcludeCompletedChange: (value: boolean) => void;
  onExclusionInputChange: (value: string) => void;
  onAddPlayed: () => void;
  onAddCompleted: () => void;
  onRemovePlayed: (name: string) => void;
  onRemoveCompleted: (name: string) => void;
  onClearPlayed: () => void;
  onClearCompleted: () => void;
}

export function ExclusionsPanel({
  excludePlayed,
  excludeCompleted,
  exclusionInput,
  playedGames,
  completedGames,
  onExcludePlayedChange,
  onExcludeCompletedChange,
  onExclusionInputChange,
  onAddPlayed,
  onAddCompleted,
  onRemovePlayed,
  onRemoveCompleted,
  onClearPlayed,
  onClearCompleted,
}: ExclusionsPanelProps) {
  const { t } = useTranslation();
  const addDisabled = !exclusionInput.trim();

  return (
    <section className="panel" aria-labelledby="exclusion-heading">
      <h2 id="exclusion-heading" className="section-heading">
        <span className="heading-label">
          <Ban className="ui-icon" aria-hidden="true" />
          {t("playedCompletedTitle")}
        </span>
        <HelpTip text={t("helpTips.playedCompleted")} />
      </h2>
      <p className="muted">{t("playedCompletedDescription")}</p>
      <div className="odds-controls">
        <label className="inline-check">
          <input type="checkbox" checked={excludePlayed} onChange={(event) => onExcludePlayedChange(event.target.checked)} />
          <span>{t("excludePlayed")}</span>
          <HelpTip text={t("helpTips.excludePlayed")} />
        </label>
        <label className="inline-check">
          <input type="checkbox" checked={excludeCompleted} onChange={(event) => onExcludeCompletedChange(event.target.checked)} />
          <span>{t("excludeCompleted")}</span>
          <HelpTip text={t("helpTips.excludeCompleted")} />
        </label>
      </div>
      <label htmlFor="exclusion-input" className="sr-only">
        {t("gameNamesToExclude")}
      </label>
      <textarea
        id="exclusion-input"
        rows={3}
        value={exclusionInput}
        onChange={(event) => onExclusionInputChange(event.target.value)}
        placeholder={t("excludeInputPlaceholder")}
      />
      <div className="button-row">
        <button type="button" onClick={onAddPlayed} disabled={addDisabled}>
          <span className="button-label">
            <Plus className="ui-icon" aria-hidden="true" />
            {t("markPlayed")}
          </span>
        </button>
        <button type="button" className="ghost" onClick={onAddCompleted} disabled={addDisabled}>
          <span className="button-label">
            <Plus className="ui-icon" aria-hidden="true" />
            {t("markCompleted")}
          </span>
        </button>
      </div>
      <div className="exclude-grid">
        <div className="exclude-list">
          <strong>{t("playedCount", { count: playedGames.length })}</strong>
          {playedGames.length === 0 ? (
            <p className="muted">{t("noPlayedTracked")}</p>
          ) : (
            <ul>
              {playedGames.slice(0, 30).map((name) => (
                <li key={`played-${name}`}>
                  <span>{name}</span>
                  <button type="button" className="ghost compact" onClick={() => onRemovePlayed(name)}>
                    {t("remove")}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {playedGames.length > 0 ? (
            <button type="button" className="ghost compact" onClick={onClearPlayed}>
              {t("clearPlayed")}
            </button>
          ) : null}
        </div>
        <div className="exclude-list">
          <strong>{t("completedCount", { count: completedGames.length })}</strong>
          {completedGames.length === 0 ? (
            <p className="muted">{t("noCompletedTracked")}</p>
          ) : (
            <ul>
              {completedGames.slice(0, 30).map((name) => (
                <li key={`completed-${name}`}>
                  <span>{name}</span>
                  <button type="button" className="ghost compact" onClick={() => onRemoveCompleted(name)}>
                    {t("remove")}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {completedGames.length > 0 ? (
            <button type="button" className="ghost compact" onClick={onClearCompleted}>
              {t("clearCompleted")}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
