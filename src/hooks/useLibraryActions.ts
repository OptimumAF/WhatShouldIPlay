import { type Dispatch, type SetStateAction, useCallback } from "react";
import type { GameEntry } from "../types";

interface ModePresetLike<TEnabledSources, TSourceWeights> {
  id: string;
  enabledSources: TEnabledSources;
  sourceWeights: TSourceWeights;
  weightedMode: boolean;
  cooldownSpins: number;
}

interface SteamOwnedGame {
  appid: number;
  name: string;
  playtime_forever?: number;
}

type ToastTone = "info" | "success" | "error";

interface UseLibraryActionsInput<TEnabledSources extends { steamImport: boolean }, TSourceWeights> {
  normalizeGames: (entries: string[]) => string[];
  t: (key: string, options?: Record<string, unknown>) => string;
  pushToast: (tone: ToastTone, text: string) => void;
  parseOwnedGames: (raw: unknown) => SteamOwnedGame[];
  suggestedSourceWeights: TSourceWeights;
  weightedMode: boolean;
  manualInput: string;
  steamApiKey: string;
  steamId: string;
  exclusionInput: string;
  completedGames: string[];
  setActivePreset: Dispatch<SetStateAction<string>>;
  setEnabledSources: Dispatch<SetStateAction<TEnabledSources>>;
  setSourceWeights: Dispatch<SetStateAction<TSourceWeights>>;
  setWeightedMode: Dispatch<SetStateAction<boolean>>;
  setCooldownSpins: Dispatch<SetStateAction<number>>;
  setManualInput: Dispatch<SetStateAction<string>>;
  setManualGames: Dispatch<SetStateAction<string[]>>;
  setSteamImportGames: Dispatch<SetStateAction<GameEntry[]>>;
  setSteamImportStatus: Dispatch<SetStateAction<string>>;
  setSteamImportLoading: Dispatch<SetStateAction<boolean>>;
  setPlayedGames: Dispatch<SetStateAction<string[]>>;
  setCompletedGames: Dispatch<SetStateAction<string[]>>;
  setExclusionInput: Dispatch<SetStateAction<string>>;
}

export const useLibraryActions = <TEnabledSources extends { steamImport: boolean }, TSourceWeights>({
  normalizeGames,
  t,
  pushToast,
  parseOwnedGames,
  suggestedSourceWeights,
  weightedMode,
  manualInput,
  steamApiKey,
  steamId,
  exclusionInput,
  completedGames,
  setActivePreset,
  setEnabledSources,
  setSourceWeights,
  setWeightedMode,
  setCooldownSpins,
  setManualInput,
  setManualGames,
  setSteamImportGames,
  setSteamImportStatus,
  setSteamImportLoading,
  setPlayedGames,
  setCompletedGames,
  setExclusionInput,
}: UseLibraryActionsInput<TEnabledSources, TSourceWeights>) => {
  const markCustom = useCallback(() => {
    setActivePreset("custom");
  }, [setActivePreset]);

  const applyPreset = useCallback(
    (preset: ModePresetLike<TEnabledSources, TSourceWeights>) => {
      setEnabledSources(preset.enabledSources);
      setSourceWeights(preset.sourceWeights);
      setWeightedMode(preset.weightedMode);
      setCooldownSpins(preset.cooldownSpins);
      setActivePreset(preset.id);
    },
    [setActivePreset, setCooldownSpins, setEnabledSources, setSourceWeights, setWeightedMode],
  );

  const applySuggestedWeights = useCallback(() => {
    setSourceWeights(suggestedSourceWeights);
    if (!weightedMode) {
      setWeightedMode(true);
    }
    markCustom();
    pushToast("success", t("messages.appliedSuggestedWeights"));
  }, [markCustom, pushToast, setSourceWeights, setWeightedMode, suggestedSourceWeights, t, weightedMode]);

  const addManualGames = useCallback(() => {
    const incoming = normalizeGames(manualInput.split(/\r?\n|,/g));
    setManualGames((current) => normalizeGames([...current, ...incoming]));
    setManualInput("");
    markCustom();
  }, [manualInput, markCustom, normalizeGames, setManualGames, setManualInput]);

  const clearManualGames = useCallback(() => {
    setManualGames([]);
    markCustom();
  }, [markCustom, setManualGames]);

  const clearSteamImport = useCallback(() => {
    setSteamImportGames([]);
    setSteamImportStatus("");
    markCustom();
  }, [markCustom, setSteamImportGames, setSteamImportStatus]);

  const markGamesPlayed = useCallback(
    (names: string[]) => {
      const incoming = normalizeGames(names);
      if (incoming.length === 0) return;
      const completedSet = new Set(completedGames.map((name) => name.toLowerCase()));
      setPlayedGames((current) =>
        normalizeGames([...current, ...incoming]).filter((name) => !completedSet.has(name.toLowerCase())),
      );
    },
    [completedGames, normalizeGames, setPlayedGames],
  );

  const markGamesCompleted = useCallback(
    (names: string[]) => {
      const incoming = normalizeGames(names);
      if (incoming.length === 0) return;
      const incomingSet = new Set(incoming.map((name) => name.toLowerCase()));
      setCompletedGames((current) => normalizeGames([...current, ...incoming]));
      setPlayedGames((current) => current.filter((name) => !incomingSet.has(name.toLowerCase())));
    },
    [normalizeGames, setCompletedGames, setPlayedGames],
  );

  const removePlayedGame = useCallback(
    (name: string) => {
      const key = name.toLowerCase();
      setPlayedGames((current) => current.filter((entry) => entry.toLowerCase() !== key));
    },
    [setPlayedGames],
  );

  const removeCompletedGame = useCallback(
    (name: string) => {
      const key = name.toLowerCase();
      setCompletedGames((current) => current.filter((entry) => entry.toLowerCase() !== key));
    },
    [setCompletedGames],
  );

  const addExclusionFromInput = useCallback(
    (target: "played" | "completed") => {
      const incoming = normalizeGames(exclusionInput.split(/\r?\n|,/g));
      if (incoming.length === 0) return;
      if (target === "played") {
        markGamesPlayed(incoming);
      } else {
        markGamesCompleted(incoming);
      }
      setExclusionInput("");
    },
    [exclusionInput, markGamesCompleted, markGamesPlayed, normalizeGames, setExclusionInput],
  );

  const importSteamLibrary = useCallback(async () => {
    const key = steamApiKey.trim();
    const id = steamId.trim();
    if (!key || !id) {
      setSteamImportStatus(t("messages.steamEnterCreds"));
      pushToast("error", t("messages.steamNeedsBoth"));
      return;
    }

    setSteamImportLoading(true);
    setSteamImportStatus(t("messages.steamImporting"));
    try {
      const params = new URLSearchParams({
        key,
        steamid: id,
        include_appinfo: "1",
        include_played_free_games: "1",
        format: "json",
      });

      const response = await fetch(`https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?${params}`);
      if (!response.ok) {
        throw new Error(`Steam import failed (${response.status}). Check API key, SteamID64, and profile privacy.`);
      }

      const json = await response.json();
      const games = parseOwnedGames(json);

      const deduped = new Map<string, GameEntry>();
      games.forEach((game, index) => {
        const cleaned = game.name.trim();
        if (!cleaned) return;
        const keyName = cleaned.toLowerCase();
        if (deduped.has(keyName)) return;
        deduped.set(keyName, {
          name: cleaned,
          source: "steamImport",
          rank: index + 1,
          score: game.playtime_forever ?? 0,
          appId: game.appid,
          url: `https://store.steampowered.com/app/${game.appid}/`,
        });
      });

      const imported = [...deduped.values()];
      setSteamImportGames(imported);
      setEnabledSources((current) => ({ ...current, steamImport: true }));
      setSteamImportStatus(`Imported ${imported.length} Steam games.`);
      pushToast("success", `Imported ${imported.length} games from Steam.`);
      markCustom();
    } catch (error) {
      if (error instanceof TypeError) {
        const message = t("messages.steamImportBlocked");
        setSteamImportStatus(message);
        pushToast("error", `${message} If needed, verify your API key and Steam privacy settings.`);
      } else {
        const message = (error as Error).message;
        setSteamImportStatus(message);
        pushToast("error", `${message} Double-check your key, SteamID64, and profile visibility.`);
      }
    } finally {
      setSteamImportLoading(false);
    }
  }, [
    markCustom,
    parseOwnedGames,
    pushToast,
    setEnabledSources,
    setSteamImportGames,
    setSteamImportLoading,
    setSteamImportStatus,
    steamApiKey,
    steamId,
    t,
  ]);

  return {
    markCustom,
    applyPreset,
    applySuggestedWeights,
    addManualGames,
    clearManualGames,
    clearSteamImport,
    markGamesPlayed,
    markGamesCompleted,
    removePlayedGame,
    removeCompletedGame,
    addExclusionFromInput,
    importSteamLibrary,
  };
};
