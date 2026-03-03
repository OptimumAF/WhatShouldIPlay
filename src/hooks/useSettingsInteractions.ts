import { useCallback, type Dispatch, type SetStateAction } from "react";
import {
  defaultFilters,
  modePresets,
  type AdvancedFilters,
  type EnabledSources,
  type LengthFilter,
  type PlatformFilter,
  type SourceToggleKey,
  type SourceWeights,
  type SpinSpeedProfile,
} from "../lib/appConfig";

interface UseSettingsInteractionsInput {
  applyPreset: (preset: (typeof modePresets)[number]) => void;
  markCustom: () => void;
  setEnabledSources: Dispatch<SetStateAction<EnabledSources>>;
  setWeightedMode: Dispatch<SetStateAction<boolean>>;
  setCooldownSpins: Dispatch<SetStateAction<number>>;
  setAdaptiveRecommendations: Dispatch<SetStateAction<boolean>>;
  setSpinSpeedProfile: Dispatch<SetStateAction<SpinSpeedProfile>>;
  setReducedSpinAnimation: Dispatch<SetStateAction<boolean>>;
  setSourceWeights: Dispatch<SetStateAction<SourceWeights>>;
  setFilters: Dispatch<SetStateAction<AdvancedFilters>>;
  addExclusionFromInput: (target: "played" | "completed") => void;
  setPlayedGames: Dispatch<SetStateAction<string[]>>;
  setCompletedGames: Dispatch<SetStateAction<string[]>>;
  setNotificationsEnabledWithPermission: (value: boolean) => Promise<void>;
}

export const useSettingsInteractions = ({
  applyPreset,
  markCustom,
  setEnabledSources,
  setWeightedMode,
  setCooldownSpins,
  setAdaptiveRecommendations,
  setSpinSpeedProfile,
  setReducedSpinAnimation,
  setSourceWeights,
  setFilters,
  addExclusionFromInput,
  setPlayedGames,
  setCompletedGames,
  setNotificationsEnabledWithPermission,
}: UseSettingsInteractionsInput) => {
  const onApplyPreset = useCallback(
    (presetId: string) => {
      const preset = modePresets.find((candidate) => candidate.id === presetId);
      if (!preset) return;
      applyPreset(preset);
    },
    [applyPreset],
  );

  const onToggleSource = useCallback(
    (source: SourceToggleKey) => {
      setEnabledSources((current) => ({
        ...current,
        [source]: !current[source],
      }));
      markCustom();
    },
    [markCustom, setEnabledSources],
  );

  const onWeightedModeChange = useCallback(
    (value: boolean) => {
      setWeightedMode(value);
      markCustom();
    },
    [markCustom, setWeightedMode],
  );

  const onCooldownSpinsChange = useCallback(
    (value: number) => {
      setCooldownSpins(value);
      markCustom();
    },
    [markCustom, setCooldownSpins],
  );

  const onAdaptiveRecommendationsChange = useCallback(
    (value: boolean) => {
      setAdaptiveRecommendations(value);
      markCustom();
    },
    [markCustom, setAdaptiveRecommendations],
  );

  const onSpinSpeedProfileChange = useCallback(
    (value: SpinSpeedProfile) => {
      setSpinSpeedProfile(value);
      markCustom();
    },
    [markCustom, setSpinSpeedProfile],
  );

  const onReducedSpinAnimationChange = useCallback(
    (value: boolean) => {
      setReducedSpinAnimation(value);
      markCustom();
    },
    [markCustom, setReducedSpinAnimation],
  );

  const onSourceWeightChange = useCallback(
    (source: SourceToggleKey, value: number) => {
      setSourceWeights((current) => ({
        ...current,
        [source]: value,
      }));
      markCustom();
    },
    [markCustom, setSourceWeights],
  );

  const onPlatformChange = useCallback(
    (value: string) => {
      setFilters((current) => ({ ...current, platform: value as PlatformFilter }));
      markCustom();
    },
    [markCustom, setFilters],
  );

  const onTagChange = useCallback(
    (value: string) => {
      setFilters((current) => ({ ...current, tag: value }));
      markCustom();
    },
    [markCustom, setFilters],
  );

  const onLengthChange = useCallback(
    (value: string) => {
      setFilters((current) => ({ ...current, length: value as LengthFilter }));
      markCustom();
    },
    [markCustom, setFilters],
  );

  const onReleaseFromChange = useCallback(
    (value: string) => {
      setFilters((current) => ({ ...current, releaseFrom: value }));
      markCustom();
    },
    [markCustom, setFilters],
  );

  const onReleaseToChange = useCallback(
    (value: string) => {
      setFilters((current) => ({ ...current, releaseTo: value }));
      markCustom();
    },
    [markCustom, setFilters],
  );

  const onMaxPriceChange = useCallback(
    (value: number) => {
      setFilters((current) => ({ ...current, maxPriceUsd: value }));
      markCustom();
    },
    [markCustom, setFilters],
  );

  const onFreeOnlyChange = useCallback(
    (value: boolean) => {
      setFilters((current) => ({ ...current, freeOnly: value }));
      markCustom();
    },
    [markCustom, setFilters],
  );

  const onResetFilters = useCallback(() => {
    setFilters(defaultFilters);
    markCustom();
  }, [markCustom, setFilters]);

  const onAddPlayed = useCallback(() => {
    addExclusionFromInput("played");
  }, [addExclusionFromInput]);

  const onAddCompleted = useCallback(() => {
    addExclusionFromInput("completed");
  }, [addExclusionFromInput]);

  const onClearPlayed = useCallback(() => {
    setPlayedGames([]);
  }, [setPlayedGames]);

  const onClearCompleted = useCallback(() => {
    setCompletedGames([]);
  }, [setCompletedGames]);

  const onNotificationsEnabledChange = useCallback(
    (value: boolean) => {
      void setNotificationsEnabledWithPermission(value);
    },
    [setNotificationsEnabledWithPermission],
  );

  return {
    onApplyPreset,
    onToggleSource,
    onWeightedModeChange,
    onCooldownSpinsChange,
    onAdaptiveRecommendationsChange,
    onSpinSpeedProfileChange,
    onReducedSpinAnimationChange,
    onSourceWeightChange,
    onPlatformChange,
    onTagChange,
    onLengthChange,
    onReleaseFromChange,
    onReleaseToChange,
    onMaxPriceChange,
    onFreeOnlyChange,
    onResetFilters,
    onAddPlayed,
    onAddCompleted,
    onClearPlayed,
    onClearCompleted,
    onNotificationsEnabledChange,
  };
};
