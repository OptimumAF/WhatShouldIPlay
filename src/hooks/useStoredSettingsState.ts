import { type Dispatch, type SetStateAction, useCallback } from "react";

interface StoredSettingsLike<TEnabledSources, TSourceWeights, TSpinSpeedProfile, TFilters> {
  enabledSources: TEnabledSources;
  sourceWeights: TSourceWeights;
  weightedMode: boolean;
  adaptiveRecommendations: boolean;
  cooldownSpins: number;
  spinSpeedProfile: TSpinSpeedProfile;
  reducedSpinAnimation: boolean;
  activePreset: string;
  filters: TFilters;
}

interface UseStoredSettingsStateInput<TEnabledSources, TSourceWeights, TSpinSpeedProfile, TFilters> {
  enabledSources: TEnabledSources;
  sourceWeights: TSourceWeights;
  weightedMode: boolean;
  adaptiveRecommendations: boolean;
  cooldownSpins: number;
  spinSpeedProfile: TSpinSpeedProfile;
  reducedSpinAnimation: boolean;
  activePreset: string;
  filters: TFilters;
  sanitizeFilters: (value: TFilters) => TFilters;
  setEnabledSources: Dispatch<SetStateAction<TEnabledSources>>;
  setSourceWeights: Dispatch<SetStateAction<TSourceWeights>>;
  setWeightedMode: Dispatch<SetStateAction<boolean>>;
  setAdaptiveRecommendations: Dispatch<SetStateAction<boolean>>;
  setCooldownSpins: Dispatch<SetStateAction<number>>;
  setSpinSpeedProfile: Dispatch<SetStateAction<TSpinSpeedProfile>>;
  setReducedSpinAnimation: Dispatch<SetStateAction<boolean>>;
  setActivePreset: Dispatch<SetStateAction<string>>;
  setFilters: Dispatch<SetStateAction<TFilters>>;
}

export const useStoredSettingsState = <TEnabledSources, TSourceWeights, TSpinSpeedProfile, TFilters>({
  enabledSources,
  sourceWeights,
  weightedMode,
  adaptiveRecommendations,
  cooldownSpins,
  spinSpeedProfile,
  reducedSpinAnimation,
  activePreset,
  filters,
  sanitizeFilters,
  setEnabledSources,
  setSourceWeights,
  setWeightedMode,
  setAdaptiveRecommendations,
  setCooldownSpins,
  setSpinSpeedProfile,
  setReducedSpinAnimation,
  setActivePreset,
  setFilters,
}: UseStoredSettingsStateInput<TEnabledSources, TSourceWeights, TSpinSpeedProfile, TFilters>) => {
  const currentSettingsSnapshot = useCallback(
    (): StoredSettingsLike<TEnabledSources, TSourceWeights, TSpinSpeedProfile, TFilters> => ({
      enabledSources,
      sourceWeights,
      weightedMode,
      adaptiveRecommendations,
      cooldownSpins,
      spinSpeedProfile,
      reducedSpinAnimation,
      activePreset,
      filters,
    }),
    [
      activePreset,
      adaptiveRecommendations,
      cooldownSpins,
      enabledSources,
      filters,
      reducedSpinAnimation,
      sourceWeights,
      spinSpeedProfile,
      weightedMode,
    ],
  );

  const applyStoredSettings = useCallback(
    (sanitized: StoredSettingsLike<TEnabledSources, TSourceWeights, TSpinSpeedProfile, TFilters>) => {
      setEnabledSources(sanitized.enabledSources);
      setSourceWeights(sanitized.sourceWeights);
      setWeightedMode(sanitized.weightedMode);
      setAdaptiveRecommendations(sanitized.adaptiveRecommendations);
      setCooldownSpins(sanitized.cooldownSpins);
      setSpinSpeedProfile(sanitized.spinSpeedProfile);
      setReducedSpinAnimation(sanitized.reducedSpinAnimation);
      setActivePreset(sanitized.activePreset);
      setFilters(sanitizeFilters(sanitized.filters));
    },
    [
      sanitizeFilters,
      setActivePreset,
      setAdaptiveRecommendations,
      setCooldownSpins,
      setEnabledSources,
      setFilters,
      setReducedSpinAnimation,
      setSourceWeights,
      setSpinSpeedProfile,
      setWeightedMode,
    ],
  );

  return {
    currentSettingsSnapshot,
    applyStoredSettings,
  };
};
