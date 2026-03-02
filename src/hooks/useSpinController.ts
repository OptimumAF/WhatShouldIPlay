import { type Dispatch, type SetStateAction, useCallback, useState } from "react";
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

  const spin = useCallback((params: {
    activePool: PoolEntry<TSource>[];
    weightedMode: boolean;
    adaptiveRecommendations: boolean;
    adaptivePoolWeights: number[];
    spinMotion: SpinMotion;
  }) => {
    const { activePool, weightedMode, adaptiveRecommendations, adaptivePoolWeights, spinMotion } = params;
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
    setWinner("");
    setWinnerMeta(null);
    setRotation(result.nextRotation);
    setSpinning(true);
  }, [rotation, spinning]);

  const onSpinEnd = useCallback(() => {
    if (!spinning) return;
    const finalWinner = pendingWinner;
    const finalMeta = pendingWinnerMeta;
    setWinner(finalWinner);
    setPendingWinner("");
    setPendingWinnerMeta(null);
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
  }, [onWinnerResolved, pendingWinner, pendingWinnerMeta, spinning]);

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
