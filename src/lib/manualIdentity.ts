import { normalizeGames } from "./wheel";

export interface ManualGameRecord {
  id: string;
  name: string;
}

const nameKey = (name: string) => name.trim().toLowerCase();

const newManualId = () =>
  `manual:${typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`}`;

export const createManualRecord = (name: string): ManualGameRecord => ({ id: newManualId(), name: name.trim() });

export const sanitizeManualRecords = (raw: unknown, legacyNames: string[]): ManualGameRecord[] => {
  if (!Array.isArray(raw)) return normalizeGames(legacyNames).map(createManualRecord);
  const seen = new Set<string>();
  const records: ManualGameRecord[] = [];
  for (const value of raw) {
    if (!value || typeof value !== "object") continue;
    const entry = value as Record<string, unknown>;
    if (typeof entry.name !== "string") continue;
    const name = entry.name.trim();
    if (!name) continue;
    let id = typeof entry.id === "string" && /^manual:[a-zA-Z0-9-]+$/.test(entry.id)
      ? entry.id
      : newManualId();
    while (seen.has(id)) id = newManualId();
    seen.add(id);
    records.push({ id, name });
  }
  if (raw.length > 0 && records.length === 0) return normalizeGames(legacyNames).map(createManualRecord);
  return records;
};

export const reconcileManualNames = (current: ManualGameRecord[], names: string[]): ManualGameRecord[] => {
  const used = new Set<string>();
  return names.map((name) => name.trim()).filter(Boolean).map((name) => {
    const existing = current.find((record) => !used.has(record.id) && nameKey(record.name) === nameKey(name));
    if (existing) {
      used.add(existing.id);
      return { ...existing, name };
    }
    return createManualRecord(name);
  });
};

export const uniqueManualIdForName = (records: ManualGameRecord[], name: string): string | undefined => {
  const matches = records.filter((record) => nameKey(record.name) === nameKey(name));
  return matches.length === 1 ? matches[0].id : undefined;
};

export const attachLegacyManualHistoryIds = <T extends { id?: string; name: string; sources: string[] }>(
  history: T[], records: ManualGameRecord[],
): T[] => history.map((item) => {
  if (item.id || !item.sources.includes("manual")) return item;
  const id = uniqueManualIdForName(records, item.name);
  return id ? { ...item, id } : item;
});
