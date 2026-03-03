import { useMemo } from "react";
import type { TopGamesPayload } from "../types";
import {
  modePresetTranslationKeys,
  modePresets,
  sourceKeys,
  sourceLabels,
  spinSpeedProfiles,
  type SourceToggleKey,
  type SourceWeights,
  type SpinSpeedProfile,
  type EnabledSources,
} from "../lib/appConfig";

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

interface UseSettingsPanelViewModelsInput {
  t: TranslateFn;
  topGames: TopGamesPayload | undefined;
  topGamesIsLoading: boolean;
  topGamesIsError: boolean;
  topGamesError: unknown;
  enabledSources: EnabledSources;
  manualGamesCount: number;
  steamImportGamesCount: number;
  sourceWeights: SourceWeights;
  suggestedSourceWeights: SourceWeights;
}

const isRemoteSource = (source: SourceToggleKey): source is Exclude<SourceToggleKey, "manual" | "steamImport"> =>
  source !== "manual" && source !== "steamImport";

export const useSettingsPanelViewModels = ({
  t,
  topGames,
  topGamesIsLoading,
  topGamesIsError,
  topGamesError,
  enabledSources,
  manualGamesCount,
  steamImportGamesCount,
  sourceWeights,
  suggestedSourceWeights,
}: UseSettingsPanelViewModelsInput) => {
  const presetCards = useMemo(
    () =>
      modePresets.map((preset) => ({
        id: preset.id,
        label: t(modePresetTranslationKeys[preset.id]?.label ?? "modePreset.balanced.label"),
        description: t(modePresetTranslationKeys[preset.id]?.description ?? "modePreset.balanced.description"),
      })),
    [t],
  );

  const sourceCards = useMemo(
    () =>
      sourceKeys.map((source) => ({
        source,
        label: sourceLabels[source],
        enabled: enabledSources[source],
        loadedCount:
          source === "manual"
            ? manualGamesCount
            : source === "steamImport"
              ? steamImportGamesCount
              : (topGames?.sources[source].games.length ?? 0),
        loading: topGamesIsLoading && source !== "manual" && source !== "steamImport",
        fetchedAt:
          source === "manual" || source === "steamImport"
            ? null
            : (topGames?.sources[source].fetchedAt ?? null),
        note:
          source === "manual"
            ? t("sourceCustomListNote")
            : source === "steamImport"
              ? t("sourceSteamImportNote")
              : isRemoteSource(source)
                ? topGames?.sources[source].note
                : undefined,
      })),
    [enabledSources, manualGamesCount, steamImportGamesCount, t, topGames, topGamesIsLoading],
  );

  const sourceWeightRows = useMemo(
    () =>
      sourceKeys.map((source) => ({
        source,
        label: sourceLabels[source],
        value: sourceWeights[source],
        suggested: suggestedSourceWeights[source],
      })),
    [sourceWeights, suggestedSourceWeights],
  );

  const spinSpeedOptions = useMemo(
    () =>
      (Object.entries(spinSpeedProfiles) as [SpinSpeedProfile, (typeof spinSpeedProfiles)[SpinSpeedProfile]][]).map(
        ([id, profile]) => ({
          id,
          label: profile.label,
        }),
      ),
    [],
  );

  const sourceLoadError = useMemo(() => {
    if (!topGamesIsError) return null;
    if (topGamesError instanceof Error) return topGamesError.message;
    return String(topGamesError ?? "Unable to load source data.");
  }, [topGamesError, topGamesIsError]);

  return {
    presetCards,
    sourceCards,
    sourceWeightRows,
    spinSpeedOptions,
    sourceLoadError,
  };
};
