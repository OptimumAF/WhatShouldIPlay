import type { GameEntry } from "../types";

// Name-only observations remain scoped to their source until a provider ID can establish a match.
export const gameIdentity = (entry: Pick<GameEntry, "source" | "name" | "appId" | "id">): string =>
  entry.source === "manual" && entry.id?.startsWith("manual:")
    ? entry.id
    : Number.isSafeInteger(entry.appId) && (entry.appId ?? 0) > 0
    ? `steam:${entry.appId}`
    : `source:${entry.source}:${entry.name.trim().toLowerCase()}`;
