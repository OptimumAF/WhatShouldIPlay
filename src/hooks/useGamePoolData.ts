import { useEffect, useMemo, type Dispatch, type SetStateAction } from "react";
import {
  defaultFilters,
  defaultSourceWeights,
  gameWeight,
  sourceKeys,
  type AdvancedFilters,
  type EnabledSources,
  type PoolGame,
  type GameStatusRecord,
  type SourceToggleKey,
  type SourceWeights,
  type SpinHistoryItem,
} from "../lib/appConfig";
import type { GameEntry, TopGamesPayload } from "../types";
import { gameIdentity } from "../lib/gameIdentity";
import type { ManualGameRecord } from "../lib/manualIdentity";
import { observeGameSources } from "../lib/gameObservations";

interface UseGamePoolDataInput {
  topGames: TopGamesPayload | undefined;
  manualRecords: ManualGameRecord[];
  steamImportGames: GameEntry[];
  enabledSources: EnabledSources;
  sourceWeights: SourceWeights;
  weightedMode: boolean;
  playedGames: string[];
  completedGames: string[];
  playedRecords: GameStatusRecord[];
  completedRecords: GameStatusRecord[];
  spinHistory: SpinHistoryItem[];
  adaptiveRecommendations: boolean;
  filters: AdvancedFilters;
  setFilters: Dispatch<SetStateAction<AdvancedFilters>>;
  excludePlayed: boolean;
  excludeCompleted: boolean;
  cooldownSpins: number;
}

export const useGamePoolData = ({
  topGames,
  manualRecords,
  steamImportGames,
  enabledSources,
  sourceWeights,
  weightedMode,
  playedGames,
  completedGames,
  playedRecords,
  completedRecords,
  spinHistory,
  adaptiveRecommendations,
  filters,
  setFilters,
  excludePlayed,
  excludeCompleted,
  cooldownSpins,
}: UseGamePoolDataInput) => {
  const manualEntries = useMemo<GameEntry[]>(
    () =>
      manualRecords.map((record, index) => ({
        id: record.id,
        name: record.name,
        source: "manual",
        rank: index + 1,
      })),
    [manualRecords],
  );

  const allEntries = useMemo<GameEntry[]>(() => {
    const entries: GameEntry[] = [];
    if (topGames) {
      entries.push(...topGames.sources.steamcharts.games);
      entries.push(...topGames.sources.steamdb.games);
      entries.push(...topGames.sources.twitchmetrics.games);
      entries.push(...topGames.sources.itchio.games);
    }
    entries.push(...manualEntries);
    entries.push(...steamImportGames);
    return entries;
  }, [manualEntries, steamImportGames, topGames]);

  const basePool = useMemo<PoolGame[]>(() => {
    const byId = new Map<string, Omit<PoolGame, "observations">>();

    for (const entry of allEntries) {
      const source = entry.source as SourceToggleKey;
      if (!sourceKeys.includes(source) || !enabledSources[source]) continue;
      const cleaned = entry.name.trim();
      if (!cleaned) continue;
      const key = gameIdentity({ ...entry, name: cleaned });
      const computedWeight = gameWeight(entry, sourceWeights, weightedMode);
      const current = byId.get(key);
      if (current) {
        current.weight += computedWeight;
        if (!current.sources.includes(entry.source)) {
          current.sources.push(entry.source);
        }
        current.appId ||= entry.appId;
        current.url ||= entry.url;
        if (entry.platforms?.length) {
          current.platforms = [...new Set([...(current.platforms ?? []), ...entry.platforms])];
        }
        if (entry.tags?.length) {
          current.tags = [...new Set([...(current.tags ?? []), ...entry.tags])];
        }
        current.releaseDate ||= entry.releaseDate;
        current.priceUsd = current.priceUsd ?? entry.priceUsd;
        if (typeof current.isFree !== "boolean") {
          current.isFree = entry.isFree;
        }
        current.estimatedLength ||= entry.estimatedLength;
      } else {
        byId.set(key, {
          id: key,
          name: cleaned,
          sources: [entry.source],
          weight: computedWeight,
          appId: entry.appId,
          url: entry.url,
          platforms: entry.platforms,
          tags: entry.tags,
          releaseDate: entry.releaseDate,
          priceUsd: entry.priceUsd,
          isFree: entry.isFree,
          estimatedLength: entry.estimatedLength,
        });
      }
    }

    return [...byId.values()].map((entry) => ({
      ...entry,
      observations: observeGameSources(entry.sources),
    }));
  }, [allEntries, enabledSources, sourceWeights, weightedMode]);

  const sourceBehaviorMultipliers = useMemo<SourceWeights>(() => {
    const scores = sourceKeys.reduce<Record<SourceToggleKey, number>>(
      (accumulator, source) => ({ ...accumulator, [source]: 0 }),
      {} as Record<SourceToggleKey, number>,
    );
    const sourcesByName = new Map<string, Set<SourceToggleKey>>();

    allEntries.forEach((entry) => {
      const source = entry.source as SourceToggleKey;
      if (!sourceKeys.includes(source)) return;
      const key = entry.name.trim().toLowerCase();
      if (!key) return;
      if (!sourcesByName.has(key)) {
        sourcesByName.set(key, new Set<SourceToggleKey>());
      }
      sourcesByName.get(key)?.add(source);
    });

    const addNamedSignal = (names: string[], scoreDelta: number) => {
      names.forEach((name) => {
        const key = name.trim().toLowerCase();
        if (!key) return;
        const sources = sourcesByName.get(key);
        if (!sources) return;
        sources.forEach((source) => {
          scores[source] += scoreDelta;
        });
      });
    };

    addNamedSignal(playedGames, 1.4);
    addNamedSignal(completedGames, 2.2);
    const sourcesById = new Map<string, Set<SourceToggleKey>>();
    allEntries.forEach((entry) => {
      const source = entry.source as SourceToggleKey;
      if (!sourceKeys.includes(source)) return;
      const id = gameIdentity(entry);
      if (!sourcesById.has(id)) sourcesById.set(id, new Set());
      sourcesById.get(id)?.add(source);
    });
    const addIdentifiedSignal = (records: GameStatusRecord[], scoreDelta: number) => {
      records.forEach((record) => sourcesById.get(record.id)?.forEach((source) => { scores[source] += scoreDelta; }));
    };
    addIdentifiedSignal(playedRecords, 1.4);
    addIdentifiedSignal(completedRecords, 2.2);

    spinHistory.slice(0, 20).forEach((entry, index) => {
      const recency = Math.max(0.22, 1 - index / 24);
      entry.sources.forEach((source) => {
        const key = source as SourceToggleKey;
        if (!sourceKeys.includes(key)) return;
        scores[key] += 0.55 * recency;
      });
    });

    const maxScore = Math.max(0, ...Object.values(scores));
    if (maxScore <= 0) {
      return sourceKeys.reduce<SourceWeights>(
        (accumulator, source) => ({ ...accumulator, [source]: 1 }),
        {} as SourceWeights,
      );
    }

    return sourceKeys.reduce<SourceWeights>((accumulator, source) => {
      const normalized = scores[source] / maxScore;
      const multiplier = Number((0.78 + normalized * 0.62).toFixed(2));
      return {
        ...accumulator,
        [source]: Math.max(0.72, Math.min(1.45, multiplier)),
      };
    }, {} as SourceWeights);
  }, [allEntries, completedGames, completedRecords, playedGames, playedRecords, spinHistory]);

  const behaviorSignalsCount = playedGames.length + completedGames.length + playedRecords.length + completedRecords.length + Math.min(spinHistory.length, 20);

  const suggestedSourceWeights = useMemo<SourceWeights>(
    () =>
      sourceKeys.reduce<SourceWeights>((accumulator, source) => {
        const suggested = defaultSourceWeights[source] * sourceBehaviorMultipliers[source];
        const normalized = Number(suggested.toFixed(1));
        return {
          ...accumulator,
          [source]: Math.max(0.1, Math.min(3, normalized)),
        };
      }, {} as SourceWeights),
    [sourceBehaviorMultipliers],
  );

  const availableTags = useMemo(
    () =>
      [...new Set(basePool.flatMap((candidate) => candidate.tags ?? []))]
        .filter((tag) => tag.trim().length > 0)
        .sort((a, b) => a.localeCompare(b)),
    [basePool],
  );

  const poolAfterAdvancedFilters = useMemo(
    () =>
      basePool.filter((candidate) => {
        if (filters.platform !== "any" && !(candidate.platforms ?? []).includes(filters.platform)) {
          return false;
        }

        if (filters.tag !== "any" && !(candidate.tags ?? []).some((tag) => tag.toLowerCase() === filters.tag.toLowerCase())) {
          return false;
        }

        if (filters.length !== "any" && candidate.estimatedLength !== filters.length) {
          return false;
        }

        if (filters.releaseFrom) {
          if (!candidate.releaseDate || candidate.releaseDate < filters.releaseFrom) {
            return false;
          }
        }

        if (filters.releaseTo) {
          if (!candidate.releaseDate || candidate.releaseDate > filters.releaseTo) {
            return false;
          }
        }

        if (filters.freeOnly && candidate.isFree !== true) {
          return false;
        }

        if (!filters.freeOnly && filters.maxPriceUsd < defaultFilters.maxPriceUsd) {
          if (candidate.isFree === true) return true;
          if (typeof candidate.priceUsd !== "number") return false;
          if (candidate.priceUsd > filters.maxPriceUsd) return false;
        }

        return true;
      }),
    [basePool, filters],
  );

  const statusBlocked = useMemo(() => {
    const names = new Set<string>();
    const ids = new Set<string>();
    if (excludePlayed) {
      playedGames.forEach((name) => names.add(name.toLowerCase()));
      playedRecords.forEach((record) => ids.add(record.id));
    }
    if (excludeCompleted) {
      completedGames.forEach((name) => names.add(name.toLowerCase()));
      completedRecords.forEach((record) => ids.add(record.id));
    }
    return { names, ids };
  }, [completedGames, completedRecords, excludeCompleted, excludePlayed, playedGames, playedRecords]);

  const poolAfterStatusExclusions = useMemo(
    () => poolAfterAdvancedFilters.filter((candidate) =>
      !statusBlocked.ids.has(candidate.id) && !statusBlocked.names.has(candidate.name.toLowerCase())),
    [poolAfterAdvancedFilters, statusBlocked],
  );

  const blockedHistory = useMemo(() => {
    const ids = new Set<string>();
    const legacyNames = new Set<string>();
    spinHistory.slice(0, cooldownSpins).forEach((item) => {
      if (item.id) ids.add(item.id);
      else legacyNames.add(item.name.toLowerCase());
    });
    return { ids, legacyNames };
  }, [spinHistory, cooldownSpins]);

  const poolAfterCooldown = useMemo(
    () => poolAfterStatusExclusions.filter((candidate) =>
      !blockedHistory.ids.has(candidate.id) && !blockedHistory.legacyNames.has(candidate.name.toLowerCase())),
    [blockedHistory, poolAfterStatusExclusions],
  );

  const cooldownSaturated = cooldownSpins > 0 && poolAfterStatusExclusions.length > 0 && poolAfterCooldown.length === 0;
  const statusExhausted =
    poolAfterStatusExclusions.length === 0 && poolAfterAdvancedFilters.length > 0 &&
    (statusBlocked.names.size > 0 || statusBlocked.ids.size > 0);
  const advancedFilterExhausted =
    poolAfterAdvancedFilters.length === 0 &&
    basePool.length > 0 &&
    (filters.platform !== "any" ||
      filters.tag !== "any" ||
      filters.length !== "any" ||
      Boolean(filters.releaseFrom) ||
      Boolean(filters.releaseTo) ||
      filters.freeOnly ||
      filters.maxPriceUsd < defaultFilters.maxPriceUsd);
  const activePool = advancedFilterExhausted
    ? []
    : statusExhausted
      ? []
      : cooldownSaturated
      ? poolAfterStatusExclusions
      : poolAfterCooldown;

  const adaptivePoolWeights = useMemo(
    () =>
      activePool.map((candidate) => {
        if (!adaptiveRecommendations) return candidate.weight;
        const sourceMultiplier =
          candidate.sources.reduce((sum, source) => {
            const sourceKey = source as SourceToggleKey;
            const multiplier = sourceBehaviorMultipliers[sourceKey] ?? 1;
            return sum + multiplier;
          }, 0) / Math.max(candidate.sources.length, 1);
        return Math.max(0.05, candidate.weight * sourceMultiplier);
      }),
    [activePool, adaptiveRecommendations, sourceBehaviorMultipliers],
  );

  const filterExcludedCount = Math.max(0, basePool.length - poolAfterAdvancedFilters.length);
  const statusExcludedCount = Math.max(0, poolAfterAdvancedFilters.length - poolAfterStatusExclusions.length);
  const cooldownExcludedCount = Math.max(0, poolAfterStatusExclusions.length - poolAfterCooldown.length);

  useEffect(() => {
    if (filters.tag === "any") return;
    if (availableTags.some((tag) => tag.toLowerCase() === filters.tag.toLowerCase())) return;
    setFilters((current) => ({ ...current, tag: "any" }));
  }, [availableTags, filters.tag, setFilters]);

  return {
    behaviorSignalsCount,
    suggestedSourceWeights,
    availableTags,
    activePool,
    adaptivePoolWeights,
    filterExcludedCount,
    statusExcludedCount,
    cooldownExcludedCount,
    advancedFilterExhausted,
    statusExhausted,
    cooldownSaturated,
  };
};
