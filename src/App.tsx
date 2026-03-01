import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as Accordion from "@radix-ui/react-accordion";
import * as Tabs from "@radix-ui/react-tabs";
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
  X,
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

const cloudSettingsSchema = z.object({
  enabledSources: z.record(z.string(), z.boolean()).optional(),
  sourceWeights: z.record(z.string(), z.number()).optional(),
  weightedMode: z.boolean().optional(),
  adaptiveRecommendations: z.boolean().optional(),
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
});

const accountProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  updatedAt: z.string(),
  settings: cloudSettingsSchema,
});

const cloudSyncSnapshotSchema = z.object({
  version: z.number().default(1),
  exportedAt: z.string().optional(),
  settings: cloudSettingsSchema.optional(),
  spinHistory: spinHistorySchema.optional(),
  manualGames: z.array(z.string()).optional(),
  steamImport: storedSteamImportSchema.optional(),
  exclusions: storedExclusionsSchema.optional(),
  notifications: storedNotificationSettingsSchema.optional(),
  profiles: z
    .object({
      activeProfileId: z.string().optional(),
      items: z.array(accountProfileSchema).default([]),
    })
    .optional(),
});

const cloudRestorePointsSchema = z.array(
  z.object({
    id: z.string(),
    createdAt: z.string(),
    reason: z.string(),
    snapshot: cloudSyncSnapshotSchema,
  }),
);

const accountProfilesSchema = z.array(accountProfileSchema);

const HISTORY_STORAGE_KEY = "pickagame.spin-history.v1";
const SETTINGS_STORAGE_KEY = "pickagame.settings.v1";
const MANUAL_GAMES_STORAGE_KEY = "pickagame.manual-games.v1";
const STEAM_IMPORT_STORAGE_KEY = "pickagame.steam-import.v1";
const EXCLUSION_STORAGE_KEY = "pickagame.exclusions.v1";
const NOTIFICATION_STORAGE_KEY = "pickagame.notifications.v1";
const CLOUD_SYNC_STORAGE_KEY = "pickagame.cloud-sync.v1";
const ACCOUNT_PROFILES_STORAGE_KEY = "pickagame.account-profiles.v1";
const ACTIVE_ACCOUNT_PROFILE_STORAGE_KEY = "pickagame.account-profiles.active.v1";
const CLOUD_SYNC_RESTORE_POINTS_STORAGE_KEY = "pickagame.cloud-sync.restore-points.v1";
const CLOUD_SYNC_REFERENCE_STORAGE_KEY = "pickagame.cloud-sync.reference.v1";
const THEME_STORAGE_KEY = "pickagame.theme.v1";
const ONBOARDING_STORAGE_KEY = "pickagame.onboarding.v1";
const MAX_CLOUD_RESTORE_POINTS = 5;

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
  adaptiveRecommendations: boolean;
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

type CloudSyncSnapshot = z.infer<typeof cloudSyncSnapshotSchema>;

interface CloudRestorePoint {
  id: string;
  createdAt: string;
  reason: string;
  snapshot: CloudSyncSnapshot;
}

interface AccountProfilePreset {
  id: string;
  name: string;
  updatedAt: string;
  settings: StoredSettings;
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
  titleKey: string;
  descriptionKey: string;
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

const modePresetTranslationKeys: Record<string, { label: string; description: string }> = {
  balanced: { label: "modePreset.balanced.label", description: "modePreset.balanced.description" },
  quick: { label: "modePreset.quick.label", description: "modePreset.quick.description" },
  "no-repeats": { label: "modePreset.noRepeats.label", description: "modePreset.noRepeats.description" },
  "owned-first": { label: "modePreset.ownedFirst.label", description: "modePreset.ownedFirst.description" },
};

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
  adaptiveRecommendations: false,
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
    titleKey: "onboarding.buildLibraryTitle",
    descriptionKey: "onboarding.buildLibraryDescription",
    focusTab: "library",
  },
  {
    titleKey: "onboarding.tuneRulesTitle",
    descriptionKey: "onboarding.tuneRulesDescription",
    focusTab: "settings",
  },
  {
    titleKey: "onboarding.spinCommitTitle",
    descriptionKey: "onboarding.spinCommitDescription",
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
  const adaptiveRecommendations =
    typeof partialSettings.adaptiveRecommendations === "boolean"
      ? partialSettings.adaptiveRecommendations
      : fallbackSettings.adaptiveRecommendations;

  if (matchedPreset) {
    return {
      enabledSources: { ...matchedPreset.enabledSources },
      sourceWeights: { ...matchedPreset.sourceWeights },
      weightedMode: matchedPreset.weightedMode,
      adaptiveRecommendations,
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
    adaptiveRecommendations,
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

const sanitizeCloudRestorePoints = (input: CloudRestorePoint[] | null): CloudRestorePoint[] => {
  if (!input) return [];
  const parsed = cloudRestorePointsSchema.safeParse(input);
  if (!parsed.success) return [];
  return parsed.data.slice(0, MAX_CLOUD_RESTORE_POINTS);
};

const sanitizeAccountProfiles = (input: AccountProfilePreset[] | null): AccountProfilePreset[] => {
  if (!input) return [];
  const parsed = accountProfilesSchema.safeParse(input);
  if (!parsed.success) return [];

  const deduped = new Map<string, AccountProfilePreset>();
  parsed.data.forEach((entry) => {
    const id = entry.id.trim();
    const name = entry.name.trim();
    if (!id || !name) return;
    deduped.set(id, {
      id,
      name,
      updatedAt: entry.updatedAt,
      settings: sanitizeSettings(entry.settings as StoredSettings),
    });
  });
  return [...deduped.values()].slice(0, 20);
};

const formatSyncTimestamp = (value: string | null | undefined) => {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
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
  const initialAccountProfiles = sanitizeAccountProfiles(
    readStorage<AccountProfilePreset[] | null>(ACCOUNT_PROFILES_STORAGE_KEY, null),
  );
  const initialActiveAccountProfileId = readStorage<string | null>(ACTIVE_ACCOUNT_PROFILE_STORAGE_KEY, null) ?? "";
  const normalizedInitialActiveProfileId = initialAccountProfiles.some((profile) => profile.id === initialActiveAccountProfileId)
    ? initialActiveAccountProfileId
    : initialAccountProfiles[0]?.id ?? "";
  const initialCloudRestorePoints = sanitizeCloudRestorePoints(
    readStorage<CloudRestorePoint[] | null>(CLOUD_SYNC_RESTORE_POINTS_STORAGE_KEY, null),
  );
  const initialCloudSyncReference = readStorage<string | null>(CLOUD_SYNC_REFERENCE_STORAGE_KEY, null) ?? "";
  const initialThemeMode = sanitizeThemeMode(readStorage<ThemeMode | null>(THEME_STORAGE_KEY, null));
  const initialOnboardingDone = readStorage<boolean | null>(ONBOARDING_STORAGE_KEY, null) === true;

  const [enabledSources, setEnabledSources] = useState<EnabledSources>(initialSettings.enabledSources);
  const [sourceWeights, setSourceWeights] = useState<SourceWeights>(initialSettings.sourceWeights);
  const [weightedMode, setWeightedMode] = useState(initialSettings.weightedMode);
  const [adaptiveRecommendations, setAdaptiveRecommendations] = useState(initialSettings.adaptiveRecommendations);
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
  const [accountProfiles, setAccountProfiles] = useState<AccountProfilePreset[]>(initialAccountProfiles);
  const [activeAccountProfileId, setActiveAccountProfileId] = useState(normalizedInitialActiveProfileId);
  const [accountProfileDraftName, setAccountProfileDraftName] = useState("");
  const [cloudSyncReferenceAt, setCloudSyncReferenceAt] = useState(initialCloudSyncReference);
  const [cloudRestorePoints, setCloudRestorePoints] = useState<CloudRestorePoint[]>(initialCloudRestorePoints);
  const [pendingCloudConflictSnapshot, setPendingCloudConflictSnapshot] = useState<CloudSyncSnapshot | null>(null);

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
  const [isMobileLayout, setIsMobileLayout] = useState(false);
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
      pushToast("success", t("messages.quickStartComplete"));
    },
    [pushToast, t],
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

  const sourceBehaviorMultipliers = useMemo<SourceWeights>(() => {
    const scores = sourceKeys.reduce<Record<SourceToggleKey, number>>(
      (accumulator, source) => ({ ...accumulator, [source]: 0 }),
      {} as Record<SourceToggleKey, number>,
    );
    const sourcesByName = new Map<string, Set<SourceToggleKey>>();

    allEntries.forEach((entry) => {
      const source = entry.source as SourceToggleKey;
      if (!sourceKeys.includes(source)) return;
      const key = entry.name.trim().toLowerCase();
      if (!key) return;
      if (!sourcesByName.has(key)) {
        sourcesByName.set(key, new Set<SourceToggleKey>());
      }
      sourcesByName.get(key)?.add(source);
    });

    const addNamedSignal = (names: string[], scoreDelta: number) => {
      names.forEach((name) => {
        const key = name.trim().toLowerCase();
        if (!key) return;
        const sources = sourcesByName.get(key);
        if (!sources) return;
        sources.forEach((source) => {
          scores[source] += scoreDelta;
        });
      });
    };

    addNamedSignal(playedGames, 1.4);
    addNamedSignal(completedGames, 2.2);

    spinHistory.slice(0, 20).forEach((entry, index) => {
      const recency = Math.max(0.22, 1 - index / 24);
      entry.sources.forEach((source) => {
        const key = source as SourceToggleKey;
        if (!sourceKeys.includes(key)) return;
        scores[key] += 0.55 * recency;
      });
    });

    const maxScore = Math.max(0, ...Object.values(scores));
    if (maxScore <= 0) {
      return sourceKeys.reduce<SourceWeights>(
        (accumulator, source) => ({ ...accumulator, [source]: 1 }),
        {} as SourceWeights,
      );
    }

    return sourceKeys.reduce<SourceWeights>((accumulator, source) => {
      const normalized = scores[source] / maxScore;
      const multiplier = Number((0.78 + normalized * 0.62).toFixed(2));
      return {
        ...accumulator,
        [source]: Math.max(0.72, Math.min(1.45, multiplier)),
      };
    }, {} as SourceWeights);
  }, [allEntries, completedGames, playedGames, spinHistory]);

  const behaviorSignalsCount = playedGames.length + completedGames.length + Math.min(spinHistory.length, 20);

  const suggestedSourceWeights = useMemo<SourceWeights>(
    () =>
      sourceKeys.reduce<SourceWeights>((accumulator, source) => {
        const suggested = defaultSourceWeights[source] * sourceBehaviorMultipliers[source];
        const normalized = Number(suggested.toFixed(1));
        return {
          ...accumulator,
          [source]: Math.max(0.1, Math.min(3, normalized)),
        };
      }, {} as SourceWeights),
    [sourceBehaviorMultipliers],
  );

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
  const adaptivePoolWeights = useMemo(
    () =>
      activePool.map((candidate) => {
        if (!adaptiveRecommendations) return candidate.weight;
        const sourceMultiplier =
          candidate.sources.reduce((sum, source) => {
            const sourceKey = source as SourceToggleKey;
            const multiplier = sourceBehaviorMultipliers[sourceKey] ?? 1;
            return sum + multiplier;
          }, 0) / Math.max(candidate.sources.length, 1);
        return Math.max(0.05, candidate.weight * sourceMultiplier);
      }),
    [activePool, adaptiveRecommendations, sourceBehaviorMultipliers],
  );
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
        adaptiveRecommendations,
        cooldownSpins,
        spinSpeedProfile,
        reducedSpinAnimation,
        activePreset,
        filters,
      } satisfies StoredSettings),
    );
  }, [
    activePreset,
    adaptiveRecommendations,
    cooldownSpins,
    enabledSources,
    filters,
    reducedSpinAnimation,
    sourceWeights,
    spinSpeedProfile,
    weightedMode,
  ]);

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
    localStorage.setItem(ACCOUNT_PROFILES_STORAGE_KEY, JSON.stringify(accountProfiles));
  }, [accountProfiles]);

  useEffect(() => {
    localStorage.setItem(ACTIVE_ACCOUNT_PROFILE_STORAGE_KEY, JSON.stringify(activeAccountProfileId));
  }, [activeAccountProfileId]);

  useEffect(() => {
    if (accountProfiles.length === 0) {
      if (activeAccountProfileId) {
        setActiveAccountProfileId("");
      }
      return;
    }
    if (!activeAccountProfileId || !accountProfiles.some((profile) => profile.id === activeAccountProfileId)) {
      setActiveAccountProfileId(accountProfiles[0].id);
    }
  }, [accountProfiles, activeAccountProfileId]);

  useEffect(() => {
    localStorage.setItem(CLOUD_SYNC_RESTORE_POINTS_STORAGE_KEY, JSON.stringify(cloudRestorePoints));
  }, [cloudRestorePoints]);

  useEffect(() => {
    localStorage.setItem(CLOUD_SYNC_REFERENCE_STORAGE_KEY, JSON.stringify(cloudSyncReferenceAt));
  }, [cloudSyncReferenceAt]);

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
    const mediaQuery = window.matchMedia("(max-width: 980px)");
    const applyLayoutMode = () => {
      setIsMobileLayout(mediaQuery.matches);
    };
    applyLayoutMode();
    mediaQuery.addEventListener("change", applyLayoutMode);
    return () => {
      mediaQuery.removeEventListener("change", applyLayoutMode);
    };
  }, []);

  useEffect(() => {
    if (activeTab !== "settings") return;
    setSidebarOpen(true);
    if (isMobileLayout && !showOnboarding) {
      setActiveTab("play");
    }
  }, [activeTab, isMobileLayout, showOnboarding]);

  useEffect(() => {
    if (!isMobileLayout || !sidebarOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileLayout, sidebarOpen]);

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
    const errorText = (topGamesQuery.error as Error)?.message ?? t("messages.topGamesLoadError");
    if (lastTopGamesErrorRef.current === errorText) return;
    lastTopGamesErrorRef.current = errorText;
    pushToast("error", `${errorText} ${t("messages.retryHint")}`);
  }, [pushToast, t, topGamesQuery.error, topGamesQuery.isError]);

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
          registration.showNotification(t("messages.reminderTitle"), {
            body: t("messages.reminderBody"),
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
  }, [notificationsEnabled, reminderIntervalMinutes, reminderNotifications, t]);

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

  const applySuggestedWeights = () => {
    setSourceWeights(suggestedSourceWeights);
    if (!weightedMode) {
      setWeightedMode(true);
    }
    markCustom();
    pushToast("success", t("messages.appliedSuggestedWeights"));
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
          t("messages.steamImportBlocked");
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

  const currentSettingsSnapshot = useCallback(
    (): StoredSettings => ({
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

  const applyStoredSettings = useCallback((sanitized: StoredSettings) => {
    setEnabledSources(sanitized.enabledSources);
    setSourceWeights(sanitized.sourceWeights);
    setWeightedMode(sanitized.weightedMode);
    setAdaptiveRecommendations(sanitized.adaptiveRecommendations);
    setCooldownSpins(sanitized.cooldownSpins);
    setSpinSpeedProfile(sanitized.spinSpeedProfile);
    setReducedSpinAnimation(sanitized.reducedSpinAnimation);
    setActivePreset(sanitized.activePreset);
    setFilters(sanitizeFilters(sanitized.filters));
  }, []);

  const buildCloudSnapshot = (): CloudSyncSnapshot => ({
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: currentSettingsSnapshot(),
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
    profiles: {
      activeProfileId: activeAccountProfileId || undefined,
      items: accountProfiles.map((profile) => ({
        id: profile.id,
        name: profile.name,
        updatedAt: profile.updatedAt,
        settings: profile.settings,
      })),
    },
  });

  const pushCloudRestorePoint = useCallback(
    (reason: string) => {
      const snapshot: CloudSyncSnapshot = {
        ...buildCloudSnapshot(),
        settings: currentSettingsSnapshot(),
      };
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const point: CloudRestorePoint = {
        id,
        createdAt: new Date().toISOString(),
        reason,
        snapshot,
      };
      setCloudRestorePoints((current) => [point, ...current].slice(0, MAX_CLOUD_RESTORE_POINTS));
    },
    [buildCloudSnapshot, currentSettingsSnapshot],
  );

  const applyCloudSnapshot = (rawSnapshot: unknown, options?: { updateReference?: boolean }) => {
    const parsed = cloudSyncSnapshotSchema.safeParse(rawSnapshot);
    if (!parsed.success) {
      throw new Error(t("messages.cloudSnapshotInvalid"));
    }
    const snapshot = parsed.data;

    if (snapshot.settings) {
      const sanitized = sanitizeSettings(snapshot.settings as StoredSettings);
      applyStoredSettings(sanitized);
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

    if (snapshot.profiles?.items) {
      const incomingProfiles = sanitizeAccountProfiles(snapshot.profiles.items as AccountProfilePreset[]);
      setAccountProfiles(incomingProfiles);
      const incomingActiveId = snapshot.profiles.activeProfileId ?? "";
      const resolvedActiveId = incomingProfiles.some((profile) => profile.id === incomingActiveId)
        ? incomingActiveId
        : incomingProfiles[0]?.id ?? "";
      setActiveAccountProfileId(resolvedActiveId);
    }

    if (options?.updateReference !== false) {
      setCloudSyncReferenceAt(snapshot.exportedAt ?? new Date().toISOString());
    }
    setPendingCloudConflictSnapshot(null);
  };

  const dismissCloudConflict = () => {
    setPendingCloudConflictSnapshot(null);
    setCloudSyncStatus(t("messages.cloudKeepLocalStatus"));
    pushToast("info", t("messages.cloudKeepLocalToast"));
  };

  const applyPendingCloudConflict = () => {
    if (!pendingCloudConflictSnapshot) return;
    pushCloudRestorePoint("Before applying older remote cloud snapshot");
    applyCloudSnapshot(pendingCloudConflictSnapshot);
    setCloudSyncStatus(t("messages.cloudAppliedRemoteStatus"));
    pushToast("success", t("messages.cloudAppliedRemoteToast"));
  };

  const restoreFromCloudPoint = (point: CloudRestorePoint) => {
    pushCloudRestorePoint("Before local restore point recovery");
    applyCloudSnapshot(point.snapshot, { updateReference: false });
    setCloudSyncStatus(`Restored local state from ${formatSyncTimestamp(point.createdAt)}.`);
    pushToast("success", t("messages.cloudRestoredPointToast"));
  };

  const createAccountProfile = () => {
    const name = accountProfileDraftName.trim();
    if (!name) {
      pushToast("error", t("messages.profileNameRequired"));
      return;
    }
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const profile: AccountProfilePreset = {
      id,
      name,
      updatedAt: new Date().toISOString(),
      settings: currentSettingsSnapshot(),
    };
    setAccountProfiles((current) => [profile, ...current].slice(0, 20));
    setActiveAccountProfileId(id);
    setAccountProfileDraftName("");
    setCloudSyncStatus(t("messages.profileCreatedStatus", { name }));
    pushToast("success", t("messages.profileCreated", { name }));
  };

  const saveCurrentToActiveProfile = () => {
    if (!activeAccountProfileId) {
      pushToast("error", t("messages.profileSelectOrCreate"));
      return;
    }
    const timestamp = new Date().toISOString();
    let saved = false;
    setAccountProfiles((current) =>
      current.map((profile) => {
        if (profile.id !== activeAccountProfileId) return profile;
        saved = true;
        return {
          ...profile,
          updatedAt: timestamp,
          settings: currentSettingsSnapshot(),
        };
      }),
    );
    if (!saved) {
      pushToast("error", t("messages.profileNotFound"));
      return;
    }
    setCloudSyncStatus(t("messages.profileSavedActive"));
    pushToast("success", t("messages.profileSavedActive"));
  };

  const applyActiveAccountProfile = () => {
    if (!activeAccountProfileId) {
      pushToast("error", t("messages.profileSelectFirst"));
      return;
    }
    const profile = accountProfiles.find((entry) => entry.id === activeAccountProfileId);
    if (!profile) {
      pushToast("error", t("messages.profileNotFound"));
      return;
    }
    pushCloudRestorePoint(`Before applying profile "${profile.name}"`);
    applyStoredSettings(profile.settings);
    setCloudSyncStatus(t("messages.profileApplied", { name: profile.name }));
    pushToast("success", t("messages.profileApplied", { name: profile.name }));
  };

  const deleteActiveAccountProfile = () => {
    if (!activeAccountProfileId) {
      pushToast("error", t("messages.profileSelectFirst"));
      return;
    }
    let removedName = "";
    setAccountProfiles((current) => {
      return current.filter((profile) => {
        if (profile.id !== activeAccountProfileId) return true;
        removedName = profile.name;
        return false;
      });
    });
    if (!removedName) {
      pushToast("error", t("messages.profileNotFound"));
      return;
    }
    setCloudSyncStatus(t("messages.profileDeleted", { name: removedName }));
    pushToast("info", t("messages.profileDeleted", { name: removedName }));
  };

  const pushCloudSync = async () => {
    const token = gistToken.trim();
    if (!token) {
      setCloudSyncStatus(t("messages.cloudTokenRequired"));
      pushToast("error", t("messages.cloudNeedsToken"));
      return;
    }
    if (!gistId.trim()) {
      setCloudSyncStatus(t("messages.cloudNeedGistOrCreate"));
      pushToast("error", t("messages.cloudProvideGistBeforePush"));
      return;
    }

    setCloudSyncLoading(true);
    setCloudSyncStatus(t("messages.cloudUploading"));
    try {
      const snapshot = buildCloudSnapshot();
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
              content: JSON.stringify(snapshot, null, 2),
            },
          },
        }),
      });
      if (!response.ok) {
        throw new Error(`Cloud sync upload failed (${response.status}).`);
      }
      setCloudSyncReferenceAt(snapshot.exportedAt ?? new Date().toISOString());
      setPendingCloudConflictSnapshot(null);
      setCloudSyncStatus(t("messages.cloudUploaded"));
      pushToast("success", t("messages.cloudUploaded"));
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
      setCloudSyncStatus(t("messages.cloudTokenRequired"));
      pushToast("error", t("messages.cloudNeedTokenCreate"));
      return;
    }

    setCloudSyncLoading(true);
    setCloudSyncStatus(t("messages.cloudCreatingGist"));
    try {
      const snapshot = buildCloudSnapshot();
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
              content: JSON.stringify(snapshot, null, 2),
            },
          },
        }),
      });
      if (!response.ok) {
        throw new Error(`Could not create gist (${response.status}).`);
      }
      const json = (await response.json()) as { id?: string };
      if (!json.id) {
        throw new Error(t("messages.cloudMissingGistId"));
      }
      setGistId(json.id);
      setCloudSyncReferenceAt(snapshot.exportedAt ?? new Date().toISOString());
      setPendingCloudConflictSnapshot(null);
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
      setCloudSyncStatus(t("messages.cloudTokenRequired"));
      pushToast("error", t("messages.cloudNeedTokenPull"));
      return;
    }
    if (!gistId.trim()) {
      setCloudSyncStatus(t("messages.cloudNeedGistPull"));
      pushToast("error", t("messages.cloudProvideGistBeforePull"));
      return;
    }

    setCloudSyncLoading(true);
    setCloudSyncStatus(t("messages.cloudDownloading"));
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
        throw new Error(t("messages.cloudNoSyncFile"));
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
        throw new Error(t("messages.cloudEmptySyncFile"));
      }
      const parsed = JSON.parse(content) as unknown;
      const remoteSnapshot = cloudSyncSnapshotSchema.parse(parsed);
      const remoteTimestamp = remoteSnapshot.exportedAt;
      const remoteMillis = remoteTimestamp ? Date.parse(remoteTimestamp) : NaN;
      const referenceMillis = cloudSyncReferenceAt ? Date.parse(cloudSyncReferenceAt) : NaN;
      if (
        remoteTimestamp &&
        cloudSyncReferenceAt &&
        Number.isFinite(remoteMillis) &&
        Number.isFinite(referenceMillis) &&
        remoteMillis < referenceMillis
      ) {
        setPendingCloudConflictSnapshot(remoteSnapshot);
        setCloudSyncStatus(
          t("cloudConflictOlder", {
            remote: formatSyncTimestamp(remoteTimestamp),
            local: formatSyncTimestamp(cloudSyncReferenceAt),
          }),
        );
        pushToast("info", t("messages.cloudConflictChoose"));
      } else {
        pushCloudRestorePoint("Before applying pulled cloud snapshot");
        applyCloudSnapshot(remoteSnapshot);
        setCloudSyncStatus(t("messages.cloudDownloadedApplied"));
        pushToast("success", t("messages.cloudDownloadedApplied"));
      }
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
  const showSettingsPane = isMobileLayout ? sidebarOpen : activeTab === "play" || activeTab === "settings";
  const showPlayPane = activeTab === "play";
  const showLibraryPane = isMobileLayout ? activeTab === "library" : activeTab === "play" || activeTab === "library";
  const showHistoryPane = isMobileLayout ? activeTab === "history" : activeTab === "play" || activeTab === "history";
  const settingsSidebarVisible = sidebarOpen && showSettingsPane;
  const settingsSheetMode = isMobileLayout && settingsSidebarVisible;
  const settingsTabActive = activeTab === "settings" || settingsSheetMode;
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
              {t("quickTour")}
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
            <span className="sr-only">{t("theme.label")}</span>
            <select
              value={themeMode}
              onChange={(event) => {
                setThemeMode(event.target.value as ThemeMode);
              }}
            >
              <option value="system">{t("theme.system")}</option>
              <option value="light">{t("theme.light")}</option>
              <option value="dark">{t("theme.dark")}</option>
              <option value="high-contrast">{t("theme.highContrast")}</option>
            </select>
          </label>
        </div>
        <Tabs.Root
          value={settingsTabActive ? "settings" : activeTab}
          onValueChange={(value) => {
            if (value === "settings") {
              if (isMobileLayout) {
                setSidebarOpen(true);
                return;
              }
              setActiveTab("settings");
              return;
            }
            if (value === "play" || value === "library" || value === "history") {
              setActiveTab(value);
            }
          }}
        >
          <Tabs.List className="task-nav" aria-label={t("workspaceSectionsAria")}>
            <Tabs.Trigger value="play" className="ghost task-trigger">
              <span className="button-label">
                <Play className="ui-icon" aria-hidden="true" />
                {t("tabs.play")}
              </span>
            </Tabs.Trigger>
            <Tabs.Trigger value="library" className="ghost task-trigger">
              <span className="button-label">
                <Library className="ui-icon" aria-hidden="true" />
                {t("tabs.library")}
              </span>
            </Tabs.Trigger>
            <Tabs.Trigger value="history" className="ghost task-trigger">
              <span className="button-label">
                <History className="ui-icon" aria-hidden="true" />
                {t("tabs.history")}
              </span>
            </Tabs.Trigger>
            <Tabs.Trigger value="settings" className="ghost task-trigger">
              <span className="button-label">
                <Settings2 className="ui-icon" aria-hidden="true" />
                {t("tabs.settings")}
              </span>
            </Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>
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

      {settingsSheetMode ? (
        <button
          type="button"
          className="settings-sheet-backdrop"
          aria-label={t("hideSettings")}
          onClick={() => setSidebarOpen(false)}
        />
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
          aria-label={t("gameSettingsAria")}
          className={clsx("settings-sidebar", !settingsSidebarVisible && "is-collapsed")}
          role={settingsSheetMode ? "dialog" : undefined}
          aria-modal={settingsSheetMode ? true : undefined}
        >
          {settingsSheetMode ? (
            <div className="settings-sheet-head">
              <strong>{t("settingsSheetTitle")}</strong>
              <button type="button" className="ghost compact settings-sheet-close" onClick={() => setSidebarOpen(false)}>
                <span className="button-label">
                  <X className="ui-icon" aria-hidden="true" />
                  {t("hideSettings")}
                </span>
              </button>
            </div>
          ) : null}
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
                  <strong>{t(modePresetTranslationKeys[preset.id]?.label ?? "modePreset.balanced.label")}</strong>
                  <span>{t(modePresetTranslationKeys[preset.id]?.description ?? "modePreset.balanced.description")}</span>
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
              <HelpTip text={t("helpTips.sources")} />
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
                    ? t("sourceCustomListNote")
                    : source === "steamImport"
                      ? t("sourceSteamImportNote")
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
                <HelpTip text={t("helpTips.weightedWheel")} />
              </label>
              <label className="cooldown-control">
                <span>{t("cooldownSpins")}</span>
                <HelpTip text={t("helpTips.cooldown")} />
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

            <div className="odds-controls">
              <label className="inline-check">
                <input
                  type="checkbox"
                  checked={adaptiveRecommendations}
                  onChange={(event) => {
                    setAdaptiveRecommendations(event.target.checked);
                    markCustom();
                  }}
                />
                <span>{t("adaptiveRecommendations")}</span>
                <HelpTip text={t("helpTips.adaptive")} />
              </label>
              <button
                type="button"
                className="ghost"
                onClick={applySuggestedWeights}
                disabled={behaviorSignalsCount < 3}
              >
                <span className="button-label">
                  <WandSparkles className="ui-icon" aria-hidden="true" />
                  {t("applySuggestedWeights")}
                </span>
              </button>
            </div>
            <p className="muted">
              {t("behaviorSignalsTracked", { count: behaviorSignalsCount })}
            </p>

            <div className="spin-motion-grid">
              <label className="filter-field">
                <span>{t("spinSpeedProfile")}</span>
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
                  {t("approxSpinTime", { seconds: (effectiveSpinDurationMs / 1000).toFixed(1) })}
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
                <span>{t("reducedSpinAnimation")}</span>
                <HelpTip text={t("helpTips.reducedSpin")} />
              </label>
            </div>

            <div className="weights-grid">
              <p className="muted">
                {t("perSourceMultipliers")}
                <HelpTip text={t("helpTips.perSourceMultipliers")} />
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

            <div className="weights-grid">
              <p className="muted">
                {t("suggestedMultipliers")}
                <HelpTip text={t("helpTips.suggestedMultipliers")} />
              </p>
              {sourceKeys.map((source) => (
                <div key={`suggested-${source}`} className="weight-row suggested-row" aria-live="polite">
                  <span>{sourceLabels[source]}</span>
                  <div className="suggested-bar" aria-hidden="true" />
                  <strong>{suggestedSourceWeights[source].toFixed(1)}x</strong>
                </div>
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
                {t("advancedOptionsTitle")}
              </span>
              <HelpTip text={t("helpTips.advancedControls")} />
            </h2>
            <p className="muted">{t("advancedOptionsDescription")}</p>
            <Accordion.Root
              type="single"
              collapsible
              value={showAdvancedSettings ? "advanced" : undefined}
              onValueChange={(value) => setShowAdvancedSettings(value === "advanced")}
            >
              <Accordion.Item value="advanced" className="advanced-toggle-item">
                <Accordion.Header className="sr-only">{t("advancedSettingsToggleLabel")}</Accordion.Header>
                <Accordion.Trigger className="ghost advanced-toggle-trigger" aria-controls="advanced-settings-stack">
                  <span className="button-label">
                    <ChevronsUpDown className="ui-icon" aria-hidden="true" />
                    {showAdvancedSettings ? t("hideAdvancedOptions") : t("showAdvancedOptions")}
                  </span>
                </Accordion.Trigger>
              </Accordion.Item>
            </Accordion.Root>
          </section>

          <section className="panel" aria-labelledby="steam-import-heading">
            <h2 id="steam-import-heading" className="section-heading">
              <span className="heading-label">
                <KeyRound className="ui-icon" aria-hidden="true" />
                {t("steamImportTitle")}
              </span>
              <HelpTip text={t("helpTips.steamImport")} />
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
                {t("steamImportingStatus")}
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
                {t("advancedFiltersTitle")}
              </span>
              <HelpTip text={t("helpTips.advancedFilters")} />
            </h2>
            <p className="muted">{t("advancedFiltersDescription")}</p>
            <div className="filters-grid">
              <label className="filter-field">
                <span>{t("filterPlatform")}</span>
                <select
                  value={filters.platform}
                  onChange={(event) => {
                    setFilters((current) => ({ ...current, platform: event.target.value as PlatformFilter }));
                    markCustom();
                  }}
                >
                  <option value="any">{t("any")}</option>
                  <option value="windows">{t("windows")}</option>
                  <option value="mac">{t("macos")}</option>
                  <option value="linux">{t("linux")}</option>
                </select>
              </label>

              <label className="filter-field">
                <span>{t("filterGenreTag")}</span>
                <select
                  value={filters.tag}
                  onChange={(event) => {
                    setFilters((current) => ({ ...current, tag: event.target.value }));
                    markCustom();
                  }}
                >
                  <option value="any">{t("any")}</option>
                  {availableTags.slice(0, 250).map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
              </label>

              <label className="filter-field">
                <span>{t("filterEstimatedLength")}</span>
                <select
                  value={filters.length}
                  onChange={(event) => {
                    setFilters((current) => ({ ...current, length: event.target.value as LengthFilter }));
                    markCustom();
                  }}
                >
                  <option value="any">{t("any")}</option>
                  <option value="short">{t("short")}</option>
                  <option value="medium">{t("medium")}</option>
                  <option value="long">{t("long")}</option>
                </select>
              </label>

              <label className="filter-field">
                <span>{t("filterReleaseAfter")}</span>
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
                <span>{t("filterReleaseBefore")}</span>
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
                <span>{t("maxPriceLabel", { price: filters.maxPriceUsd.toFixed(0) })}</span>
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
                  {t("maxPriceHelp")}
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
                <span>{t("freeOnly")}</span>
                <HelpTip text={t("helpTips.freeOnly")} />
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
                  {t("resetFilters")}
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
              <HelpTip text={t("helpTips.playedCompleted")} />
            </h2>
            <p className="muted">{t("playedCompletedDescription")}</p>
            <div className="odds-controls">
              <label className="inline-check">
                <input type="checkbox" checked={excludePlayed} onChange={(event) => setExcludePlayed(event.target.checked)} />
                <span>{t("excludePlayed")}</span>
                <HelpTip text={t("helpTips.excludePlayed")} />
              </label>
              <label className="inline-check">
                <input
                  type="checkbox"
                  checked={excludeCompleted}
                  onChange={(event) => setExcludeCompleted(event.target.checked)}
                />
                <span>{t("excludeCompleted")}</span>
                <HelpTip text={t("helpTips.excludeCompleted")} />
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
              <HelpTip text={t("helpTips.notifications")} />
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
                <HelpTip text={t("helpTips.notificationsPermission")} />
              </label>
              <label className="inline-check">
                <input
                  type="checkbox"
                  checked={trendNotifications}
                  disabled={!notificationsEnabled}
                  onChange={(event) => setTrendNotifications(event.target.checked)}
                />
                <span>{t("newTrendsAlerts")}</span>
                <HelpTip text={t("helpTips.trendAlerts")} />
              </label>
              <label className="inline-check">
                <input
                  type="checkbox"
                  checked={reminderNotifications}
                  disabled={!notificationsEnabled}
                  onChange={(event) => setReminderNotifications(event.target.checked)}
                />
                <span>{t("spinReminders")}</span>
                <HelpTip text={t("helpTips.spinReminders")} />
              </label>
              <label className="cooldown-control">
                <span>{t("reminderInterval")}</span>
                <HelpTip text={t("helpTips.reminderInterval")} />
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
                {t("cloudSyncTitle")}
              </span>
              <HelpTip text={t("helpTips.cloudSync")} />
            </h2>
            <p className="muted">{t("cloudSyncDescription")}</p>
            <div className="steam-grid">
              <label htmlFor="cloud-token" className="sr-only">
                {t("cloudTokenLabel")}
              </label>
              <input
                id="cloud-token"
                type="password"
                placeholder={t("cloudTokenPlaceholder")}
                value={gistToken}
                onChange={(event) => setGistToken(event.target.value)}
                autoComplete="off"
              />
              <label htmlFor="cloud-gist-id" className="sr-only">
                {t("cloudGistIdLabel")}
              </label>
              <input
                id="cloud-gist-id"
                type="text"
                placeholder={t("cloudGistIdPlaceholder")}
                value={gistId}
                onChange={(event) => setGistId(event.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="button-row">
              <button type="button" onClick={createCloudSyncGist} disabled={cloudSyncLoading}>
                <span className="button-label">
                  <FilePlus2 className="ui-icon" aria-hidden="true" />
                  {cloudSyncLoading ? t("updating") : t("createGistPush")}
                </span>
              </button>
              <button type="button" className="ghost" onClick={pushCloudSync} disabled={cloudSyncLoading}>
                <span className="button-label">
                  <Upload className="ui-icon" aria-hidden="true" />
                  {t("pushSync")}
                </span>
              </button>
              <button type="button" className="ghost" onClick={pullCloudSync} disabled={cloudSyncLoading}>
                <span className="button-label">
                  <Download className="ui-icon" aria-hidden="true" />
                  {t("pullSync")}
                </span>
              </button>
            </div>
            <div className="cloud-account-profiles">
              <strong>{t("accountProfilesTitle")}</strong>
              <p className="muted">
                {t("accountProfilesDescription")}
              </p>
              <div className="steam-grid">
                <label className="filter-field" htmlFor="account-profile-select">
                  <span>{t("activeProfile")}</span>
                  <select
                    id="account-profile-select"
                    value={activeAccountProfileId}
                    onChange={(event) => setActiveAccountProfileId(event.target.value)}
                  >
                    <option value="">{t("none")}</option>
                    {accountProfiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.name} ({formatSyncTimestamp(profile.updatedAt)})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="filter-field" htmlFor="account-profile-name">
                  <span>{t("newProfileName")}</span>
                  <input
                    id="account-profile-name"
                    type="text"
                    value={accountProfileDraftName}
                    onChange={(event) => setAccountProfileDraftName(event.target.value)}
                    placeholder={t("newProfilePlaceholder")}
                  />
                </label>
              </div>
              <div className="button-row">
                <button type="button" className="ghost" onClick={createAccountProfile}>
                  {t("createProfile")}
                </button>
                <button type="button" className="ghost" onClick={saveCurrentToActiveProfile} disabled={!activeAccountProfileId}>
                  {t("saveCurrentToActive")}
                </button>
                <button type="button" className="ghost" onClick={applyActiveAccountProfile} disabled={!activeAccountProfileId}>
                  {t("applyActive")}
                </button>
                <button type="button" className="ghost" onClick={deleteActiveAccountProfile} disabled={!activeAccountProfileId}>
                  {t("deleteActive")}
                </button>
              </div>
              {accountProfiles.length > 0 ? (
                <p className="muted">{t("profilesStored", { count: accountProfiles.length })}</p>
              ) : (
                <p className="muted">{t("noProfilesSaved")}</p>
              )}
            </div>
            <p className="muted">{t("cloudReference", { value: formatSyncTimestamp(cloudSyncReferenceAt) })}</p>
            {pendingCloudConflictSnapshot ? (
              <div className="cloud-sync-conflict" role="alert">
                <p>
                  {t("cloudConflictOlder", {
                    remote: formatSyncTimestamp(pendingCloudConflictSnapshot.exportedAt),
                    local: formatSyncTimestamp(cloudSyncReferenceAt),
                  })}
                </p>
                <div className="button-row">
                  <button type="button" className="ghost" onClick={dismissCloudConflict} disabled={cloudSyncLoading}>
                    {t("keepLocal")}
                  </button>
                  <button type="button" onClick={applyPendingCloudConflict} disabled={cloudSyncLoading}>
                    {t("applyRemoteAnyway")}
                  </button>
                </div>
              </div>
            ) : null}
            {cloudRestorePoints.length > 0 ? (
              <div className="cloud-restore-points">
                <strong>{t("restorePointsTitle")}</strong>
                <ul>
                  {cloudRestorePoints.map((point) => (
                    <li key={point.id}>
                      <span>
                        {formatSyncTimestamp(point.createdAt)} | {point.reason}
                      </span>
                      <button type="button" className="ghost compact" onClick={() => restoreFromCloudPoint(point)}>
                        {t("restore")}
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="button-row">
                  <button
                    type="button"
                    className="ghost compact"
                    onClick={() => {
                      setCloudRestorePoints([]);
                      pushToast("info", t("messages.cloudRestorePointsCleared"));
                    }}
                  >
                    {t("clearRestorePoints")}
                  </button>
                </div>
              </div>
            ) : null}
            {cloudSyncLoading ? (
              <p className="status progress-status" role="status" aria-live="polite">
                <span className="progress-dot" aria-hidden="true" />
                {t("syncingWithGist")}
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
            <section className="panel" aria-label={t("settingsGuidanceAria")}>
              <h2 className="section-heading">
                <span className="heading-label">
                  <Settings2 className="ui-icon" aria-hidden="true" />
                  {t("settingsGuidanceTitle")}
                </span>
              </h2>
              <p className="muted">{t("settingsGuidanceDescription")}</p>
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
            <p className="winner-tag">{t("quickStart")}</p>
            <h3 id="onboarding-title">{t(onboardingSteps[onboardingStep]?.titleKey ?? "onboarding.buildLibraryTitle")}</h3>
            <p id="onboarding-description">{t(onboardingSteps[onboardingStep]?.descriptionKey ?? "onboarding.buildLibraryDescription")}</p>
            <div className="onboarding-dots" aria-label={t("onboardingProgress")}>
              {onboardingSteps.map((step, index) => (
                <button
                  key={step.titleKey}
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
                {t("skip")}
              </button>
              {onboardingStep > 0 ? (
                <button type="button" className="ghost" onClick={() => setOnboardingStep((current) => current - 1)}>
                  {t("back")}
                </button>
              ) : null}
              {onboardingStep < onboardingLastStep ? (
                <button type="button" onClick={() => setOnboardingStep((current) => current + 1)}>
                  {t("next")}
                </button>
              ) : (
                <button type="button" onClick={() => completeOnboarding("play")}>
                  {t("startSpinning")}
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
                {t("dismissToast")}
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
