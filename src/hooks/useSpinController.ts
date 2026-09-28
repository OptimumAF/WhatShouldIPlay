import { type Dispatch, type SetStateAction, useCallback, useEffect, useRef, useState } from "react";
import { pickSpinWithWeights } from "../lib/wheel";

interface PoolEntry<TSource extends string> {
  id?: string;
  name: string;
  sources: TSource[];
  appId?: number;
  url?: string;
}

interface WinnerInfo<TSource extends string> {
  id?: string;
  name: string;
  sources: TSource[];
  odds: number;
  appId?: number;
  url?: string;
}

interface SpinHistoryItem<TSource extends string> extends WinnerInfo<TSource> {
  spunAt: string;
}

interface SpinMotion {
  revolutions: number;
  jitterRatio: number;
}

interface SpinOperation<TSource extends string> {
  readonly entries: ReadonlyArray<PoolEntry<TSource> & { readonly key: string }>;
  readonly effectiveWeights: ReadonlyArray<number>;
  readonly winnerIndex: number;
  readonly winner: WinnerInfo<TSource>;
  readonly durationMs: number;
}

interface UseSpinControllerInput<TSource extends string> {
  initialHistory: SpinHistoryItem<TSource>[];
  onWinnerResolved?: (winner: string, meta: WinnerInfo<TSource>) => void;
}

export const useSpinController = <TSource extends string>({
  initialHistory,
  onWinnerResolved,
}: UseSpinControllerInput<TSource>) => {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<string>("");
  const [winnerMeta, setWinnerMeta] = useState<WinnerInfo<TSource> | null>(null);
  const [showWinnerPopup, setShowWinnerPopup] = useState(false);
  const [winnerPulse, setWinnerPulse] = useState(0);
  const [spinHistory, setSpinHistory] = useState<SpinHistoryItem<TSource>[]>(initialHistory);
  const [wheelSnapshot, setWheelSnapshot] = useState<SpinOperation<TSource> | null>(null);
  const spinningRef = useRef(false);
  const rotationRef = useRef(0);
  const pendingOperationRef = useRef<SpinOperation<TSource> | null>(null);
  const fallbackTimerRef = useRef<number | null>(null);

  const clearFallbackTimer = useCallback(() => {
    if (fallbackTimerRef.current === null) return;
    window.clearTimeout(fallbackTimerRef.current);
    fallbackTimerRef.current = null;
  }, []);

  const finalizeSpin = useCallback(() => {
    const operation = pendingOperationRef.current;
    if (!spinningRef.current || !operation) return;
    pendingOperationRef.current = null;
    spinningRef.current = false;
    clearFallbackTimer();
    const finalMeta = operation.winner;
    setWinner(finalMeta.name);
    setSpinning(false);
    setWinnerMeta(finalMeta);
    setSpinHistory((current) => [
      {
        ...finalMeta,
        spunAt: new Date().toISOString(),
      },
      ...current,
    ]);
    onWinnerResolved?.(finalMeta.name, finalMeta);
    setWinnerPulse((current) => current + 1);
    setShowWinnerPopup(true);
    window.setTimeout(() => {
      setShowWinnerPopup(false);
    }, 4200);
  }, [clearFallbackTimer, onWinnerResolved]);

  const spin = useCallback((params: {
    activePool: PoolEntry<TSource>[];
    weightedMode: boolean;
    adaptiveRecommendations: boolean;
    adaptivePoolWeights: number[];
    spinMotion: SpinMotion;
    fallbackDurationMs?: number;
  }) => {
    const { activePool, weightedMode, adaptiveRecommendations, adaptivePoolWeights, spinMotion, fallbackDurationMs } = params;
    if (spinningRef.current || activePool.length === 0) {
      return;
    }
    const behaviorWeighted = weightedMode || adaptiveRecommendations;
    const entries = activePool.map((entry) => ({
      ...entry,
      sources: [...entry.sources],
      key: entry.id ?? (entry.appId ? `steam:${entry.appId}` : `source:${entry.sources[0] ?? "manual"}:${entry.name.toLowerCase()}`),
    }));
    const candidateWeights = behaviorWeighted && adaptivePoolWeights.length === entries.length
      ? adaptivePoolWeights.map((weight) => Number.isFinite(weight) ? Math.max(0, weight) : 0)
      : [];
    const effectiveWeights = candidateWeights.reduce((sum, weight) => sum + weight, 0) > 0
      ? candidateWeights
      : entries.map(() => 1);
    const result = pickSpinWithWeights(entries.length, rotationRef.current, effectiveWeights, spinMotion);
    const selected = entries[result.winnerIndex];
    if (!selected) return;

    const selectedWeight = effectiveWeights[result.winnerIndex] ?? 1;
    const totalWeight = effectiveWeights.reduce((sum, value) => sum + value, 0);
    const odds = selectedWeight / Math.max(totalWeight, 0.0001);
    const winnerInfo: WinnerInfo<TSource> = {
      id: selected.key,
      name: selected.name,
      sources: [...selected.sources],
      odds,
      appId: selected.appId,
      url: selected.url,
    };
    const operation: SpinOperation<TSource> = {
      entries,
      effectiveWeights,
      winnerIndex: result.winnerIndex,
      winner: winnerInfo,
      durationMs: fallbackDurationMs ?? 6400,
    };
    pendingOperationRef.current = operation;
    spinningRef.current = true;
    rotationRef.current = result.nextRotation;
    setWheelSnapshot(operation);
    setWinner("");
    setWinnerMeta(null);
    setRotation(result.nextRotation);
    setSpinning(true);
    clearFallbackTimer();
    const fallbackDelay = Math.max(1200, operation.durationMs) + 450;
    fallbackTimerRef.current = window.setTimeout(() => {
      finalizeSpin();
    }, fallbackDelay);
  }, [clearFallbackTimer, finalizeSpin]);

  const onSpinEnd = useCallback(() => {
    finalizeSpin();
  }, [finalizeSpin]);

  useEffect(() => {
    return () => {
      clearFallbackTimer();
    };
  }, [clearFallbackTimer]);

  const clearHistory = useCallback(() => {
    setSpinHistory([]);
  }, []);

  return {
    rotation,
    spinning,
    wheelGames: wheelSnapshot?.entries.map((entry) => entry.name) ?? null,
    wheelSpinDurationMs: wheelSnapshot?.durationMs ?? null,
    winner,
    winnerMeta,
    showWinnerPopup,
    winnerPulse,
    spinHistory,
    setShowWinnerPopup,
    setSpinHistory: setSpinHistory as Dispatch<SetStateAction<SpinHistoryItem<TSource>[]>>,
    spin,
    onSpinEnd,
    clearHistory,
  };
};
