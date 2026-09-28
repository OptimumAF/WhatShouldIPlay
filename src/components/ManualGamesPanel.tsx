import { List, Plus, Trash2 } from "lucide-react";
import type { ManualGameRecord } from "../lib/manualIdentity";

interface ManualGamesPanelProps {
  title: string;
  description: string;
  inputValue: string;
  onInputChange: (value: string) => void;
  onAdd: () => void;
  onClear: () => void;
  addLabel: string;
  clearLabel: string;
  placeholder: string;
  records: ManualGameRecord[];
  onRename: (id: string, name: string) => void;
  renameLabel: string;
  saveNameLabel: string;
}

export function ManualGamesPanel({
  title,
  description,
  inputValue,
  onInputChange,
  onAdd,
  onClear,
  addLabel,
  clearLabel,
  placeholder,
  records,
  onRename,
  renameLabel,
  saveNameLabel,
}: ManualGamesPanelProps) {
  return (
    <section className="panel secondary-panel" aria-labelledby="manual-heading">
      <h2 id="manual-heading" className="section-heading">
        <span className="heading-label">
          <List className="ui-icon" aria-hidden="true" />
          {title}
        </span>
      </h2>
      <p className="muted">{description}</p>
      <label htmlFor="manual-input" className="sr-only">
        {title}
      </label>
      <textarea
        id="manual-input"
        rows={5}
        value={inputValue}
        onChange={(event) => onInputChange(event.target.value)}
        placeholder={placeholder}
      />
      <div className="button-row">
        <button type="button" onClick={onAdd}>
          <span className="button-label">
            <Plus className="ui-icon" aria-hidden="true" />
            {addLabel}
          </span>
        </button>
        <button type="button" className="ghost" onClick={onClear}>
          <span className="button-label">
            <Trash2 className="ui-icon" aria-hidden="true" />
            {clearLabel}
          </span>
        </button>
      </div>
      {records.length > 0 ? (
        <ul className="manual-record-list">
          {records.map((record) => (
            <li key={record.id}>
              <form onSubmit={(event) => {
                event.preventDefault();
                const name = new FormData(event.currentTarget).get("name");
                if (typeof name === "string") onRename(record.id, name);
              }}>
                <input
                  key={`${record.id}:${record.name}`}
                  name="name"
                  type="text"
                  defaultValue={record.name}
                  aria-label={`${renameLabel} ${record.name}`}
                />
                <button type="submit" className="ghost compact">{saveNameLabel}</button>
              </form>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
