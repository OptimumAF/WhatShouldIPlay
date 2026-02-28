import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import clsx from "clsx";
import { useTranslation } from "react-i18next";
import {
  Ban,
  BellRing,
  ChevronsUpDown,
  Cloud,
  Database,
  Download,
  Eraser,
  FilePlus2,
  Filter,
  Gamepad2,
  History,
  KeyRound,
  Library,
  PanelLeft,
  Play,
  Plus,
  RotateCw,
  Settings2,
  SlidersHorizontal,
  Trash2,
  Upload,
  WandSparkles,
} from "lucide-react";
import { normalizeGames, pickSpinWithWeights } from "./lib/wheel";
import {
  SW_NOTIFICATION_PREFS_MESSAGE,
  SW_SKIP_WAITING_MESSAGE,
  SW_TOP_GAMES_UPDATED_MESSAGE,
  SW_UPDATE_READY_EVENT,
} from "./lib/pwa";
import { Wheel } from "./components/Wheel";
import { ManualGamesPanel } from "./components/ManualGamesPanel";
import { SpinHistoryPanel } from "./components/SpinHistoryPanel";
import { WinnerSummaryCard } from "./components/WinnerSummaryCard";
import type { GameEntry, GameLength, GamePlatform, SourceId, TopGamesPayload } from "./types";

const platformSchema = z.enum(["windows", "mac", "linux"]);
const gameLengthSchema = z.enum(["short", "medium", "long"]);

const payloadGameSchema = z.object({
  name: z.string(),
  source: z.string(),
  rank: z.number().optional(),
  score: z.number().optional(),
  appId: z.number().optional(),
  url: z.string().optional(),
  platforms: z.array(platformSchema).optional(),
  tags: z.array(z.string()).optional(),
  releaseDate: z.string().optional(),
  priceUsd: z.number().optional(),
  isFree: z.boolean().optional(),
  estimatedLength: gameLengthSchema.optional(),
});

const payloadSchema = z.object({
  generatedAt: z.string(),
  sources: z.object({
    steamcharts: z.object({
      id: z.literal("steamcharts"),
      label: z.string(),
      fetchedAt: z.string(),
      note: z.string().optional(),
      games: z.array(payloadGameSchema),
    }),
    steamdb: z.object({
      id: z.literal("steamdb"),
      label: z.string(),
      fetchedAt: z.string(),
      note: z.string().optional(),
      games: z.array(payloadGameSchema),
    }),
    twitchmetrics: z.object({
      id: z.literal("twitchmetrics"),
      label: z.string(),
      fetchedAt: z.string(),
      note: z.string().optional(),
      games: z.array(payloadGameSchema),
    }),
    itchio: z.object({
      id: z.literal("itchio"),
      label: z.string(),
      fetchedAt: z.string(),
      note: z.string().optional(),
      games: z.array(payloadGameSchema),
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
        platforms: z.array(platformSchema).optional(),
        tags: z.array(z.string()).optional(),
        releaseDate: z.string().optional(),
        priceUsd: z.number().optional(),
        isFree: z.boolean().optional(),
        estimatedLength: gameLengthSchema.optional(),
      }),
    )
    .default([]),
});

const storedExclusionsSchema = z.object({
  excludePlayed: z.boolean().default(true),
  excludeCompleted: z.boolean().default(true),
  playedGames: z.array(z.string()).default([]),
  completedGames: z.array(z.string()).default([]),
});

const storedNotificationSettingsSchema = z.object({
  notificationsEnabled: z.boolean().default(false),
  trendNotifications: z.boolean().default(true),
  reminderNotifications: z.boolean().default(false),
  reminderIntervalMinutes: z.number().default(120),
});

const storedCloudSyncSchema = z.object({
  provider: z.literal("githubGist").default("githubGist"),
  gistId: z.string().default(""),
  gistToken: z.string().default(""),
});

const spinHistorySchema = z.array(
  z.object({
    name: z.string(),
    sources: z.array(z.string()),
    odds: z.number(),
    appId: z.number().optional(),
    url: z.string().optional(),
    spunAt: z.string(),
  }),
);

const cloudSyncSnapshotSchema = z.object({
  version: z.number().default(1),
  exportedAt: z.string().optional(),
  settings: z
    .object({
      enabledSources: z.record(z.string(), z.boolean()).optional(),
      sourceWeights: z.record(z.string(), z.number()).optional(),
      weightedMode: z.boolean().optional(),
      cooldownSpins: z.number().optional(),
      spinSpeedProfile: z.enum(["cinematic", "balanced", "rapid"]).optional(),
      reducedSpinAnimation: z.boolean().optional(),
      activePreset: z.string().optional(),
      filters: z
        .object({
          platform: z.string().optional(),
          tag: z.string().optional(),
          length: z.string().optional(),
          releaseFrom: z.string().optional(),
          releaseTo: z.string().optional(),
          freeOnly: z.boolean().optional(),
          maxPriceUsd: z.number().optional(),
        })
        .optional(),
    })
    .optional(),
  spinHistory: spinHistorySchema.optional(),
  manualGames: z.array(z.string()).optional(),
  steamImport: storedSteamImportSchema.optional(),
  exclusions: storedExclusionsSchema.optional(),
  notifications: storedNotificationSettingsSchema.optional(),
});

const HISTORY_STORAGE_KEY = "pickagame.spin-history.v1";
const SETTINGS_STORAGE_KEY = "pickagame.settings.v1";
const MANUAL_GAMES_STORAGE_KEY = "pickagame.manual-games.v1";
const STEAM_IMPORT_STORAGE_KEY = "pickagame.steam-import.v1";
const EXCLUSION_STORAGE_KEY = "pickagame.exclusions.v1";
const NOTIFICATION_STORAGE_KEY = "pickagame.notifications.v1";
const CLOUD_SYNC_STORAGE_KEY = "pickagame.cloud-sync.v1";
const THEME_STORAGE_KEY = "pickagame.theme.v1";
const ONBOARDING_STORAGE_KEY = "pickagame.onboarding.v1";

const sourceKeys = ["steamcharts", "steamdb", "twitchmetrics", "itchio", "manual", "steamImport"] as const;
type SourceToggleKey = (typeof sourceKeys)[number];
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

type EnabledSources = Record<SourceToggleKey, boolean>;
type SourceWeights = Record<SourceToggleKey, number>;
type ThemeMode = "system" | "light" | "dark" | "high-contrast";
type WorkspaceTab = "play" | "library" | "history" | "settings";
type SpinSpeedProfile = "cinematic" | "balanced" | "rapid";

interface PoolGame {
  name: string;
  sources: SourceId[];
  weight: number;
  appId?: number;
  url?: string;
  platforms?: GamePlatform[];
  tags?: string[];
  releaseDate?: string;
  priceUsd?: number;
  isFree?: boolean;
  estimatedLength?: GameLength;
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
  spinSpeedProfile: SpinSpeedProfile;
  reducedSpinAnimation: boolean;
  activePreset: string;
  filters: AdvancedFilters;
}

type PlatformFilter = "any" | GamePlatform;
type LengthFilter = "any" | GameLength;

interface AdvancedFilters {
  platform: PlatformFilter;
  tag: string;
  length: LengthFilter;
  releaseFrom: string;
  releaseTo: string;
  freeOnly: boolean;
  maxPriceUsd: number;
}

interface StoredSteamImport {
  steamApiKey: string;
  steamId: string;
  steamImportGames: GameEntry[];
}

interface StoredExclusions {
  excludePlayed: boolean;
  excludeCompleted: boolean;
  playedGames: string[];
  completedGames: string[];
}

interface StoredNotificationSettings {
  notificationsEnabled: boolean;
  trendNotifications: boolean;
  reminderNotifications: boolean;
  reminderIntervalMinutes: number;
}

interface StoredCloudSync {
  provider: "githubGist";
  gistId: string;
  gistToken: string;
}

interface ToastMessage {
  id: string;
  tone: "info" | "success" | "error";
  text: string;
}

interface ScreenReaderAnnouncement {
  id: number;
  text: string;
}

interface OnboardingStep {
  title: string;
  description: string;
  focusTab: WorkspaceTab;
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
  itchio: "itch.io",
  manual: "Manual",
  steamImport: "Steam Library",
};

const defaultEnabledSources: EnabledSources = {
  steamcharts: true,
  steamdb: true,
  twitchmetrics: true,
  itchio: false,
  manual: true,
  steamImport: true,
};

const defaultSourceWeights: SourceWeights = {
  steamcharts: 1.2,
  steamdb: 1.15,
  twitchmetrics: 1,
  itchio: 0.95,
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
      itchio: false,
      manual: true,
      steamImport: true,
    },
    sourceWeights: {
      steamcharts: 0.6,
      steamdb: 0.6,
      twitchmetrics: 0.6,
      itchio: 0.8,
      manual: 1.1,
      steamImport: 1.8,
    },
    weightedMode: true,
    cooldownSpins: 5,
  },
];

const defaultFilters: AdvancedFilters = {
  platform: "any",
  tag: "any",
  length: "any",
  releaseFrom: "",
  releaseTo: "",
  freeOnly: false,
  maxPriceUsd: 70,
};

const spinSpeedProfiles: Record<
  SpinSpeedProfile,
  { label: string; durationMs: number; revolutions: number; jitterRatio: number }
> = {
  cinematic: {
    label: "Cinematic",
    durationMs: 6200,
    revolutions: 10.5,
    jitterRatio: 0.28,
  },
  balanced: {
    label: "Balanced",
    durationMs: 4800,
    revolutions: 8,
    jitterRatio: 0.24,
  },
  rapid: {
    label: "Rapid",
    durationMs: 3200,
    revolutions: 6.4,
    jitterRatio: 0.2,
  },
};

const fallbackSettings: StoredSettings = {
  enabledSources: defaultEnabledSources,
  sourceWeights: defaultSourceWeights,
  weightedMode: true,
  cooldownSpins: 2,
  spinSpeedProfile: "balanced",
  reducedSpinAnimation: false,
  activePreset: "balanced",
  filters: defaultFilters,
};

const fallbackSteamImport: StoredSteamImport = {
  steamApiKey: "",
  steamId: "",
  steamImportGames: [],
};

const fallbackExclusions: StoredExclusions = {
  excludePlayed: true,
  excludeCompleted: true,
  playedGames: [],
  completedGames: [],
};

const fallbackNotificationSettings: StoredNotificationSettings = {
  notificationsEnabled: false,
  trendNotifications: true,
  reminderNotifications: false,
  reminderIntervalMinutes: 120,
};

const fallbackCloudSync: StoredCloudSync = {
  provider: "githubGist",
  gistId: "",
  gistToken: "",
};

const onboardingSteps: OnboardingStep[] = [
  {
    title: "Build your library",
    description: "Use Library to add manual games and Steam imports before you spin.",
    focusTab: "library",
  },
  {
    title: "Tune your rules",
    description: "Use Settings for source toggles, weighted odds, cooldown, filters, and cloud sync.",
    focusTab: "settings",
  },
  {
    title: "Spin and commit",
    description: "Go to Play and spin. Winner details include odds and source attribution.",
    focusTab: "play",
  },
];

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

const sanitizeFilters = (input: AdvancedFilters | null | undefined): AdvancedFilters => {
  if (!input) return defaultFilters;
  const validPlatforms: PlatformFilter[] = ["any", "windows", "mac", "linux"];
  const validLengths: LengthFilter[] = ["any", "short", "medium", "long"];

  return {
    platform: validPlatforms.includes(input.platform) ? input.platform : defaultFilters.platform,
    tag: typeof input.tag === "string" && input.tag.trim() ? input.tag.trim() : "any",
    length: validLengths.includes(input.length) ? input.length : defaultFilters.length,
    releaseFrom: typeof input.releaseFrom === "string" ? input.releaseFrom : "",
    releaseTo: typeof input.releaseTo === "string" ? input.releaseTo : "",
    freeOnly: Boolean(input.freeOnly),
    maxPriceUsd:
      typeof input.maxPriceUsd === "number" && Number.isFinite(input.maxPriceUsd)
        ? Math.max(0, Math.min(120, input.maxPriceUsd))
        : defaultFilters.maxPriceUsd,
  };
};

const sanitizeSpinSpeedProfile = (input: unknown): SpinSpeedProfile => {
  if (input === "cinematic" || input === "balanced" || input === "rapid") {
    return input;
  }
  return fallbackSettings.spinSpeedProfile;
};

const sanitizeSettings = (input: StoredSettings | null): StoredSettings => {
  if (!input) return fallbackSettings;
  const activePreset = input.activePreset || fallbackSettings.activePreset;
  const matchedPreset = activePreset === "custom" ? undefined : modePresets.find((preset) => preset.id === activePreset);
  const fallbackCooldown =
    typeof input.cooldownSpins === "number" && Number.isFinite(input.cooldownSpins)
      ? Math.max(0, Math.min(20, Math.round(input.cooldownSpins)))
      : fallbackSettings.cooldownSpins;
  const partialSettings = input as Partial<StoredSettings>;
  const spinSpeedProfile = sanitizeSpinSpeedProfile(partialSettings.spinSpeedProfile);
  const reducedSpinAnimation =
    typeof partialSettings.reducedSpinAnimation === "boolean"
      ? partialSettings.reducedSpinAnimation
      : fallbackSettings.reducedSpinAnimation;

  if (matchedPreset) {
    return {
      enabledSources: { ...matchedPreset.enabledSources },
      sourceWeights: { ...matchedPreset.sourceWeights },
      weightedMode: matchedPreset.weightedMode,
      cooldownSpins: matchedPreset.cooldownSpins,
      spinSpeedProfile,
      reducedSpinAnimation,
      activePreset,
      filters: sanitizeFilters(input.filters),
    };
  }

  return {
    enabledSources: { ...defaultEnabledSources, ...(input.enabledSources ?? {}) },
    sourceWeights: { ...defaultSourceWeights, ...(input.sourceWeights ?? {}) },
    weightedMode: typeof input.weightedMode === "boolean" ? input.weightedMode : fallbackSettings.weightedMode,
    cooldownSpins: fallbackCooldown,
    spinSpeedProfile,
    reducedSpinAnimation,
    activePreset,
    filters: sanitizeFilters(input.filters),
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
      platforms: entry.platforms,
      tags: entry.tags,
      releaseDate: entry.releaseDate,
      priceUsd: entry.priceUsd,
      isFree: entry.isFree,
      estimatedLength: entry.estimatedLength,
    });
  });

  return {
    steamApiKey: parsed.data.steamApiKey,
    steamId: parsed.data.steamId,
    steamImportGames: [...deduped.values()],
  };
};

const sanitizeExclusions = (input: StoredExclusions | null): StoredExclusions => {
  if (!input) return fallbackExclusions;
  const parsed = storedExclusionsSchema.safeParse(input);
  if (!parsed.success) return fallbackExclusions;

  const completedGames = normalizeGames(parsed.data.completedGames);
  const completedSet = new Set(completedGames.map((name) => name.toLowerCase()));
  const playedGames = normalizeGames(parsed.data.playedGames).filter((name) => !completedSet.has(name.toLowerCase()));

  return {
    excludePlayed: parsed.data.excludePlayed,
    excludeCompleted: parsed.data.excludeCompleted,
    playedGames,
    completedGames,
  };
};

const sanitizeNotificationSettings = (input: StoredNotificationSettings | null): StoredNotificationSettings => {
  if (!input) return fallbackNotificationSettings;
  const parsed = storedNotificationSettingsSchema.safeParse(input);
  if (!parsed.success) return fallbackNotificationSettings;
  return {
    notificationsEnabled: parsed.data.notificationsEnabled,
    trendNotifications: parsed.data.trendNotifications,
    reminderNotifications: parsed.data.reminderNotifications,
    reminderIntervalMinutes: Math.max(15, Math.min(720, Math.round(parsed.data.reminderIntervalMinutes))),
  };
};

const sanitizeCloudSync = (input: StoredCloudSync | null): StoredCloudSync => {
  if (!input) return fallbackCloudSync;
  const parsed = storedCloudSyncSchema.safeParse(input);
  if (!parsed.success) return fallbackCloudSync;
  return {
    provider: "githubGist",
    gistId: parsed.data.gistId.trim(),
    gistToken: parsed.data.gistToken.trim(),
  };
};

const sanitizeThemeMode = (input: ThemeMode | null): ThemeMode => {
  if (input === "light" || input === "dark" || input === "high-contrast" || input === "system") {
    return input;
  }
  return "system";
};

const getFocusableElements = (root: HTMLElement) =>
  [...root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter(
    (element) => !element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true",
  );

const keepFocusInContainer = (event: KeyboardEvent, root: HTMLElement) => {
  if (event.key !== "Tab") return;
  const focusable = getFocusableElements(root);
  if (focusable.length === 0) {
    event.preventDefault();
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const activeElement = document.activeElement as HTMLElement | null;
  if (!event.shiftKey && activeElement === last) {
    event.preventDefault();
    first.focus();
  } else if (event.shiftKey && activeElement === first) {
    event.preventDefault();
    last.focus();
  }
};

function HelpTip({ text }: { text: string }) {
  return (
    <span className="help-tip" tabIndex={0} aria-label={text}>
      ?
      <span role="tooltip" className="help-tip-bubble">
        {text}
      </span>
    </span>
  );
}

export default function App() {
  const { t, i18n } = useTranslation();

  const initialSettings = sanitizeSettings(readStorage<StoredSettings | null>(SETTINGS_STORAGE_KEY, null));
  const initialHistory = readStorage<SpinHistoryItem[]>(HISTORY_STORAGE_KEY, []);
  const initialManualGames = normalizeGames(readStorage<string[]>(MANUAL_GAMES_STORAGE_KEY, []));
  const initialSteamImport = sanitizeSteamImport(readStorage<StoredSteamImport | null>(STEAM_IMPORT_STORAGE_KEY, null));
  const initialExclusions = sanitizeExclusions(readStorage<StoredExclusions | null>(EXCLUSION_STORAGE_KEY, null));
  const initialNotifications = sanitizeNotificationSettings(
    readStorage<StoredNotificationSettings | null>(NOTIFICATION_STORAGE_KEY, null),
  );
  const initialCloudSync = sanitizeCloudSync(readStorage<StoredCloudSync | null>(CLOUD_SYNC_STORAGE_KEY, null));
  const initialThemeMode = sanitizeThemeMode(readStorage<ThemeMode | null>(THEME_STORAGE_KEY, null));
  const initialOnboardingDone = readStorage<boolean | null>(ONBOARDING_STORAGE_KEY, null) === true;

  const [enabledSources, setEnabledSources] = useState<EnabledSources>(initialSettings.enabledSources);
  const [sourceWeights, setSourceWeights] = useState<SourceWeights>(initialSettings.sourceWeights);
  const [weightedMode, setWeightedMode] = useState(initialSettings.weightedMode);
  const [cooldownSpins, setCooldownSpins] = useState(initialSettings.cooldownSpins);
  const [spinSpeedProfile, setSpinSpeedProfile] = useState<SpinSpeedProfile>(initialSettings.spinSpeedProfile);
  const [reducedSpinAnimation, setReducedSpinAnimation] = useState(initialSettings.reducedSpinAnimation);
  const [activePreset, setActivePreset] = useState(initialSettings.activePreset);
  const [filters, setFilters] = useState<AdvancedFilters>(sanitizeFilters(initialSettings.filters));

  const [manualInput, setManualInput] = useState("");
  const [manualGames, setManualGames] = useState<string[]>(initialManualGames);
  const [steamImportGames, setSteamImportGames] = useState<GameEntry[]>(initialSteamImport.steamImportGames);
  const [steamApiKey, setSteamApiKey] = useState(initialSteamImport.steamApiKey);
  const [steamId, setSteamId] = useState(initialSteamImport.steamId);
  const [steamImportStatus, setSteamImportStatus] = useState<string>("");
  const [steamImportLoading, setSteamImportLoading] = useState(false);
  const [excludePlayed, setExcludePlayed] = useState(initialExclusions.excludePlayed);
  const [excludeCompleted, setExcludeCompleted] = useState(initialExclusions.excludeCompleted);
  const [playedGames, setPlayedGames] = useState<string[]>(initialExclusions.playedGames);
  const [completedGames, setCompletedGames] = useState<string[]>(initialExclusions.completedGames);
  const [exclusionInput, setExclusionInput] = useState("");
  const [notificationsEnabled, setNotificationsEnabled] = useState(initialNotifications.notificationsEnabled);
  const [trendNotifications, setTrendNotifications] = useState(initialNotifications.trendNotifications);
  const [reminderNotifications, setReminderNotifications] = useState(initialNotifications.reminderNotifications);
  const [reminderIntervalMinutes, setReminderIntervalMinutes] = useState(initialNotifications.reminderIntervalMinutes);
  const [notificationStatus, setNotificationStatus] = useState("");
  const [freshTrendsNotice, setFreshTrendsNotice] = useState(false);
  const [cloudProvider] = useState<StoredCloudSync["provider"]>(initialCloudSync.provider);
  const [gistId, setGistId] = useState(initialCloudSync.gistId);
  const [gistToken, setGistToken] = useState(initialCloudSync.gistToken);
  const [cloudSyncStatus, setCloudSyncStatus] = useState("");
  const [cloudSyncLoading, setCloudSyncLoading] = useState(false);

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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>(initialThemeMode);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("play");
  const [showOnboarding, setShowOnboarding] = useState(!initialOnboardingDone);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [screenReaderPolite, setScreenReaderPolite] = useState<ScreenReaderAnnouncement>({ id: 0, text: "" });
  const [screenReaderAssertive, setScreenReaderAssertive] = useState<ScreenReaderAnnouncement>({ id: 0, text: "" });
  const winnerPopupCloseRef = useRef<HTMLButtonElement | null>(null);
  const winnerPopupRef = useRef<HTMLDivElement | null>(null);
  const onboardingCardRef = useRef<HTMLDivElement | null>(null);
  const toastTimeoutsRef = useRef<number[]>([]);
  const lastTopGamesErrorRef = useRef("");
  const announcementCounterRef = useRef(0);

  const topGamesQuery = useQuery({
    queryKey: ["top-games"],
    queryFn: fetchTopGames,
    staleTime: 1000 * 60 * 10,
  });

  const topGames = topGamesQuery.data;
  const onboardingLastStep = onboardingSteps.length - 1;

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const announceForScreenReader = useCallback((tone: ToastMessage["tone"], text: string) => {
    const cleaned = text.trim();
    if (!cleaned) return;
    announcementCounterRef.current += 1;
    const payload = { id: announcementCounterRef.current, text: cleaned };
    if (tone === "error") {
      setScreenReaderAssertive(payload);
      return;
    }
    setScreenReaderPolite(payload);
  }, []);

  const pushToast = useCallback(
    (tone: ToastMessage["tone"], text: string) => {
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setToasts((current) => [...current, { id, tone, text }]);
      announceForScreenReader(tone, text);
      const timeoutId = window.setTimeout(() => {
        dismissToast(id);
      }, 5200);
      toastTimeoutsRef.current.push(timeoutId);
    },
    [announceForScreenReader, dismissToast],
  );

  const completeOnboarding = useCallback(
    (nextTab: WorkspaceTab = "play") => {
      setShowOnboarding(false);
      setOnboardingStep(0);
      setActiveTab(nextTab);
      if (nextTab === "settings") {
        setSidebarOpen(true);
      }
      localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(true));
      pushToast("success", "Quick start complete. You can reopen it anytime from Quick Tour.");
    },
    [pushToast],
  );

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
      entries.push(...topGames.sources.itchio.games);
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
        byName.set(key, {
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

    return [...byName.values()];
  }, [allEntries, enabledSources, sourceWeights, weightedMode]);

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

  const statusBlockedNames = useMemo(() => {
    const blocked = new Set<string>();
    if (excludePlayed) {
      playedGames.forEach((name) => blocked.add(name.toLowerCase()));
    }
    if (excludeCompleted) {
      completedGames.forEach((name) => blocked.add(name.toLowerCase()));
    }
    return blocked;
  }, [completedGames, excludeCompleted, excludePlayed, playedGames]);

  const poolAfterStatusExclusions = useMemo(
    () => poolAfterAdvancedFilters.filter((candidate) => !statusBlockedNames.has(candidate.name.toLowerCase())),
    [poolAfterAdvancedFilters, statusBlockedNames],
  );

  const blockedNames = useMemo(
    () => new Set(spinHistory.slice(0, cooldownSpins).map((item) => item.name.toLowerCase())),
    [spinHistory, cooldownSpins],
  );

  const poolAfterCooldown = useMemo(
    () => poolAfterStatusExclusions.filter((candidate) => !blockedNames.has(candidate.name.toLowerCase())),
    [blockedNames, poolAfterStatusExclusions],
  );

  const cooldownSaturated = cooldownSpins > 0 && poolAfterStatusExclusions.length > 0 && poolAfterCooldown.length === 0;
  const statusExhausted =
    poolAfterStatusExclusions.length === 0 && poolAfterAdvancedFilters.length > 0 && statusBlockedNames.size > 0;
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
  const filterExcludedCount = Math.max(0, basePool.length - poolAfterAdvancedFilters.length);
  const statusExcludedCount = Math.max(0, poolAfterAdvancedFilters.length - poolAfterStatusExclusions.length);
  const cooldownExcludedCount = Math.max(0, poolAfterStatusExclusions.length - poolAfterCooldown.length);

  useEffect(() => {
    if (filters.tag === "any") return;
    if (availableTags.some((tag) => tag.toLowerCase() === filters.tag.toLowerCase())) return;
    setFilters((current) => ({ ...current, tag: "any" }));
  }, [availableTags, filters.tag]);

  useEffect(() => {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        enabledSources,
        sourceWeights,
        weightedMode,
        cooldownSpins,
        spinSpeedProfile,
        reducedSpinAnimation,
        activePreset,
        filters,
      } satisfies StoredSettings),
    );
  }, [activePreset, cooldownSpins, enabledSources, filters, reducedSpinAnimation, sourceWeights, spinSpeedProfile, weightedMode]);

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
    localStorage.setItem(
      EXCLUSION_STORAGE_KEY,
      JSON.stringify({
        excludePlayed,
        excludeCompleted,
        playedGames,
        completedGames,
      } satisfies StoredExclusions),
    );
  }, [completedGames, excludeCompleted, excludePlayed, playedGames]);

  useEffect(() => {
    localStorage.setItem(
      NOTIFICATION_STORAGE_KEY,
      JSON.stringify({
        notificationsEnabled,
        trendNotifications,
        reminderNotifications,
        reminderIntervalMinutes,
      } satisfies StoredNotificationSettings),
    );
  }, [notificationsEnabled, reminderIntervalMinutes, reminderNotifications, trendNotifications]);

  useEffect(() => {
    localStorage.setItem(
      CLOUD_SYNC_STORAGE_KEY,
      JSON.stringify({
        provider: cloudProvider,
        gistId,
        gistToken,
      } satisfies StoredCloudSync),
    );
  }, [cloudProvider, gistId, gistToken]);

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(themeMode));
  }, [themeMode]);

  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const applyTheme = () => {
      const resolvedTheme =
        themeMode === "system" ? (mediaQuery.matches ? "dark" : "light") : themeMode;
      root.dataset.theme = resolvedTheme;
    };

    applyTheme();
    if (themeMode !== "system") {
      return;
    }

    const onThemeChange = () => applyTheme();
    mediaQuery.addEventListener("change", onThemeChange);
    return () => {
      mediaQuery.removeEventListener("change", onThemeChange);
    };
  }, [themeMode]);

  useEffect(() => {
    if (activeTab === "settings") {
      setSidebarOpen(true);
    }
  }, [activeTab]);

  useEffect(() => {
    return () => {
      toastTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
      toastTimeoutsRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (!showOnboarding) return;
    const step = onboardingSteps[onboardingStep];
    if (!step) return;
    setActiveTab(step.focusTab);
    if (step.focusTab === "settings") {
      setSidebarOpen(true);
    }
  }, [onboardingStep, showOnboarding]);

  useEffect(() => {
    if (!topGamesQuery.isError) {
      lastTopGamesErrorRef.current = "";
      return;
    }
    const errorText = (topGamesQuery.error as Error)?.message ?? "Unable to load top game data.";
    if (lastTopGamesErrorRef.current === errorText) return;
    lastTopGamesErrorRef.current = errorText;
    pushToast("error", `${errorText} Retry in a minute or check your network connection.`);
  }, [pushToast, topGamesQuery.error, topGamesQuery.isError]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const postPrefs = async () => {
      const payload = {
        enabled: notificationsEnabled,
        newTrends: trendNotifications,
      };
      try {
        const registration = await navigator.serviceWorker.ready;
        registration.active?.postMessage({ type: SW_NOTIFICATION_PREFS_MESSAGE, payload });
        navigator.serviceWorker.controller?.postMessage({ type: SW_NOTIFICATION_PREFS_MESSAGE, payload });
      } catch {
        // Best effort only.
      }
    };

    void postPrefs();
  }, [notificationsEnabled, trendNotifications]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const onServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type !== SW_TOP_GAMES_UPDATED_MESSAGE) return;
      setFreshTrendsNotice(true);
    };

    navigator.serviceWorker.addEventListener("message", onServiceWorkerMessage);
    return () => {
      navigator.serviceWorker.removeEventListener("message", onServiceWorkerMessage);
    };
  }, []);

  useEffect(() => {
    if (!showWinnerPopup) return;
    const container = winnerPopupRef.current;
    if (!container) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const focusable = getFocusableElements(container);
    const initialFocus = winnerPopupCloseRef.current ?? focusable[0] ?? container;
    initialFocus.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowWinnerPopup(false);
        return;
      }
      keepFocusInContainer(event, container);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [showWinnerPopup]);

  useEffect(() => {
    if (!showOnboarding) return;
    const container = onboardingCardRef.current;
    if (!container) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const focusable = getFocusableElements(container);
    (focusable[0] ?? container).focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowOnboarding(false);
        return;
      }
      keepFocusInContainer(event, container);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [showOnboarding]);

  useEffect(() => {
    if (!notificationsEnabled || !reminderNotifications) return;
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") return;

      navigator.serviceWorker.ready
        .then((registration) => {
          registration.showNotification("Play something now?", {
            body: "You set a reminder to spin WhatShouldIPlay.",
            tag: "pickagame-reminder",
          });
        })
        .catch(() => {
          // Ignore transient notification failures.
        });
    }, Math.max(15, reminderIntervalMinutes) * 60 * 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [notificationsEnabled, reminderIntervalMinutes, reminderNotifications]);

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

  const markGamesPlayed = (names: string[]) => {
    const incoming = normalizeGames(names);
    if (incoming.length === 0) return;
    const completedSet = new Set(completedGames.map((name) => name.toLowerCase()));
    setPlayedGames((current) =>
      normalizeGames([...current, ...incoming]).filter((name) => !completedSet.has(name.toLowerCase())),
    );
  };

  const markGamesCompleted = (names: string[]) => {
    const incoming = normalizeGames(names);
    if (incoming.length === 0) return;
    const incomingSet = new Set(incoming.map((name) => name.toLowerCase()));
    setCompletedGames((current) => normalizeGames([...current, ...incoming]));
    setPlayedGames((current) => current.filter((name) => !incomingSet.has(name.toLowerCase())));
  };

  const removePlayedGame = (name: string) => {
    const key = name.toLowerCase();
    setPlayedGames((current) => current.filter((entry) => entry.toLowerCase() !== key));
  };

  const removeCompletedGame = (name: string) => {
    const key = name.toLowerCase();
    setCompletedGames((current) => current.filter((entry) => entry.toLowerCase() !== key));
  };

  const addExclusionFromInput = (target: "played" | "completed") => {
    const incoming = normalizeGames(exclusionInput.split(/\r?\n|,/g));
    if (incoming.length === 0) return;
    if (target === "played") {
      markGamesPlayed(incoming);
    } else {
      markGamesCompleted(incoming);
    }
    setExclusionInput("");
  };

  const importSteamLibrary = async () => {
    const key = steamApiKey.trim();
    const id = steamId.trim();
    if (!key || !id) {
      setSteamImportStatus("Enter Steam Web API key and SteamID64.");
      pushToast("error", "Steam import needs both Steam Web API key and SteamID64.");
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
      pushToast("success", `Imported ${imported.length} games from Steam.`);
      markCustom();
    } catch (error) {
      if (error instanceof TypeError) {
        const message =
          "Steam import blocked in browser (likely CORS/network). Use the desktop app import for reliable account pulls.";
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
  };

  const handleSpin = () => {
    if (spinning || activePool.length === 0) {
      return;
    }

    const weights = weightedMode ? activePool.map((candidate) => candidate.weight) : undefined;
    const result = pickSpinWithWeights(activePool.length, rotation, weights, spinMotion);
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
      announceForScreenReader(
        "success",
        `Winner selected: ${finalWinner}. Odds ${formatOdds(finalMeta.odds)}. Sources ${sourceLabelList(finalMeta.sources)}.`,
      );
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

  const setNotificationsEnabledWithPermission = async (enabled: boolean) => {
    if (!enabled) {
      setNotificationsEnabled(false);
      setNotificationStatus(t("notificationsDisabledStatus"));
      return;
    }

    if (!("Notification" in window)) {
      setNotificationsEnabled(false);
      setNotificationStatus(t("notificationsUnsupportedStatus"));
      return;
    }

    if (Notification.permission === "granted") {
      setNotificationsEnabled(true);
      setNotificationStatus(t("notificationsEnabledStatus"));
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      setNotificationsEnabled(true);
      setNotificationStatus(t("notificationsEnabledStatus"));
    } else {
      setNotificationsEnabled(false);
      setNotificationStatus(t("notificationsDeniedStatus"));
    }
  };

  const buildCloudSnapshot = () => ({
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: {
      enabledSources,
      sourceWeights,
      weightedMode,
      cooldownSpins,
      spinSpeedProfile,
      reducedSpinAnimation,
      activePreset,
      filters,
    } satisfies StoredSettings,
    spinHistory: spinHistory.slice(0, 50),
    manualGames,
    steamImport: {
      steamApiKey,
      steamId,
      steamImportGames,
    } satisfies StoredSteamImport,
    exclusions: {
      excludePlayed,
      excludeCompleted,
      playedGames,
      completedGames,
    } satisfies StoredExclusions,
    notifications: {
      notificationsEnabled,
      trendNotifications,
      reminderNotifications,
      reminderIntervalMinutes,
    } satisfies StoredNotificationSettings,
  });

  const applyCloudSnapshot = (rawSnapshot: unknown) => {
    const parsed = cloudSyncSnapshotSchema.safeParse(rawSnapshot);
    if (!parsed.success) {
      throw new Error("Cloud snapshot format is invalid.");
    }
    const snapshot = parsed.data;

    if (snapshot.settings) {
      const sanitized = sanitizeSettings(snapshot.settings as StoredSettings);
      setEnabledSources(sanitized.enabledSources);
      setSourceWeights(sanitized.sourceWeights);
      setWeightedMode(sanitized.weightedMode);
      setCooldownSpins(sanitized.cooldownSpins);
      setSpinSpeedProfile(sanitized.spinSpeedProfile);
      setReducedSpinAnimation(sanitized.reducedSpinAnimation);
      setActivePreset(sanitized.activePreset);
      setFilters(sanitizeFilters(sanitized.filters));
    }

    if (snapshot.spinHistory) {
      const history = snapshot.spinHistory.map((entry) => ({
        ...entry,
        sources: entry.sources as SourceId[],
      }));
      setSpinHistory(history.slice(0, 50));
    }

    if (snapshot.manualGames) {
      setManualGames(normalizeGames(snapshot.manualGames));
    }

    if (snapshot.steamImport) {
      const sanitized = sanitizeSteamImport(snapshot.steamImport as StoredSteamImport);
      setSteamApiKey(sanitized.steamApiKey);
      setSteamId(sanitized.steamId);
      setSteamImportGames(sanitized.steamImportGames);
    }

    if (snapshot.exclusions) {
      const sanitized = sanitizeExclusions(snapshot.exclusions as StoredExclusions);
      setExcludePlayed(sanitized.excludePlayed);
      setExcludeCompleted(sanitized.excludeCompleted);
      setPlayedGames(sanitized.playedGames);
      setCompletedGames(sanitized.completedGames);
    }

    if (snapshot.notifications) {
      const sanitized = sanitizeNotificationSettings(snapshot.notifications as StoredNotificationSettings);
      setNotificationsEnabled(sanitized.notificationsEnabled);
      setTrendNotifications(sanitized.trendNotifications);
      setReminderNotifications(sanitized.reminderNotifications);
      setReminderIntervalMinutes(sanitized.reminderIntervalMinutes);
    }
  };

  const pushCloudSync = async () => {
    const token = gistToken.trim();
    if (!token) {
      setCloudSyncStatus("Enter a GitHub token with gist scope.");
      pushToast("error", "Cloud sync needs a GitHub token with gist scope.");
      return;
    }
    if (!gistId.trim()) {
      setCloudSyncStatus("Enter a Gist ID or create one first.");
      pushToast("error", "Provide a Gist ID before pushing sync.");
      return;
    }

    setCloudSyncLoading(true);
    setCloudSyncStatus("Uploading sync snapshot...");
    try {
      const response = await fetch(`https://api.github.com/gists/${gistId.trim()}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
          accept: "application/vnd.github+json",
        },
        body: JSON.stringify({
          files: {
            "whatshouldiplay-sync.json": {
              content: JSON.stringify(buildCloudSnapshot(), null, 2),
            },
          },
        }),
      });
      if (!response.ok) {
        throw new Error(`Cloud sync upload failed (${response.status}).`);
      }
      setCloudSyncStatus("Cloud sync uploaded.");
      pushToast("success", "Cloud sync uploaded.");
    } catch (error) {
      const message = (error as Error).message;
      setCloudSyncStatus(message);
      pushToast("error", `${message} Check token permissions and gist access, then retry.`);
    } finally {
      setCloudSyncLoading(false);
    }
  };

  const createCloudSyncGist = async () => {
    const token = gistToken.trim();
    if (!token) {
      setCloudSyncStatus("Enter a GitHub token with gist scope.");
      pushToast("error", "Enter a GitHub token with gist scope to create sync gist.");
      return;
    }

    setCloudSyncLoading(true);
    setCloudSyncStatus("Creating secret gist...");
    try {
      const response = await fetch("https://api.github.com/gists", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
          accept: "application/vnd.github+json",
        },
        body: JSON.stringify({
          description: "WhatShouldIPlay cloud sync",
          public: false,
          files: {
            "whatshouldiplay-sync.json": {
              content: JSON.stringify(buildCloudSnapshot(), null, 2),
            },
          },
        }),
      });
      if (!response.ok) {
        throw new Error(`Could not create gist (${response.status}).`);
      }
      const json = (await response.json()) as { id?: string };
      if (!json.id) {
        throw new Error("GitHub API did not return gist id.");
      }
      setGistId(json.id);
      setCloudSyncStatus(`Created sync gist ${json.id}.`);
      pushToast("success", `Created sync gist ${json.id}.`);
    } catch (error) {
      const message = (error as Error).message;
      setCloudSyncStatus(message);
      pushToast("error", `${message} Verify token scope and GitHub API availability.`);
    } finally {
      setCloudSyncLoading(false);
    }
  };

  const pullCloudSync = async () => {
    const token = gistToken.trim();
    if (!token) {
      setCloudSyncStatus("Enter a GitHub token with gist scope.");
      pushToast("error", "Cloud sync pull needs a GitHub token with gist scope.");
      return;
    }
    if (!gistId.trim()) {
      setCloudSyncStatus("Enter a Gist ID to pull from cloud.");
      pushToast("error", "Provide a Gist ID before pulling sync.");
      return;
    }

    setCloudSyncLoading(true);
    setCloudSyncStatus("Downloading sync snapshot...");
    try {
      const response = await fetch(`https://api.github.com/gists/${gistId.trim()}`, {
        headers: {
          authorization: `Bearer ${token}`,
          accept: "application/vnd.github+json",
        },
      });
      if (!response.ok) {
        throw new Error(`Cloud sync download failed (${response.status}).`);
      }
      const json = (await response.json()) as {
        files?: Record<string, { content?: string; raw_url?: string }>;
      };
      const file =
        json.files?.["whatshouldiplay-sync.json"] ??
        Object.values(json.files ?? {})[0];
      if (!file) {
        throw new Error("No sync file found in gist.");
      }
      let content = file.content ?? "";
      if (!content && file.raw_url) {
        const raw = await fetch(file.raw_url);
        if (!raw.ok) {
          throw new Error(`Failed to load gist raw file (${raw.status}).`);
        }
        content = await raw.text();
      }
      if (!content) {
        throw new Error("Sync file content is empty.");
      }
      const parsed = JSON.parse(content) as unknown;
      applyCloudSnapshot(parsed);
      setCloudSyncStatus("Cloud sync downloaded and applied.");
      pushToast("success", "Cloud sync downloaded and applied.");
    } catch (error) {
      const message = (error as Error).message;
      setCloudSyncStatus(message);
      pushToast("error", `${message} Confirm gist ID/token and retry.`);
    } finally {
      setCloudSyncLoading(false);
    }
  };

  const filterExcludedSuffix = filterExcludedCount > 0 ? t("filteredSuffix", { count: filterExcludedCount }) : "";
  const statusExcludedSuffix =
    statusExcludedCount > 0 ? t("statusExcludedSuffix", { count: statusExcludedCount }) : "";
  const cooldownExcludedSuffix =
    cooldownSpins > 0 ? t("cooldownExcludedSuffix", { count: cooldownExcludedCount }) : "";
  const exclusionSummarySuffix = `${filterExcludedSuffix}${statusExcludedSuffix}`;
  const spinProfileConfig = spinSpeedProfiles[spinSpeedProfile];
  const effectiveSpinDurationMs = reducedSpinAnimation ? 760 : spinProfileConfig.durationMs;
  const spinMotion =
    reducedSpinAnimation
      ? { revolutions: 2.2, jitterRatio: 0.1 }
      : {
          revolutions: spinProfileConfig.revolutions,
          jitterRatio: spinProfileConfig.jitterRatio,
        };
  const showSettingsPane = activeTab === "play" || activeTab === "settings";
  const showPlayPane = activeTab === "play";
  const showLibraryPane = activeTab === "play" || activeTab === "library";
  const showHistoryPane = activeTab === "play" || activeTab === "history";
  const settingsSidebarVisible = sidebarOpen && showSettingsPane;
  const historyDisplayItems = spinHistory.slice(0, 10).map((item, index) => ({
    key: `${item.name}-${item.spunAt}-${index}`,
    name: item.name,
    meta: `${new Date(item.spunAt).toLocaleString()} | ${sourceLabelList(item.sources)}`,
    odds: formatOdds(item.odds),
  }));

  return (
    <main className="layout">
      <a className="skip-link" href="#main-content">
        {t("skipToMain")}
      </a>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        <span key={screenReaderPolite.id}>{screenReaderPolite.text}</span>
      </div>
      <div className="sr-only" aria-live="assertive" aria-atomic="true">
        <span key={screenReaderAssertive.id}>{screenReaderAssertive.text}</span>
      </div>
      <header className="hero">
        <p className="kicker">{t("appName")}</p>
        <h1>{t("heroTitle")}</h1>
        <p>{t("heroDescription")}</p>
        <div className="hero-actions">
          <button
            type="button"
            className="ghost"
            aria-controls="settings-sidebar"
            aria-expanded={settingsSidebarVisible}
            onClick={() =>
              setSidebarOpen((current) => {
                const next = !current;
                if (!next && activeTab === "settings") {
                  setActiveTab("play");
                }
                return next;
              })
            }
          >
            <span className="button-label">
              <PanelLeft className="ui-icon" aria-hidden="true" />
              {sidebarOpen ? t("hideSettings") : t("showSettings")}
            </span>
          </button>
          <button
            type="button"
            className="ghost"
            onClick={() => {
              setOnboardingStep(0);
              setShowOnboarding(true);
            }}
          >
            <span className="button-label">
              <WandSparkles className="ui-icon" aria-hidden="true" />
              Quick Tour
            </span>
          </button>
          {installPrompt ? (
            <button type="button" className="ghost" onClick={handleInstall}>
              <span className="button-label">
                <Download className="ui-icon" aria-hidden="true" />
                {t("installApp")}
              </span>
            </button>
          ) : null}
          <label className="lang-picker">
            <span className="sr-only">{t("language.label")}</span>
            <select
              value={i18n.resolvedLanguage?.startsWith("es") ? "es" : "en"}
              onChange={(event) => {
                void i18n.changeLanguage(event.target.value);
              }}
            >
              <option value="en">{t("language.english")}</option>
              <option value="es">{t("language.spanish")}</option>
            </select>
          </label>
          <label className="theme-picker">
            <span className="sr-only">Theme</span>
            <select
              value={themeMode}
              onChange={(event) => {
                setThemeMode(event.target.value as ThemeMode);
              }}
            >
              <option value="system">System Theme</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="high-contrast">High Contrast</option>
            </select>
          </label>
        </div>
        <nav className="task-nav" aria-label="Primary workspace sections">
          <button
            type="button"
            className={clsx("ghost", activeTab === "play" && "is-active")}
            onClick={() => setActiveTab("play")}
            aria-pressed={activeTab === "play"}
          >
            <span className="button-label">
              <Play className="ui-icon" aria-hidden="true" />
              Play
            </span>
          </button>
          <button
            type="button"
            className={clsx("ghost", activeTab === "library" && "is-active")}
            onClick={() => setActiveTab("library")}
            aria-pressed={activeTab === "library"}
          >
            <span className="button-label">
              <Library className="ui-icon" aria-hidden="true" />
              Library
            </span>
          </button>
          <button
            type="button"
            className={clsx("ghost", activeTab === "history" && "is-active")}
            onClick={() => setActiveTab("history")}
            aria-pressed={activeTab === "history"}
          >
            <span className="button-label">
              <History className="ui-icon" aria-hidden="true" />
              History
            </span>
          </button>
          <button
            type="button"
            className={clsx("ghost", activeTab === "settings" && "is-active")}
            onClick={() => setActiveTab("settings")}
            aria-pressed={activeTab === "settings"}
          >
            <span className="button-label">
              <Settings2 className="ui-icon" aria-hidden="true" />
              Settings
            </span>
          </button>
        </nav>
      </header>

      {swUpdateReady && !dismissedUpdate ? (
        <section className="update-banner" aria-live="polite">
          <div>
            <strong>{t("updateReadyTitle")}</strong>
            <p>{t("updateReadyDescription")}</p>
          </div>
          <div className="button-row">
            <button type="button" onClick={applyServiceWorkerUpdate} disabled={updateInProgress}>
              {updateInProgress ? t("updating") : t("updateNow")}
            </button>
            <button type="button" className="ghost" onClick={() => setDismissedUpdate(true)} disabled={updateInProgress}>
              {t("later")}
            </button>
          </div>
        </section>
      ) : null}

      {freshTrendsNotice ? (
        <section className="update-banner" aria-live="polite">
          <div>
            <strong>{t("trendsReadyTitle")}</strong>
            <p>{t("trendsReadyDescription")}</p>
          </div>
          <div className="button-row">
            <button type="button" className="ghost" onClick={() => setFreshTrendsNotice(false)}>
              {t("dismiss")}
            </button>
          </div>
        </section>
      ) : null}

      <div
        className={clsx(
          "workspace",
          !settingsSidebarVisible && "sidebar-collapsed",
          !showSettingsPane && "settings-tab-hidden",
          `tab-${activeTab}`,
        )}
        id="main-content"
      >
        <aside
          id="settings-sidebar"
          aria-label="Game settings"
          className={clsx("settings-sidebar", !settingsSidebarVisible && "is-collapsed")}
        >
          <section className="panel" aria-labelledby="mode-presets-heading">
            <h2 id="mode-presets-heading" className="section-heading">
              <span className="heading-label">
                <SlidersHorizontal className="ui-icon" aria-hidden="true" />
                {t("presets")}
              </span>
            </h2>
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
            <h2 id="sources-heading" className="section-heading">
              <span className="heading-label">
                <Database className="ui-icon" aria-hidden="true" />
                {t("sources")}
              </span>
              <HelpTip text="Enable sources you trust. Games from multiple enabled sources are merged and gain combined weight." />
            </h2>
            <div className="grid-sources">
              {sourceKeys.map((source) => {
                const sourceMeta =
                  source === "manual"
                    ? manualGames.length
                    : source === "steamImport"
                      ? steamImportGames.length
                      : (topGames?.sources[source].games.length ?? 0);
                const note =
                  source === "manual"
                    ? "Your custom list"
                    : source === "steamImport"
                      ? "Imported from your Steam account"
                      : topGames?.sources[source].note;
                const fetchedAt =
                  source === "manual" || source === "steamImport" ? null : topGames?.sources[source].fetchedAt;
                const loadingSource = topGamesQuery.isLoading && source !== "manual" && source !== "steamImport";

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
                      {loadingSource ? <span className="mini-skeleton" aria-hidden="true" /> : <p>{sourceMeta} games loaded</p>}
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
                <span>{t("weightedWheel")}</span>
                <HelpTip text="Weighted mode increases odds for games from stronger sources and higher-ranked entries." />
              </label>
              <label className="cooldown-control">
                <span>{t("cooldownSpins")}</span>
                <HelpTip text="Cooldown avoids selecting games that recently won. Increase this for more variety." />
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

            <div className="spin-motion-grid">
              <label className="filter-field">
                <span>Spin Speed Profile</span>
                <select
                  value={spinSpeedProfile}
                  onChange={(event) => {
                    setSpinSpeedProfile(event.target.value as SpinSpeedProfile);
                    markCustom();
                  }}
                >
                  {Object.entries(spinSpeedProfiles).map(([profileId, profile]) => (
                    <option key={profileId} value={profileId}>
                      {profile.label}
                    </option>
                  ))}
                </select>
                <small className="filter-help">
                  Approx spin time: {(effectiveSpinDurationMs / 1000).toFixed(1)}s
                </small>
              </label>
              <label className="inline-check">
                <input
                  type="checkbox"
                  checked={reducedSpinAnimation}
                  onChange={(event) => {
                    setReducedSpinAnimation(event.target.checked);
                    markCustom();
                  }}
                />
                <span>Reduced spin animation</span>
                <HelpTip text="Uses a shorter, lower-motion wheel spin while preserving fair random selection." />
              </label>
            </div>

            <div className="weights-grid">
              <p className="muted">
                Per-source multipliers
                <HelpTip text="Higher multipliers make that source more likely in weighted mode. 1.0x is neutral." />
              </p>
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
                {t("loadingData")}
              </p>
            ) : null}
            {topGamesQuery.isError ? (
              <p className="status error" role="alert">
                {(topGamesQuery.error as Error).message}
              </p>
            ) : null}
          </section>

          <section className="panel" aria-labelledby="advanced-filters-heading">
            <h2 id="advanced-filters-heading" className="section-heading">
              <span className="heading-label">
                <Settings2 className="ui-icon" aria-hidden="true" />
                Advanced Options
              </span>
              <HelpTip text="Advanced controls include filters, exclusions, notifications, and cloud sync. Expand only when needed." />
            </h2>
            <p className="muted">Filters, exclusions, notifications, and cloud sync are hidden by default.</p>
            <div className="button-row">
              <button
                type="button"
                className="ghost"
                aria-expanded={showAdvancedSettings}
                aria-controls="advanced-settings-stack"
                onClick={() => setShowAdvancedSettings((current) => !current)}
              >
                <span className="button-label">
                  <ChevronsUpDown className="ui-icon" aria-hidden="true" />
                  {showAdvancedSettings ? "Hide Advanced Options" : "Show Advanced Options"}
                </span>
              </button>
            </div>
          </section>

          <section className="panel" aria-labelledby="steam-import-heading">
            <h2 id="steam-import-heading" className="section-heading">
              <span className="heading-label">
                <KeyRound className="ui-icon" aria-hidden="true" />
                {t("steamImportTitle")}
              </span>
              <HelpTip text="Imports owned games from Steam Web API using your API key and SteamID64. Profile privacy must allow owned games." />
            </h2>
            <p className="muted">
              {t("steamImportDescription")}
            </p>
            <div className="steam-grid">
              <label htmlFor="steam-api-key" className="sr-only">
                {t("steamApiKey")}
              </label>
              <input
                id="steam-api-key"
                type="password"
                placeholder={t("steamApiKey")}
                value={steamApiKey}
                onChange={(event) => setSteamApiKey(event.target.value)}
                autoComplete="off"
              />
              <label htmlFor="steam-id64" className="sr-only">
                {t("steamId64")}
              </label>
              <input
                id="steam-id64"
                type="text"
                placeholder={t("steamId64")}
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
                <span className="button-label">
                  <Download className="ui-icon" aria-hidden="true" />
                  {steamImportLoading ? t("importing") : t("importSteamLibrary")}
                </span>
              </button>
              <button type="button" className="ghost" onClick={clearSteamImport}>
                <span className="button-label">
                  <Trash2 className="ui-icon" aria-hidden="true" />
                  {t("clearImport")}
                </span>
              </button>
            </div>
            {steamImportLoading ? (
              <p className="status progress-status" role="status" aria-live="polite">
                <span className="progress-dot" aria-hidden="true" />
                Importing your Steam library...
              </p>
            ) : null}
            {steamImportStatus ? (
              <p id="steam-import-status" className="status" role="status" aria-live="polite">
                {steamImportStatus}
              </p>
            ) : null}
          </section>

          <div id="advanced-settings-stack" className={clsx("advanced-settings-stack", !showAdvancedSettings && "is-collapsed")}>
          <section className="panel" aria-labelledby="filters-heading">
            <h2 id="filters-heading" className="section-heading">
              <span className="heading-label">
                <Filter className="ui-icon" aria-hidden="true" />
                Advanced Filters
              </span>
              <HelpTip text="Filters narrow the candidate pool before cooldown and exclusion logic runs." />
            </h2>
            <p className="muted">Filter by platform, tags, length, release window, and price.</p>
            <div className="filters-grid">
              <label className="filter-field">
                <span>Platform</span>
                <select
                  value={filters.platform}
                  onChange={(event) => {
                    setFilters((current) => ({ ...current, platform: event.target.value as PlatformFilter }));
                    markCustom();
                  }}
                >
                  <option value="any">Any</option>
                  <option value="windows">Windows</option>
                  <option value="mac">macOS</option>
                  <option value="linux">Linux</option>
                </select>
              </label>

              <label className="filter-field">
                <span>Genre / Tag</span>
                <select
                  value={filters.tag}
                  onChange={(event) => {
                    setFilters((current) => ({ ...current, tag: event.target.value }));
                    markCustom();
                  }}
                >
                  <option value="any">Any</option>
                  {availableTags.slice(0, 250).map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
              </label>

              <label className="filter-field">
                <span>Estimated Length</span>
                <select
                  value={filters.length}
                  onChange={(event) => {
                    setFilters((current) => ({ ...current, length: event.target.value as LengthFilter }));
                    markCustom();
                  }}
                >
                  <option value="any">Any</option>
                  <option value="short">Short</option>
                  <option value="medium">Medium</option>
                  <option value="long">Long</option>
                </select>
              </label>

              <label className="filter-field">
                <span>Release After</span>
                <input
                  type="date"
                  value={filters.releaseFrom}
                  onChange={(event) => {
                    setFilters((current) => ({ ...current, releaseFrom: event.target.value }));
                    markCustom();
                  }}
                />
              </label>

              <label className="filter-field">
                <span>Release Before</span>
                <input
                  type="date"
                  value={filters.releaseTo}
                  onChange={(event) => {
                    setFilters((current) => ({ ...current, releaseTo: event.target.value }));
                    markCustom();
                  }}
                />
              </label>

              <label className="filter-field">
                <span>Max Price (${filters.maxPriceUsd.toFixed(0)})</span>
                <input
                  type="range"
                  min={0}
                  max={70}
                  step={1}
                  disabled={filters.freeOnly}
                  value={filters.maxPriceUsd}
                  onChange={(event) => {
                    setFilters((current) => ({ ...current, maxPriceUsd: Number(event.target.value) }));
                    markCustom();
                  }}
                />
                <small className="filter-help">
                  Games above this price are excluded unless marked as free.
                </small>
              </label>

              <label className="inline-check">
                <input
                  type="checkbox"
                  checked={filters.freeOnly}
                  onChange={(event) => {
                    setFilters((current) => ({ ...current, freeOnly: event.target.checked }));
                    markCustom();
                  }}
                />
                <span>Free only</span>
                <HelpTip text="When enabled, only free-to-play entries are kept and max-price filtering is ignored." />
              </label>
            </div>
            <div className="button-row">
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  setFilters(defaultFilters);
                  markCustom();
                }}
              >
                <span className="button-label">
                  <RotateCw className="ui-icon" aria-hidden="true" />
                  Reset Filters
                </span>
              </button>
            </div>
          </section>

          <section className="panel" aria-labelledby="exclusion-heading">
            <h2 id="exclusion-heading" className="section-heading">
              <span className="heading-label">
                <Ban className="ui-icon" aria-hidden="true" />
                {t("playedCompletedTitle")}
              </span>
              <HelpTip text="Use this to block games you already played or completed so they no longer appear on spins." />
            </h2>
            <p className="muted">{t("playedCompletedDescription")}</p>
            <div className="odds-controls">
              <label className="inline-check">
                <input type="checkbox" checked={excludePlayed} onChange={(event) => setExcludePlayed(event.target.checked)} />
                <span>{t("excludePlayed")}</span>
                <HelpTip text="Removes titles listed in Played from the active wheel pool." />
              </label>
              <label className="inline-check">
                <input
                  type="checkbox"
                  checked={excludeCompleted}
                  onChange={(event) => setExcludeCompleted(event.target.checked)}
                />
                <span>{t("excludeCompleted")}</span>
                <HelpTip text="Removes completed titles and keeps them out unless you clear the list." />
              </label>
            </div>
            <label htmlFor="exclusion-input" className="sr-only">
              {t("gameNamesToExclude")}
            </label>
            <textarea
              id="exclusion-input"
              rows={3}
              value={exclusionInput}
              onChange={(event) => setExclusionInput(event.target.value)}
              placeholder={t("excludeInputPlaceholder")}
            />
            <div className="button-row">
              <button type="button" onClick={() => addExclusionFromInput("played")} disabled={!exclusionInput.trim()}>
                <span className="button-label">
                  <Plus className="ui-icon" aria-hidden="true" />
                  {t("markPlayed")}
                </span>
              </button>
              <button type="button" className="ghost" onClick={() => addExclusionFromInput("completed")} disabled={!exclusionInput.trim()}>
                <span className="button-label">
                  <Plus className="ui-icon" aria-hidden="true" />
                  {t("markCompleted")}
                </span>
              </button>
            </div>
            <div className="exclude-grid">
              <div className="exclude-list">
                <strong>{t("playedCount", { count: playedGames.length })}</strong>
                {playedGames.length === 0 ? (
                  <p className="muted">{t("noPlayedTracked")}</p>
                ) : (
                  <ul>
                    {playedGames.slice(0, 30).map((name) => (
                      <li key={`played-${name}`}>
                        <span>{name}</span>
                        <button type="button" className="ghost compact" onClick={() => removePlayedGame(name)}>
                          {t("remove")}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {playedGames.length > 0 ? (
                  <button type="button" className="ghost compact" onClick={() => setPlayedGames([])}>
                    {t("clearPlayed")}
                  </button>
                ) : null}
              </div>
              <div className="exclude-list">
                <strong>{t("completedCount", { count: completedGames.length })}</strong>
                {completedGames.length === 0 ? (
                  <p className="muted">{t("noCompletedTracked")}</p>
                ) : (
                  <ul>
                    {completedGames.slice(0, 30).map((name) => (
                      <li key={`completed-${name}`}>
                        <span>{name}</span>
                        <button type="button" className="ghost compact" onClick={() => removeCompletedGame(name)}>
                          {t("remove")}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {completedGames.length > 0 ? (
                  <button type="button" className="ghost compact" onClick={() => setCompletedGames([])}>
                    {t("clearCompleted")}
                  </button>
                ) : null}
              </div>
            </div>
          </section>

          <section className="panel" aria-labelledby="notification-heading">
            <h2 id="notification-heading" className="section-heading">
              <span className="heading-label">
                <BellRing className="ui-icon" aria-hidden="true" />
                {t("notificationsTitle")}
              </span>
              <HelpTip text="Browser notifications can alert you about trend refreshes and spin reminders when enabled." />
            </h2>
            <p className="muted">{t("notificationsDescription")}</p>
            <div className="odds-controls">
              <label className="inline-check">
                <input
                  type="checkbox"
                  checked={notificationsEnabled}
                  onChange={(event) => {
                    void setNotificationsEnabledWithPermission(event.target.checked);
                  }}
                />
                <span>{t("notificationsEnabled")}</span>
                <HelpTip text="Requires browser permission. If denied, this setting will stay off." />
              </label>
              <label className="inline-check">
                <input
                  type="checkbox"
                  checked={trendNotifications}
                  disabled={!notificationsEnabled}
                  onChange={(event) => setTrendNotifications(event.target.checked)}
                />
                <span>{t("newTrendsAlerts")}</span>
                <HelpTip text="Sends an alert when refreshed trend data is available in the app." />
              </label>
              <label className="inline-check">
                <input
                  type="checkbox"
                  checked={reminderNotifications}
                  disabled={!notificationsEnabled}
                  onChange={(event) => setReminderNotifications(event.target.checked)}
                />
                <span>{t("spinReminders")}</span>
                <HelpTip text="Sends periodic reminders to spin again when the page is not active." />
              </label>
              <label className="cooldown-control">
                <span>{t("reminderInterval")}</span>
                <HelpTip text="Sets how often reminder notifications can fire, in minutes." />
                <input
                  type="range"
                  min={15}
                  max={720}
                  step={15}
                  disabled={!notificationsEnabled || !reminderNotifications}
                  value={reminderIntervalMinutes}
                  onChange={(event) => setReminderIntervalMinutes(Number(event.target.value))}
                />
                <strong>{reminderIntervalMinutes}</strong>
              </label>
            </div>
            {notificationStatus ? (
              <p className="status" role="status" aria-live="polite">
                {notificationStatus}
              </p>
            ) : null}
          </section>

          <section className="panel" aria-labelledby="cloud-sync-heading">
            <h2 id="cloud-sync-heading" className="section-heading">
              <span className="heading-label">
                <Cloud className="ui-icon" aria-hidden="true" />
                Cloud Sync (Optional)
              </span>
              <HelpTip text="Syncs settings/history through a private GitHub Gist. Token stays in your local browser storage." />
            </h2>
            <p className="muted">
              Sync your settings/history across devices using a private GitHub Gist. Your token is stored locally in
              this browser only.
            </p>
            <div className="steam-grid">
              <label htmlFor="cloud-token" className="sr-only">
                GitHub token with gist scope
              </label>
              <input
                id="cloud-token"
                type="password"
                placeholder="GitHub token (gist scope)"
                value={gistToken}
                onChange={(event) => setGistToken(event.target.value)}
                autoComplete="off"
              />
              <label htmlFor="cloud-gist-id" className="sr-only">
                Sync Gist ID
              </label>
              <input
                id="cloud-gist-id"
                type="text"
                placeholder="Gist ID"
                value={gistId}
                onChange={(event) => setGistId(event.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="button-row">
              <button type="button" onClick={createCloudSyncGist} disabled={cloudSyncLoading}>
                <span className="button-label">
                  <FilePlus2 className="ui-icon" aria-hidden="true" />
                  {cloudSyncLoading ? "Working..." : "Create Gist + Push"}
                </span>
              </button>
              <button type="button" className="ghost" onClick={pushCloudSync} disabled={cloudSyncLoading}>
                <span className="button-label">
                  <Upload className="ui-icon" aria-hidden="true" />
                  Push Sync
                </span>
              </button>
              <button type="button" className="ghost" onClick={pullCloudSync} disabled={cloudSyncLoading}>
                <span className="button-label">
                  <Download className="ui-icon" aria-hidden="true" />
                  Pull Sync
                </span>
              </button>
            </div>
            {cloudSyncLoading ? (
              <p className="status progress-status" role="status" aria-live="polite">
                <span className="progress-dot" aria-hidden="true" />
                Syncing with GitHub Gist...
              </p>
            ) : null}
            {cloudSyncStatus ? (
              <p className="status" role="status" aria-live="polite">
                {cloudSyncStatus}
              </p>
            ) : null}
          </section>
          </div>
        </aside>

        <div className="content-stack">
          {showPlayPane ? (
            <section className="panel" aria-labelledby="wheel-heading">
              <h2 id="wheel-heading" className="section-heading">
                <span className="heading-label">
                  <Gamepad2 className="ui-icon" aria-hidden="true" />
                  {t("wheelTitle")}
                </span>
              </h2>
              <p className="muted">
                {t("poolSummary", {
                  count: activePool.length,
                  statusExcluded: exclusionSummarySuffix,
                  cooldownExcluded: cooldownExcludedSuffix,
                })}
              </p>
              {advancedFilterExhausted ? <p className="status">{t("advancedFilterExhausted")}</p> : null}
              {statusExhausted ? (
                <p className="status">{t("statusExhausted")}</p>
              ) : null}
              {cooldownSaturated ? (
                <p className="status">{t("cooldownExhausted")}</p>
              ) : null}
              <Wheel
                games={activePool.map((candidate) => candidate.name)}
                rotation={rotation}
                spinning={spinning}
                spinDurationMs={effectiveSpinDurationMs}
                onSpinEnd={onSpinEnd}
              />
              <div className="button-row">
                <button type="button" onClick={handleSpin} disabled={spinning || activePool.length === 0}>
                  <span className="button-label">
                    <RotateCw className="ui-icon" aria-hidden="true" />
                    {spinning ? t("spinning") : t("spinTheWheel")}
                  </span>
                </button>
                <button type="button" className="ghost" onClick={clearHistory}>
                  <span className="button-label">
                    <Eraser className="ui-icon" aria-hidden="true" />
                    {t("clearHistory")}
                  </span>
                </button>
              </div>
              {winner && winnerMeta ? (
                <WinnerSummaryCard
                  prompt={t("youShouldPlay")}
                  winner={winner}
                  sourceLabel={t("sourceLabel")}
                  sourceValue={sourceLabelList(winnerMeta.sources)}
                  oddsLabel={t("spinOdds")}
                  oddsValue={formatOdds(winnerMeta.odds)}
                  playedLabel={t("winnerActions.played")}
                  completedLabel={t("winnerActions.completed")}
                  onMarkPlayed={() => markGamesPlayed([winner])}
                  onMarkCompleted={() => markGamesCompleted([winner])}
                />
              ) : null}
            </section>
          ) : null}

          {showLibraryPane ? (
            <ManualGamesPanel
              title={t("manualListTitle")}
              description={t("manualListDescription")}
              inputValue={manualInput}
              onInputChange={setManualInput}
              onAdd={addManualGames}
              onClear={clearManualGames}
              addLabel={t("addGames")}
              clearLabel={t("clearManual")}
              placeholder={"Helldivers 2\nHades II\nMonster Hunter Wilds"}
            />
          ) : null}

          {showHistoryPane ? (
            <SpinHistoryPanel title={t("spinHistoryTitle")} emptyLabel={t("noSpins")} items={historyDisplayItems} />
          ) : null}

          {activeTab === "settings" ? (
            <section className="panel" aria-label="Settings guidance">
              <h2 className="section-heading">
                <span className="heading-label">
                  <Settings2 className="ui-icon" aria-hidden="true" />
                  Settings
                </span>
              </h2>
              <p className="muted">
                Configure sources, weights, imports, and advanced options from the left sidebar. Then return to Play
                to spin.
              </p>
            </section>
          ) : null}
        </div>
      </div>

      {showOnboarding ? (
        <div className="onboarding-overlay">
          <div
            ref={onboardingCardRef}
            className="onboarding-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="onboarding-title"
            aria-describedby="onboarding-description"
            tabIndex={-1}
          >
            <p className="winner-tag">Quick Start</p>
            <h3 id="onboarding-title">{onboardingSteps[onboardingStep]?.title}</h3>
            <p id="onboarding-description">{onboardingSteps[onboardingStep]?.description}</p>
            <div className="onboarding-dots" aria-label="Onboarding progress">
              {onboardingSteps.map((step, index) => (
                <button
                  key={step.title}
                  type="button"
                  className={clsx("ghost compact", onboardingStep === index && "is-active")}
                  onClick={() => setOnboardingStep(index)}
                  aria-pressed={onboardingStep === index}
                >
                  {index + 1}
                </button>
              ))}
            </div>
            <div className="button-row">
              <button type="button" className="ghost" onClick={() => completeOnboarding("play")}>
                Skip
              </button>
              {onboardingStep > 0 ? (
                <button type="button" className="ghost" onClick={() => setOnboardingStep((current) => current - 1)}>
                  Back
                </button>
              ) : null}
              {onboardingStep < onboardingLastStep ? (
                <button type="button" onClick={() => setOnboardingStep((current) => current + 1)}>
                  Next
                </button>
              ) : (
                <button type="button" onClick={() => completeOnboarding("play")}>
                  Start Spinning
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {toasts.length > 0 ? (
        <div className="toast-stack" role="status" aria-live="polite" aria-label="Notifications">
          {toasts.map((toast) => (
            <div key={toast.id} className={clsx("toast", toast.tone)}>
              <p>{toast.text}</p>
              <button type="button" className="ghost compact" onClick={() => dismissToast(toast.id)}>
                Dismiss
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {showWinnerPopup && winner && winnerMeta ? (
        <div className="winner-overlay" onClick={() => setShowWinnerPopup(false)}>
          <div
            ref={winnerPopupRef}
            className="winner-popup"
            key={winnerPulse}
            role="dialog"
            aria-modal="true"
            aria-labelledby="winner-title"
            aria-describedby="winner-description"
            onClick={(event) => event.stopPropagation()}
            tabIndex={-1}
          >
            <div className="winner-glow" />
            <p className="winner-tag">{t("winner")}</p>
            <h3 id="winner-title">{winner}</h3>
            <div className="winner-moment-grid">
              <div>
                <span>{t("spinOdds")}</span>
                <strong>{formatOdds(winnerMeta.odds)}</strong>
              </div>
              <div>
                <span>{t("sourceLabel")}</span>
                <strong>{sourceLabelList(winnerMeta.sources)}</strong>
              </div>
            </div>
            <p id="winner-description">{t("commitNow")}</p>
            <div className="button-row">
              {winnerMeta.appId ? (
                <a className="button-link" href={`https://store.steampowered.com/app/${winnerMeta.appId}/`} target="_blank" rel="noreferrer">
                  {t("openSteam")}
                </a>
              ) : null}
              {winnerMeta.url ? (
                <a className="button-link ghost-link" href={winnerMeta.url} target="_blank" rel="noreferrer">
                  {t("viewSource")}
                </a>
              ) : null}
              <button type="button" className="ghost" onClick={() => markGamesPlayed([winner])}>
                {t("winnerActions.played")}
              </button>
              <button type="button" className="ghost" onClick={() => markGamesCompleted([winner])}>
                {t("winnerActions.completed")}
              </button>
              <button type="button" onClick={() => setShowWinnerPopup(false)} ref={winnerPopupCloseRef}>
                {t("nice")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
