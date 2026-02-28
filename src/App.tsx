import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import clsx from "clsx";
import { normalizeGames, pickSpinWithWeights } from "./lib/wheel";
import { SW_SKIP_WAITING_MESSAGE, SW_UPDATE_READY_EVENT } from "./lib/pwa";
import { Wheel } from "./components/Wheel";
import type { GameEntry, SourceId, TopGamesPayload } from "./types";

const payloadSchema = z.object({
  generatedAt: z.string(),
  sources: z.object({
    steamcharts: z.object({
      id: z.literal("steamcharts"),
      label: z.string(),
      fetchedAt: z.string(),
      note: z.string().optional(),
      games: z.array(
        z.object({
          name: z.string(),
          source: z.string(),
          rank: z.number().optional(),
          score: z.number().optional(),
          appId: z.number().optional(),
          url: z.string().optional(),
        }),
      ),
    }),
    steamdb: z.object({
      id: z.literal("steamdb"),
      label: z.string(),
      fetchedAt: z.string(),
      note: z.string().optional(),
      games: z.array(
        z.object({
          name: z.string(),
          source: z.string(),
          rank: z.number().optional(),
          score: z.number().optional(),
          appId: z.number().optional(),
          url: z.string().optional(),
        }),
      ),
    }),
    twitchmetrics: z.object({
      id: z.literal("twitchmetrics"),
      label: z.string(),
      fetchedAt: z.string(),
      note: z.string().optional(),
      games: z.array(
        z.object({
          name: z.string(),
          source: z.string(),
          rank: z.number().optional(),
          score: z.number().optional(),
          appId: z.number().optional(),
          url: z.string().optional(),
        }),
      ),
    }),
  }),
});

const steamOwnedSchema = z.object({
  response: z
    .object({
      game_count: z.number().optional(),
      games: z
        .array(
          z.object({
            appid: z.number(),
            name: z.string(),
            playtime_forever: z.number().optional(),
          }),
        )
        .optional(),
    })
    .default({}),
});

const storedSteamImportSchema = z.object({
  steamApiKey: z.string().default(""),
  steamId: z.string().default(""),
  steamImportGames: z
    .array(
      z.object({
        name: z.string(),
        rank: z.number().optional(),
        score: z.number().optional(),
        appId: z.number().optional(),
        url: z.string().optional(),
      }),
    )
    .default([]),
});

const HISTORY_STORAGE_KEY = "pickagame.spin-history.v1";
const SETTINGS_STORAGE_KEY = "pickagame.settings.v1";
const MANUAL_GAMES_STORAGE_KEY = "pickagame.manual-games.v1";
const STEAM_IMPORT_STORAGE_KEY = "pickagame.steam-import.v1";

const sourceKeys = ["steamcharts", "steamdb", "twitchmetrics", "manual", "steamImport"] as const;
type SourceToggleKey = (typeof sourceKeys)[number];

type EnabledSources = Record<SourceToggleKey, boolean>;
type SourceWeights = Record<SourceToggleKey, number>;

interface PoolGame {
  name: string;
  sources: SourceId[];
  weight: number;
  appId?: number;
  url?: string;
}

interface WinnerInfo {
  name: string;
  sources: SourceId[];
  odds: number;
  appId?: number;
  url?: string;
}

interface SpinHistoryItem extends WinnerInfo {
  spunAt: string;
}

interface ModePreset {
  id: string;
  label: string;
  description: string;
  enabledSources: EnabledSources;
  sourceWeights: SourceWeights;
  weightedMode: boolean;
  cooldownSpins: number;
}

interface StoredSettings {
  enabledSources: EnabledSources;
  sourceWeights: SourceWeights;
  weightedMode: boolean;
  cooldownSpins: number;
  activePreset: string;
}

interface StoredSteamImport {
  steamApiKey: string;
  steamId: string;
  steamImportGames: GameEntry[];
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
}

const sourceLabels: Record<SourceToggleKey, string> = {
  steamcharts: "SteamCharts",
  steamdb: "SteamDB",
  twitchmetrics: "TwitchMetrics",
  manual: "Manual",
  steamImport: "Steam Library",
};

const defaultEnabledSources: EnabledSources = {
  steamcharts: true,
  steamdb: true,
  twitchmetrics: true,
  manual: true,
  steamImport: true,
};

const defaultSourceWeights: SourceWeights = {
  steamcharts: 1.2,
  steamdb: 1.15,
  twitchmetrics: 1,
  manual: 0.9,
  steamImport: 1.35,
};

const modePresets: ModePreset[] = [
  {
    id: "balanced",
    label: "Balanced Mix",
    description: "Weighted by popularity + source confidence, with light anti-repeat cooldown.",
    enabledSources: { ...defaultEnabledSources },
    sourceWeights: { ...defaultSourceWeights },
    weightedMode: true,
    cooldownSpins: 2,
  },
  {
    id: "quick",
    label: "Quick Pick",
    description: "Simple equal odds. Fast and unpredictable.",
    enabledSources: { ...defaultEnabledSources },
    sourceWeights: { ...defaultSourceWeights },
    weightedMode: false,
    cooldownSpins: 0,
  },
  {
    id: "no-repeats",
    label: "No Repeats",
    description: "Aggressive cooldown to force variety across spins.",
    enabledSources: { ...defaultEnabledSources },
    sourceWeights: { ...defaultSourceWeights },
    weightedMode: true,
    cooldownSpins: 8,
  },
  {
    id: "owned-first",
    label: "Owned Focus",
    description: "Favors games you actually own/imported from Steam.",
    enabledSources: {
      steamcharts: false,
      steamdb: false,
      twitchmetrics: false,
      manual: true,
      steamImport: true,
    },
    sourceWeights: {
      steamcharts: 0.6,
      steamdb: 0.6,
      twitchmetrics: 0.6,
      manual: 1.1,
      steamImport: 1.8,
    },
    weightedMode: true,
    cooldownSpins: 5,
  },
];

const fallbackSettings: StoredSettings = {
  enabledSources: defaultEnabledSources,
  sourceWeights: defaultSourceWeights,
  weightedMode: true,
  cooldownSpins: 2,
  activePreset: "balanced",
};

const fallbackSteamImport: StoredSteamImport = {
  steamApiKey: "",
  steamId: "",
  steamImportGames: [],
};

async function fetchTopGames(): Promise<TopGamesPayload> {
  const url = `${import.meta.env.BASE_URL}data/top-games.json`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Unable to load game data (${response.status})`);
  }
  const json = await response.json();
  return payloadSchema.parse(json) as TopGamesPayload;
}

const readStorage = <T,>(key: string, fallback: T) => {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const formatOdds = (odds: number) => `${(odds * 100).toFixed(odds < 0.01 ? 2 : 1)}%`;

const sourceLabelList = (sources: SourceId[]) =>
  sources
    .map((source) => sourceLabels[source as SourceToggleKey] ?? source)
    .filter((value, index, arr) => arr.indexOf(value) === index)
    .join(" + ");

const gameWeight = (entry: GameEntry, sourceWeights: SourceWeights, weightedMode: boolean) => {
  if (!weightedMode) return 1;
  const sourceWeight = sourceWeights[entry.source as SourceToggleKey] ?? 1;
  const rankBoost = entry.rank ? Math.max(0.7, 1.45 - (entry.rank - 1) / 40) : 1;
  const scoreBoost = entry.score ? Math.min(1.9, 1 + Math.log10(entry.score + 10) / 4) : 1;
  return Math.max(0.1, sourceWeight * rankBoost * scoreBoost);
};

const sanitizeSettings = (input: StoredSettings | null): StoredSettings => {
  if (!input) return fallbackSettings;
  return {
    enabledSources: { ...defaultEnabledSources, ...(input.enabledSources ?? {}) },
    sourceWeights: { ...defaultSourceWeights, ...(input.sourceWeights ?? {}) },
    weightedMode: typeof input.weightedMode === "boolean" ? input.weightedMode : fallbackSettings.weightedMode,
    cooldownSpins:
      typeof input.cooldownSpins === "number" && Number.isFinite(input.cooldownSpins)
        ? Math.max(0, Math.min(20, Math.round(input.cooldownSpins)))
        : fallbackSettings.cooldownSpins,
    activePreset: input.activePreset || fallbackSettings.activePreset,
  };
};

const sanitizeSteamImport = (input: StoredSteamImport | null): StoredSteamImport => {
  if (!input) return fallbackSteamImport;
  const parsed = storedSteamImportSchema.safeParse(input);
  if (!parsed.success) return fallbackSteamImport;

  const deduped = new Map<string, GameEntry>();
  parsed.data.steamImportGames.forEach((entry, index) => {
    const cleaned = entry.name.trim();
    if (!cleaned) return;
    const key = cleaned.toLowerCase();
    if (deduped.has(key)) return;
    deduped.set(key, {
      name: cleaned,
      source: "steamImport",
      rank: entry.rank ?? index + 1,
      score: entry.score,
      appId: entry.appId,
      url: entry.url,
    });
  });

  return {
    steamApiKey: parsed.data.steamApiKey,
    steamId: parsed.data.steamId,
    steamImportGames: [...deduped.values()],
  };
};

export default function App() {
  const initialSettings = sanitizeSettings(readStorage<StoredSettings | null>(SETTINGS_STORAGE_KEY, null));
  const initialHistory = readStorage<SpinHistoryItem[]>(HISTORY_STORAGE_KEY, []);
  const initialManualGames = normalizeGames(readStorage<string[]>(MANUAL_GAMES_STORAGE_KEY, []));
  const initialSteamImport = sanitizeSteamImport(readStorage<StoredSteamImport | null>(STEAM_IMPORT_STORAGE_KEY, null));

  const [enabledSources, setEnabledSources] = useState<EnabledSources>(initialSettings.enabledSources);
  const [sourceWeights, setSourceWeights] = useState<SourceWeights>(initialSettings.sourceWeights);
  const [weightedMode, setWeightedMode] = useState(initialSettings.weightedMode);
  const [cooldownSpins, setCooldownSpins] = useState(initialSettings.cooldownSpins);
  const [activePreset, setActivePreset] = useState(initialSettings.activePreset);

  const [manualInput, setManualInput] = useState("");
  const [manualGames, setManualGames] = useState<string[]>(initialManualGames);
  const [steamImportGames, setSteamImportGames] = useState<GameEntry[]>(initialSteamImport.steamImportGames);
  const [steamApiKey, setSteamApiKey] = useState(initialSteamImport.steamApiKey);
  const [steamId, setSteamId] = useState(initialSteamImport.steamId);
  const [steamImportStatus, setSteamImportStatus] = useState<string>("");
  const [steamImportLoading, setSteamImportLoading] = useState(false);

  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<string>("");
  const [pendingWinner, setPendingWinner] = useState<string>("");
  const [winnerMeta, setWinnerMeta] = useState<WinnerInfo | null>(null);
  const [pendingWinnerMeta, setPendingWinnerMeta] = useState<WinnerInfo | null>(null);
  const [showWinnerPopup, setShowWinnerPopup] = useState(false);
  const [winnerPulse, setWinnerPulse] = useState(0);
  const [spinHistory, setSpinHistory] = useState<SpinHistoryItem[]>(initialHistory);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [swUpdateReady, setSwUpdateReady] = useState(false);
  const [updateInProgress, setUpdateInProgress] = useState(false);
  const [dismissedUpdate, setDismissedUpdate] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const topGamesQuery = useQuery({
    queryKey: ["top-games"],
    queryFn: fetchTopGames,
    staleTime: 1000 * 60 * 10,
  });

  const topGames = topGamesQuery.data;

  const manualEntries = useMemo<GameEntry[]>(
    () =>
      manualGames.map((name, index) => ({
        name,
        source: "manual",
        rank: index + 1,
      })),
    [manualGames],
  );

  const allEntries = useMemo<GameEntry[]>(() => {
    const entries: GameEntry[] = [];
    if (topGames) {
      entries.push(...topGames.sources.steamcharts.games);
      entries.push(...topGames.sources.steamdb.games);
      entries.push(...topGames.sources.twitchmetrics.games);
    }
    entries.push(...manualEntries);
    entries.push(...steamImportGames);
    return entries;
  }, [manualEntries, steamImportGames, topGames]);

  const basePool = useMemo<PoolGame[]>(() => {
    const byName = new Map<string, PoolGame>();

    for (const entry of allEntries) {
      const source = entry.source as SourceToggleKey;
      if (!sourceKeys.includes(source) || !enabledSources[source]) continue;
      const cleaned = entry.name.trim();
      if (!cleaned) continue;
      const key = cleaned.toLowerCase();
      const computedWeight = gameWeight(entry, sourceWeights, weightedMode);
      const current = byName.get(key);
      if (current) {
        current.weight += computedWeight;
        if (!current.sources.includes(entry.source)) {
          current.sources.push(entry.source);
        }
        current.appId ||= entry.appId;
        current.url ||= entry.url;
      } else {
        byName.set(key, {
          name: cleaned,
          sources: [entry.source],
          weight: computedWeight,
          appId: entry.appId,
          url: entry.url,
        });
      }
    }

    return [...byName.values()];
  }, [allEntries, enabledSources, sourceWeights, weightedMode]);

  const blockedNames = useMemo(
    () => new Set(spinHistory.slice(0, cooldownSpins).map((item) => item.name.toLowerCase())),
    [spinHistory, cooldownSpins],
  );

  const poolAfterCooldown = useMemo(
    () => basePool.filter((candidate) => !blockedNames.has(candidate.name.toLowerCase())),
    [basePool, blockedNames],
  );

  const cooldownSaturated = cooldownSpins > 0 && basePool.length > 0 && poolAfterCooldown.length === 0;
  const activePool = cooldownSaturated ? basePool : poolAfterCooldown;

  useEffect(() => {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        enabledSources,
        sourceWeights,
        weightedMode,
        cooldownSpins,
        activePreset,
      } satisfies StoredSettings),
    );
  }, [activePreset, cooldownSpins, enabledSources, sourceWeights, weightedMode]);

  useEffect(() => {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(spinHistory.slice(0, 50)));
  }, [spinHistory]);

  useEffect(() => {
    localStorage.setItem(MANUAL_GAMES_STORAGE_KEY, JSON.stringify(manualGames));
  }, [manualGames]);

  useEffect(() => {
    localStorage.setItem(
      STEAM_IMPORT_STORAGE_KEY,
      JSON.stringify({
        steamApiKey,
        steamId,
        steamImportGames,
      } satisfies StoredSteamImport),
    );
  }, [steamApiKey, steamId, steamImportGames]);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      const promptEvent = event as BeforeInstallPromptEvent;
      promptEvent.preventDefault();
      setInstallPrompt(promptEvent);
    };

    const onInstalled = () => {
      setInstallPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt as EventListener);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt as EventListener);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;

    const refreshUpdateState = async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (cancelled) return;
        setSwUpdateReady(Boolean(registration?.waiting));
      } catch {
        if (cancelled) return;
        setSwUpdateReady(false);
      }
    };

    const onUpdateReady = () => {
      setDismissedUpdate(false);
      setUpdateInProgress(false);
      void refreshUpdateState();
    };

    const onControllerChange = () => {
      window.location.reload();
    };

    window.addEventListener(SW_UPDATE_READY_EVENT, onUpdateReady);
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    void refreshUpdateState();

    return () => {
      cancelled = true;
      window.removeEventListener(SW_UPDATE_READY_EVENT, onUpdateReady);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  const markCustom = () => setActivePreset("custom");

  const applyPreset = (preset: ModePreset) => {
    setEnabledSources(preset.enabledSources);
    setSourceWeights(preset.sourceWeights);
    setWeightedMode(preset.weightedMode);
    setCooldownSpins(preset.cooldownSpins);
    setActivePreset(preset.id);
  };

  const addManualGames = () => {
    const incoming = normalizeGames(manualInput.split(/\r?\n|,/g));
    setManualGames((current) => normalizeGames([...current, ...incoming]));
    setManualInput("");
    markCustom();
  };

  const clearManualGames = () => {
    setManualGames([]);
    markCustom();
  };

  const clearHistory = () => {
    setSpinHistory([]);
  };

  const clearSteamImport = () => {
    setSteamImportGames([]);
    setSteamImportStatus("");
    markCustom();
  };

  const importSteamLibrary = async () => {
    const key = steamApiKey.trim();
    const id = steamId.trim();
    if (!key || !id) {
      setSteamImportStatus("Enter Steam Web API key and SteamID64.");
      return;
    }

    setSteamImportLoading(true);
    setSteamImportStatus("Importing Steam library...");
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
      const parsed = steamOwnedSchema.parse(json);
      const games = parsed.response.games ?? [];

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
      markCustom();
    } catch (error) {
      if (error instanceof TypeError) {
        setSteamImportStatus(
          "Steam import blocked in browser (likely CORS/network). Use the desktop app import for reliable account pulls.",
        );
      } else {
        setSteamImportStatus((error as Error).message);
      }
    } finally {
      setSteamImportLoading(false);
    }
  };

  const handleSpin = () => {
    if (spinning || activePool.length === 0) {
      return;
    }

    const weights = weightedMode ? activePool.map((candidate) => candidate.weight) : undefined;
    const result = pickSpinWithWeights(activePool.length, rotation, weights);
    const selected = activePool[result.winnerIndex];
    if (!selected) return;

    const totalWeight = weightedMode
      ? activePool.reduce((sum, candidate) => sum + candidate.weight, 0)
      : activePool.length;
    const odds = weightedMode ? selected.weight / Math.max(totalWeight, 0.0001) : 1 / activePool.length;

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
  };

  const onSpinEnd = () => {
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
      setWinnerPulse((current) => current + 1);
      setShowWinnerPopup(true);
      window.setTimeout(() => {
        setShowWinnerPopup(false);
      }, 4200);
    }
  };

  const handleInstall = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  const applyServiceWorkerUpdate = async () => {
    if (!("serviceWorker" in navigator)) return;

    setUpdateInProgress(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration?.waiting) {
        setSwUpdateReady(false);
        setUpdateInProgress(false);
        return;
      }

      registration.waiting.postMessage({ type: SW_SKIP_WAITING_MESSAGE });
      window.setTimeout(() => {
        window.location.reload();
      }, 1800);
    } catch {
      setUpdateInProgress(false);
    }
  };

  return (
    <main className="layout">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="hero">
        <p className="kicker">PickAGame</p>
        <h1>Spin For Your Next Game</h1>
        <p>
          Mix top games from SteamCharts, SteamDB/Steam charts data, TwitchMetrics, Steam account import, and your own
          list. Then spin.
        </p>
        <div className="hero-actions">
          <button
            type="button"
            className="ghost"
            aria-controls="settings-sidebar"
            aria-expanded={sidebarOpen}
            onClick={() => setSidebarOpen((current) => !current)}
          >
            {sidebarOpen ? "Hide Settings" : "Show Settings"}
          </button>
          {installPrompt ? (
            <button type="button" className="ghost" onClick={handleInstall}>
              Install App
            </button>
          ) : null}
        </div>
      </header>

      {swUpdateReady && !dismissedUpdate ? (
        <section className="update-banner" aria-live="polite">
          <div>
            <strong>Update ready</strong>
            <p>A newer version is available. Apply it now to load the latest fixes and features.</p>
          </div>
          <div className="button-row">
            <button type="button" onClick={applyServiceWorkerUpdate} disabled={updateInProgress}>
              {updateInProgress ? "Updating..." : "Update Now"}
            </button>
            <button type="button" className="ghost" onClick={() => setDismissedUpdate(true)} disabled={updateInProgress}>
              Later
            </button>
          </div>
        </section>
      ) : null}

      <div className={clsx("workspace", !sidebarOpen && "sidebar-collapsed")} id="main-content">
        <aside
          id="settings-sidebar"
          aria-label="Game settings"
          className={clsx("settings-sidebar", !sidebarOpen && "is-collapsed")}
        >
          <section className="panel" aria-labelledby="mode-presets-heading">
            <h2 id="mode-presets-heading">Mode Presets</h2>
            <div className="preset-grid">
              {modePresets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={clsx("preset-card", activePreset === preset.id && "is-active")}
                  onClick={() => applyPreset(preset)}
                >
                  <strong>{preset.label}</strong>
                  <span>{preset.description}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="panel" aria-labelledby="sources-heading">
            <h2 id="sources-heading">Sources</h2>
            <div className="grid-sources">
              {sourceKeys.map((source) => {
                const sourceMeta =
                  source === "manual"
                    ? manualGames.length
                    : source === "steamImport"
                      ? steamImportGames.length
                      : topGames?.sources[source].games.length;
                const note =
                  source === "manual"
                    ? "Your custom list"
                    : source === "steamImport"
                      ? "Imported from your Steam account"
                      : topGames?.sources[source].note;
                const fetchedAt =
                  source === "manual" || source === "steamImport" ? null : topGames?.sources[source].fetchedAt;

                return (
                  <label key={source} className={clsx("source-card", enabledSources[source] && "is-enabled")}>
                    <input
                      type="checkbox"
                      checked={enabledSources[source]}
                      onChange={() => {
                        setEnabledSources((current) => ({
                          ...current,
                          [source]: !current[source],
                        }));
                        markCustom();
                      }}
                    />
                    <div>
                      <strong>{sourceLabels[source]}</strong>
                      <p>{sourceMeta} games loaded</p>
                      {fetchedAt ? <small>Updated {new Date(fetchedAt).toLocaleString()}</small> : null}
                      {note ? <small>{note}</small> : null}
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="odds-controls">
              <label className="inline-check">
                <input
                  type="checkbox"
                  checked={weightedMode}
                  onChange={(event) => {
                    setWeightedMode(event.target.checked);
                    markCustom();
                  }}
                />
                Weighted wheel
              </label>
              <label className="cooldown-control">
                Cooldown spins
                <input
                  type="range"
                  min={0}
                  max={20}
                  value={cooldownSpins}
                  onChange={(event) => {
                    setCooldownSpins(Number(event.target.value));
                    markCustom();
                  }}
                />
                <strong>{cooldownSpins}</strong>
              </label>
            </div>

            <div className="weights-grid">
              {sourceKeys.map((source) => (
                <label key={source} className="weight-row">
                  <span>{sourceLabels[source]}</span>
                  <input
                    type="range"
                    min={0.1}
                    max={3}
                    step={0.1}
                    disabled={!weightedMode}
                    value={sourceWeights[source]}
                    onChange={(event) => {
                      setSourceWeights((current) => ({
                        ...current,
                        [source]: Number(event.target.value),
                      }));
                      markCustom();
                    }}
                  />
                  <strong>{sourceWeights[source].toFixed(1)}x</strong>
                </label>
              ))}
            </div>

            {topGamesQuery.isLoading ? (
              <p className="status" role="status" aria-live="polite">
                Loading source data...
              </p>
            ) : null}
            {topGamesQuery.isError ? (
              <p className="status error" role="alert">
                {(topGamesQuery.error as Error).message}
              </p>
            ) : null}
          </section>

          <section className="panel" aria-labelledby="steam-import-heading">
            <h2 id="steam-import-heading">Steam Account Import</h2>
            <p className="muted">
              Import owned games using Steam Web API key + SteamID64. Profile and game details must be public.
            </p>
            <div className="steam-grid">
              <label htmlFor="steam-api-key" className="sr-only">
                Steam Web API Key
              </label>
              <input
                id="steam-api-key"
                type="password"
                placeholder="Steam Web API Key"
                value={steamApiKey}
                onChange={(event) => setSteamApiKey(event.target.value)}
                autoComplete="off"
              />
              <label htmlFor="steam-id64" className="sr-only">
                SteamID64
              </label>
              <input
                id="steam-id64"
                type="text"
                placeholder="SteamID64"
                value={steamId}
                onChange={(event) => setSteamId(event.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="button-row">
              <button
                type="button"
                onClick={importSteamLibrary}
                disabled={steamImportLoading}
                aria-describedby="steam-import-status"
              >
                {steamImportLoading ? "Importing..." : "Import Steam Library"}
              </button>
              <button type="button" className="ghost" onClick={clearSteamImport}>
                Clear Import
              </button>
            </div>
            {steamImportStatus ? (
              <p id="steam-import-status" className="status" role="status" aria-live="polite">
                {steamImportStatus}
              </p>
            ) : null}
          </section>
        </aside>

        <div className="content-stack">
          <section className="panel" aria-labelledby="wheel-heading">
            <h2 id="wheel-heading">Wheel</h2>
            <p className="muted">
              {activePool.length} games in this spin pool
              {cooldownSpins > 0 ? ` (${Math.max(0, basePool.length - activePool.length)} on cooldown)` : ""}.
            </p>
            {cooldownSaturated ? (
              <p className="status">Cooldown exhausted the pool, so all entries were temporarily re-enabled.</p>
            ) : null}
            <Wheel games={activePool.map((candidate) => candidate.name)} rotation={rotation} spinning={spinning} onSpinEnd={onSpinEnd} />
            <div className="button-row">
              <button type="button" onClick={handleSpin} disabled={spinning || activePool.length === 0}>
                {spinning ? "Spinning..." : "Spin The Wheel"}
              </button>
              <button type="button" className="ghost" onClick={clearHistory}>
                Clear History
              </button>
            </div>
            {winner && winnerMeta ? (
              <div className="winner winner-rich">
                <p>You should play:</p>
                <strong>{winner}</strong>
                <div className="winner-stats">
                  <span>Sources: {sourceLabelList(winnerMeta.sources)}</span>
                  <span>Odds: {formatOdds(winnerMeta.odds)}</span>
                </div>
              </div>
            ) : null}
          </section>

          <section className="panel" aria-labelledby="manual-heading">
            <h2 id="manual-heading">Manual List</h2>
            <p className="muted">Add games by newline or comma.</p>
            <label htmlFor="manual-input" className="sr-only">
              Manual game list
            </label>
            <textarea
              id="manual-input"
              rows={5}
              value={manualInput}
              onChange={(event) => setManualInput(event.target.value)}
              placeholder="Helldivers 2&#10;Hades II&#10;Monster Hunter Wilds"
            />
            <div className="button-row">
              <button type="button" onClick={addManualGames}>
                Add Games
              </button>
              <button type="button" className="ghost" onClick={clearManualGames}>
                Clear Manual
              </button>
            </div>
          </section>

          <section className="panel" aria-labelledby="history-heading">
            <h2 id="history-heading">Spin History</h2>
            {spinHistory.length === 0 ? (
              <p className="muted">No spins yet.</p>
            ) : (
              <ul className="history-list" aria-label="Recent spin results">
                {spinHistory.slice(0, 10).map((item, index) => (
                  <li key={`${item.name}-${item.spunAt}-${index}`}>
                    <div>
                      <strong>{item.name}</strong>
                      <small>
                        {new Date(item.spunAt).toLocaleString()} | {sourceLabelList(item.sources)}
                      </small>
                    </div>
                    <span>{formatOdds(item.odds)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {showWinnerPopup && winner && winnerMeta ? (
        <div className="winner-overlay" onClick={() => setShowWinnerPopup(false)}>
          <div
            className="winner-popup"
            key={winnerPulse}
            role="dialog"
            aria-modal="true"
            aria-labelledby="winner-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="winner-glow" />
            <p className="winner-tag">Winner</p>
            <h3 id="winner-title">{winner}</h3>
            <div className="winner-moment-grid">
              <div>
                <span>Spin Odds</span>
                <strong>{formatOdds(winnerMeta.odds)}</strong>
              </div>
              <div>
                <span>Sources</span>
                <strong>{sourceLabelList(winnerMeta.sources)}</strong>
              </div>
            </div>
            <p>Commit to it. Queue it up now.</p>
            <div className="button-row">
              {winnerMeta.appId ? (
                <a className="button-link" href={`https://store.steampowered.com/app/${winnerMeta.appId}/`} target="_blank" rel="noreferrer">
                  Open Steam
                </a>
              ) : null}
              {winnerMeta.url ? (
                <a className="button-link ghost-link" href={winnerMeta.url} target="_blank" rel="noreferrer">
                  View Source
                </a>
              ) : null}
              <button type="button" onClick={() => setShowWinnerPopup(false)}>
                Nice
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
