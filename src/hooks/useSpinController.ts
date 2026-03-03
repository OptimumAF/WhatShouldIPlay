import { type Dispatch, type SetStateAction, useCallback, useEffect, useRef, useState } from "react";
import { pickSpinWithWeights } from "../lib/wheel";

interface PoolEntry<TSource extends string> {
  name: string;
  sources: TSource[];
  appId?: number;
  url?: string;
}

interface WinnerInfo<TSource extends string> {
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

  const [pendingWinner, setPendingWinner] = useState<string>("");
  const [pendingWinnerMeta, setPendingWinnerMeta] = useState<WinnerInfo<TSource> | null>(null);
  const spinningRef = useRef(false);
  const pendingWinnerRef = useRef("");
  const pendingWinnerMetaRef = useRef<WinnerInfo<TSource> | null>(null);
  const fallbackTimerRef = useRef<number | null>(null);

  useEffect(() => {
    spinningRef.current = spinning;
  }, [spinning]);
  useEffect(() => {
    pendingWinnerRef.current = pendingWinner;
  }, [pendingWinner]);
  useEffect(() => {
    pendingWinnerMetaRef.current = pendingWinnerMeta;
  }, [pendingWinnerMeta]);

  const clearFallbackTimer = useCallback(() => {
    if (fallbackTimerRef.current === null) return;
    window.clearTimeout(fallbackTimerRef.current);
    fallbackTimerRef.current = null;
  }, []);

  const finalizeSpin = useCallback(() => {
    if (!spinningRef.current) return;
    clearFallbackTimer();
    const finalWinner = pendingWinnerRef.current;
    const finalMeta = pendingWinnerMetaRef.current;
    setWinner(finalWinner);
    setPendingWinner("");
    setPendingWinnerMeta(null);
    spinningRef.current = false;
    setSpinning(false);
    if (finalWinner && finalMeta) {
      setWinnerMeta(finalMeta);
      setSpinHistory((current) => [
        {
          ...finalMeta,
          spunAt: new Date().toISOString(),
        },
        ...current,
      ]);
      onWinnerResolved?.(finalWinner, finalMeta);
      setWinnerPulse((current) => current + 1);
      setShowWinnerPopup(true);
      window.setTimeout(() => {
        setShowWinnerPopup(false);
      }, 4200);
    }
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
    if (spinning || activePool.length === 0) {
      return;
    }
    const behaviorWeighted = weightedMode || adaptiveRecommendations;
    const spinWeights = behaviorWeighted ? adaptivePoolWeights : undefined;
    const result = pickSpinWithWeights(activePool.length, rotation, spinWeights, spinMotion);
    const selected = activePool[result.winnerIndex];
    if (!selected) return;

    const selectedWeight = spinWeights?.[result.winnerIndex] ?? 1;
    const totalWeight = behaviorWeighted
      ? (spinWeights?.reduce((sum, value) => sum + value, 0) ?? activePool.length)
      : activePool.length;
    const odds = behaviorWeighted ? selectedWeight / Math.max(totalWeight, 0.0001) : 1 / activePool.length;

    setPendingWinner(selected.name);
    setPendingWinnerMeta({
      name: selected.name,
      sources: selected.sources,
      odds,
      appId: selected.appId,
      url: selected.url,
    });
    pendingWinnerRef.current = selected.name;
    pendingWinnerMetaRef.current = {
      name: selected.name,
      sources: selected.sources,
      odds,
      appId: selected.appId,
      url: selected.url,
    };
    setWinner("");
    setWinnerMeta(null);
    setRotation(result.nextRotation);
    spinningRef.current = true;
    setSpinning(true);
    clearFallbackTimer();
    const fallbackDelay = Math.max(1200, fallbackDurationMs ?? 6400) + 450;
    fallbackTimerRef.current = window.setTimeout(() => {
      finalizeSpin();
    }, fallbackDelay);
  }, [clearFallbackTimer, finalizeSpin, rotation, spinning]);

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
