export const COLOR_PALETTE = [
  "#f25f5c",
  "#247ba0",
  "#70c1b3",
  "#ffe066",
  "#ff9f1c",
  "#2ec4b6",
  "#e76f51",
  "#118ab2",
  "#8ac926",
  "#ef476f",
];

export const normalizeGames = (games: string[]) => {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const game of games) {
    const cleaned = game.trim();
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(cleaned);
  }
  return normalized;
};

export const pickSpin = (count: number, currentRotation: number) => {
  return pickSpinWithWeights(count, currentRotation);
};

interface SpinMotionOptions {
  revolutions?: number;
  jitterRatio?: number;
}

const sanitizeWeights = (count: number, weights?: number[]) => {
  if (!weights || weights.length !== count) {
    return null;
  }
  const sanitized = weights.map((weight) => (Number.isFinite(weight) ? Math.max(0, weight) : 0));
  const total = sanitized.reduce((sum, value) => sum + value, 0);
  if (total <= 0) {
    return null;
  }
  return { sanitized, total };
};

const pickWeightedIndex = (weights: number[], total: number) => {
  let cursor = Math.random() * total;
  for (let index = 0; index < weights.length; index += 1) {
    cursor -= weights[index] ?? 0;
    if (cursor <= 0) {
      return index;
    }
  }
  return weights.length - 1;
};

export const pickSpinWithWeights = (
  count: number,
  currentRotation: number,
  weights?: number[],
  motion?: SpinMotionOptions,
) => {
  if (count <= 0) {
    return {
      nextRotation: currentRotation,
      winnerIndex: -1,
    };
  }

  const weighted = sanitizeWeights(count, weights);
  const winnerIndex = weighted
    ? pickWeightedIndex(weighted.sanitized, weighted.total)
    : Math.floor(Math.random() * count);
  const segment = 360 / count;
  const revolutions =
    typeof motion?.revolutions === "number" && Number.isFinite(motion.revolutions)
      ? Math.max(0.5, Math.min(16, motion.revolutions))
      : 8;
  const jitterRatio =
    typeof motion?.jitterRatio === "number" && Number.isFinite(motion.jitterRatio)
      ? Math.max(0, Math.min(0.49, motion.jitterRatio))
      : 0.3;
  const winnerCenter = winnerIndex * segment + segment / 2;
  const jitter = Math.random() * (segment * jitterRatio * 2) - segment * jitterRatio;
  const nextRotation = currentRotation + 360 * revolutions + (360 - winnerCenter) + jitter;

  return {
    nextRotation,
    winnerIndex,
  };
};
