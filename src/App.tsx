import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import clsx from "clsx";
import { useTranslation } from "react-i18next";
import { normalizeGames, pickSpinWithWeights } from "./lib/wheel";
import { formatOdds, formatSyncTimestamp, getFocusableElements, keepFocusInContainer, readStorage } from "./lib/appUtils";
import { useCloudSyncTransport } from "./hooks/useCloudSyncTransport";
import { useCloudProfileActions } from "./hooks/useCloudProfileActions";
import { useCloudSnapshotBuilders } from "./hooks/useCloudSnapshotBuilders";
import {
  SW_NOTIFICATION_PREFS_MESSAGE,
  SW_SKIP_WAITING_MESSAGE,
  SW_TOP_GAMES_UPDATED_MESSAGE,
  SW_UPDATE_READY_EVENT,
} from "./lib/pwa";
import { WinnerModal } from "./features/play/WinnerModal";
import { SourcesPanel } from "./features/settings/SourcesPanel";
import { AdvancedOptionsPanel } from "./features/settings/AdvancedOptionsPanel";
import { FiltersPanel } from "./features/settings/FiltersPanel";
import { ExclusionsPanel } from "./features/settings/ExclusionsPanel";
import { NotificationsPanel } from "./features/settings/NotificationsPanel";
import { SteamImportPanel } from "./features/settings/SteamImportPanel";
import { CloudSyncPanel } from "./features/settings/CloudSyncPanel";
import { AppHeader } from "./features/layout/AppHeader";
import { UpdateBanners } from "./features/layout/UpdateBanners";
import { OnboardingModal } from "./features/layout/OnboardingModal";
import { ToastStack } from "./features/layout/ToastStack";
import { WorkspaceShell } from "./features/layout/WorkspaceShell";
import { MainContentPanels } from "./features/layout/MainContentPanels";
import { useAppPersistence } from "./hooks/useAppPersistence";
import {
  ACTIVE_ACCOUNT_PROFILE_STORAGE_KEY,
  CLOUD_SYNC_REFERENCE_STORAGE_KEY,
  CLOUD_SYNC_RESTORE_POINTS_STORAGE_KEY,
  EXCLUSION_STORAGE_KEY,
  HISTORY_STORAGE_KEY,
  MANUAL_GAMES_STORAGE_KEY,
  MAX_CLOUD_RESTORE_POINTS,
  NOTIFICATION_STORAGE_KEY,
  ONBOARDING_STORAGE_KEY,
  SETTINGS_STORAGE_KEY,
  STEAM_IMPORT_STORAGE_KEY,
  THEME_STORAGE_KEY,
  ACCOUNT_PROFILES_STORAGE_KEY,
  CLOUD_SYNC_STORAGE_KEY,
} from "./lib/storageKeys";
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

const sourceKeys = ["steamcharts", "steamdb", "twitchmetrics", "itchio", "manual", "steamImport"] as const;
type SourceToggleKey = (typeof sourceKeys)[number];

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

export default function App() {
  const { t } = useTranslation();

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

  const persistedSettings = useMemo<StoredSettings>(
    () => ({
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
  const persistedSteamImport = useMemo<StoredSteamImport>(
    () => ({
      steamApiKey,
      steamId,
      steamImportGames,
    }),
    [steamApiKey, steamId, steamImportGames],
  );
  const persistedExclusions = useMemo<StoredExclusions>(
    () => ({
      excludePlayed,
      excludeCompleted,
      playedGames,
      completedGames,
    }),
    [completedGames, excludeCompleted, excludePlayed, playedGames],
  );
  const persistedNotifications = useMemo<StoredNotificationSettings>(
    () => ({
      notificationsEnabled,
      trendNotifications,
      reminderNotifications,
      reminderIntervalMinutes,
    }),
    [notificationsEnabled, reminderIntervalMinutes, reminderNotifications, trendNotifications],
  );
  const persistedCloudSync = useMemo<StoredCloudSync>(
    () => ({
      provider: cloudProvider,
      gistId,
      gistToken,
    }),
    [cloudProvider, gistId, gistToken],
  );

  useAppPersistence({
    settings: persistedSettings,
    spinHistory,
    manualGames,
    steamImport: persistedSteamImport,
    exclusions: persistedExclusions,
    notifications: persistedNotifications,
    cloudSync: persistedCloudSync,
    accountProfiles,
    activeAccountProfileId,
    cloudRestorePoints,
    cloudSyncReferenceAt,
    themeMode,
  });

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

  const { buildCloudSnapshot, pushCloudRestorePoint } = useCloudSnapshotBuilders<
    StoredSettings,
    GameEntry,
    SpinHistoryItem,
    CloudSyncSnapshot
  >({
    currentSettingsSnapshot,
    spinHistory,
    manualGames,
    steamApiKey,
    steamId,
    steamImportGames,
    excludePlayed,
    excludeCompleted,
    playedGames,
    completedGames,
    notificationsEnabled,
    trendNotifications,
    reminderNotifications,
    reminderIntervalMinutes,
    activeAccountProfileId,
    accountProfiles,
    maxCloudRestorePoints: MAX_CLOUD_RESTORE_POINTS,
    setCloudRestorePoints,
  });

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

  const {
    dismissCloudConflict,
    applyPendingCloudConflict,
    restoreFromCloudPoint,
    createAccountProfile,
    saveCurrentToActiveProfile,
    applyActiveAccountProfile,
    deleteActiveAccountProfile,
  } = useCloudProfileActions<StoredSettings, CloudSyncSnapshot>({
    t,
    pushToast,
    accountProfileDraftName,
    setAccountProfileDraftName,
    activeAccountProfileId,
    setActiveAccountProfileId,
    accountProfiles,
    setAccountProfiles,
    pendingCloudConflictSnapshot,
    setPendingCloudConflictSnapshot,
    setCloudSyncStatus,
    currentSettingsSnapshot,
    applyStoredSettings,
    pushCloudRestorePoint,
    applyCloudSnapshot,
  });

  const parseCloudSnapshot = useCallback((raw: unknown) => cloudSyncSnapshotSchema.parse(raw), []);

  const { pushCloudSync, createCloudSyncGist, pullCloudSync } = useCloudSyncTransport({
    gistId,
    gistToken,
    cloudSyncReferenceAt,
    t,
    pushToast,
    buildCloudSnapshot,
    parseCloudSnapshot,
    applyCloudSnapshot,
    pushCloudRestorePoint,
    setGistId,
    setCloudSyncReferenceAt,
    setPendingCloudConflictSnapshot,
    setCloudSyncStatus,
    setCloudSyncLoading,
  });

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
  const presetCards = modePresets.map((preset) => ({
    id: preset.id,
    label: t(modePresetTranslationKeys[preset.id]?.label ?? "modePreset.balanced.label"),
    description: t(modePresetTranslationKeys[preset.id]?.description ?? "modePreset.balanced.description"),
  }));
  const sourceCards = sourceKeys.map((source) => ({
    source,
    label: sourceLabels[source],
    enabled: enabledSources[source],
    loadedCount:
      source === "manual"
        ? manualGames.length
        : source === "steamImport"
          ? steamImportGames.length
          : (topGames?.sources[source].games.length ?? 0),
    loading: topGamesQuery.isLoading && source !== "manual" && source !== "steamImport",
    fetchedAt: source === "manual" || source === "steamImport" ? null : (topGames?.sources[source].fetchedAt ?? null),
    note:
      source === "manual"
        ? t("sourceCustomListNote")
        : source === "steamImport"
          ? t("sourceSteamImportNote")
          : topGames?.sources[source].note,
  }));
  const sourceWeightRows = sourceKeys.map((source) => ({
    source,
    label: sourceLabels[source],
    value: sourceWeights[source],
    suggested: suggestedSourceWeights[source],
  }));
  const spinSpeedOptions = (Object.entries(spinSpeedProfiles) as [SpinSpeedProfile, (typeof spinSpeedProfiles)[SpinSpeedProfile]][]).map(
    ([id, profile]) => ({
      id,
      label: profile.label,
    }),
  );
  const sourceLoadError = topGamesQuery.isError ? (topGamesQuery.error as Error).message : null;
  const cloudProfileOptions = accountProfiles.map((profile) => ({
    id: profile.id,
    name: profile.name,
    updatedAtLabel: formatSyncTimestamp(profile.updatedAt, t("unknown")),
  }));
  const cloudReferenceLabel = formatSyncTimestamp(cloudSyncReferenceAt, t("unknown"));
  const cloudConflict = pendingCloudConflictSnapshot
    ? {
        remoteLabel: formatSyncTimestamp(pendingCloudConflictSnapshot.exportedAt, t("unknown")),
        localLabel: formatSyncTimestamp(cloudSyncReferenceAt, t("unknown")),
      }
    : null;
  const cloudRestorePointOptions = cloudRestorePoints.map((point) => ({
    id: point.id,
    timestampLabel: formatSyncTimestamp(point.createdAt, t("unknown")),
    reason: point.reason,
  }));
  const handleSidebarToggle = () =>
    setSidebarOpen((current) => {
      const next = !current;
      if (!next && activeTab === "settings") {
        setActiveTab("play");
      }
      return next;
    });
  const handleOpenQuickTour = () => {
    setOnboardingStep(0);
    setShowOnboarding(true);
  };
  const handleHeaderTabChange = (value: "play" | "library" | "history" | "settings") => {
    if (value === "settings") {
      if (isMobileLayout) {
        setSidebarOpen(true);
        return;
      }
      setActiveTab("settings");
      return;
    }
    setActiveTab(value);
  };

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
      <AppHeader
        sidebarOpen={sidebarOpen}
        settingsSidebarVisible={settingsSidebarVisible}
        activeTab={activeTab}
        settingsTabActive={settingsTabActive}
        themeMode={themeMode}
        installAvailable={Boolean(installPrompt)}
        onToggleSidebar={handleSidebarToggle}
        onOpenQuickTour={handleOpenQuickTour}
        onInstall={handleInstall}
        onThemeModeChange={setThemeMode}
        onTabChange={handleHeaderTabChange}
      />

      <UpdateBanners
        swUpdateReady={swUpdateReady}
        dismissedUpdate={dismissedUpdate}
        updateInProgress={updateInProgress}
        freshTrendsNotice={freshTrendsNotice}
        onApplyServiceWorkerUpdate={applyServiceWorkerUpdate}
        onDismissUpdate={() => setDismissedUpdate(true)}
        onDismissFreshTrends={() => setFreshTrendsNotice(false)}
      />

      <WorkspaceShell
        settingsSheetMode={settingsSheetMode}
        hideSettingsLabel={t("hideSettings")}
        onCloseSettings={() => setSidebarOpen(false)}
        settingsSidebarVisible={settingsSidebarVisible}
        showSettingsPane={showSettingsPane}
        activeTab={activeTab}
        gameSettingsAriaLabel={t("gameSettingsAria")}
        settingsSheetTitle={t("settingsSheetTitle")}
        settingsContent={
          <>
            <SourcesPanel
              presetCards={presetCards}
              activePreset={activePreset}
              onApplyPreset={(presetId) => {
                const preset = modePresets.find((candidate) => candidate.id === presetId);
                if (!preset) return;
                applyPreset(preset);
              }}
              sourceCards={sourceCards}
              onToggleSource={(source) => {
                setEnabledSources((current) => ({
                  ...current,
                  [source]: !current[source],
                }));
                markCustom();
              }}
              weightedMode={weightedMode}
              onWeightedModeChange={(value) => {
                setWeightedMode(value);
                markCustom();
              }}
              cooldownSpins={cooldownSpins}
              onCooldownSpinsChange={(value) => {
                setCooldownSpins(value);
                markCustom();
              }}
              adaptiveRecommendations={adaptiveRecommendations}
              onAdaptiveRecommendationsChange={(value) => {
                setAdaptiveRecommendations(value);
                markCustom();
              }}
              onApplySuggestedWeights={applySuggestedWeights}
              behaviorSignalsCount={behaviorSignalsCount}
              spinSpeedProfile={spinSpeedProfile}
              spinSpeedOptions={spinSpeedOptions}
              onSpinSpeedProfileChange={(value) => {
                setSpinSpeedProfile(value);
                markCustom();
              }}
              effectiveSpinDurationMs={effectiveSpinDurationMs}
              reducedSpinAnimation={reducedSpinAnimation}
              onReducedSpinAnimationChange={(value) => {
                setReducedSpinAnimation(value);
                markCustom();
              }}
              weightRows={sourceWeightRows}
              onSourceWeightChange={(source, value) => {
                setSourceWeights((current) => ({
                  ...current,
                  [source]: value,
                }));
                markCustom();
              }}
              loadingData={topGamesQuery.isLoading}
              loadingError={sourceLoadError}
            />

            <AdvancedOptionsPanel
              showAdvancedSettings={showAdvancedSettings}
              onShowAdvancedSettingsChange={setShowAdvancedSettings}
            />

            <SteamImportPanel
              steamApiKey={steamApiKey}
              steamId={steamId}
              steamImportLoading={steamImportLoading}
              steamImportStatus={steamImportStatus}
              onSteamApiKeyChange={setSteamApiKey}
              onSteamIdChange={setSteamId}
              onImport={importSteamLibrary}
              onClear={clearSteamImport}
            />

            <div id="advanced-settings-stack" className={clsx("advanced-settings-stack", !showAdvancedSettings && "is-collapsed")}>
              <FiltersPanel
                filters={filters}
                availableTags={availableTags}
                onPlatformChange={(value) => {
                  setFilters((current) => ({ ...current, platform: value as PlatformFilter }));
                  markCustom();
                }}
                onTagChange={(value) => {
                  setFilters((current) => ({ ...current, tag: value }));
                  markCustom();
                }}
                onLengthChange={(value) => {
                  setFilters((current) => ({ ...current, length: value as LengthFilter }));
                  markCustom();
                }}
                onReleaseFromChange={(value) => {
                  setFilters((current) => ({ ...current, releaseFrom: value }));
                  markCustom();
                }}
                onReleaseToChange={(value) => {
                  setFilters((current) => ({ ...current, releaseTo: value }));
                  markCustom();
                }}
                onMaxPriceChange={(value) => {
                  setFilters((current) => ({ ...current, maxPriceUsd: value }));
                  markCustom();
                }}
                onFreeOnlyChange={(value) => {
                  setFilters((current) => ({ ...current, freeOnly: value }));
                  markCustom();
                }}
                onReset={() => {
                  setFilters(defaultFilters);
                  markCustom();
                }}
              />

              <ExclusionsPanel
                excludePlayed={excludePlayed}
                excludeCompleted={excludeCompleted}
                exclusionInput={exclusionInput}
                playedGames={playedGames}
                completedGames={completedGames}
                onExcludePlayedChange={setExcludePlayed}
                onExcludeCompletedChange={setExcludeCompleted}
                onExclusionInputChange={setExclusionInput}
                onAddPlayed={() => addExclusionFromInput("played")}
                onAddCompleted={() => addExclusionFromInput("completed")}
                onRemovePlayed={removePlayedGame}
                onRemoveCompleted={removeCompletedGame}
                onClearPlayed={() => setPlayedGames([])}
                onClearCompleted={() => setCompletedGames([])}
              />

              <NotificationsPanel
                notificationsEnabled={notificationsEnabled}
                trendNotifications={trendNotifications}
                reminderNotifications={reminderNotifications}
                reminderIntervalMinutes={reminderIntervalMinutes}
                notificationStatus={notificationStatus}
                onNotificationsEnabledChange={(value) => {
                  void setNotificationsEnabledWithPermission(value);
                }}
                onTrendNotificationsChange={setTrendNotifications}
                onReminderNotificationsChange={setReminderNotifications}
                onReminderIntervalChange={setReminderIntervalMinutes}
              />

              <CloudSyncPanel
                gistToken={gistToken}
                gistId={gistId}
                cloudSyncLoading={cloudSyncLoading}
                cloudSyncStatus={cloudSyncStatus}
                onGistTokenChange={setGistToken}
                onGistIdChange={setGistId}
                onCreateGistPush={createCloudSyncGist}
                onPushSync={pushCloudSync}
                onPullSync={pullCloudSync}
                activeAccountProfileId={activeAccountProfileId}
                accountProfiles={cloudProfileOptions}
                accountProfileDraftName={accountProfileDraftName}
                onActiveAccountProfileChange={setActiveAccountProfileId}
                onAccountProfileDraftNameChange={setAccountProfileDraftName}
                onCreateProfile={createAccountProfile}
                onSaveCurrentToActive={saveCurrentToActiveProfile}
                onApplyActive={applyActiveAccountProfile}
                onDeleteActive={deleteActiveAccountProfile}
                cloudReferenceLabel={cloudReferenceLabel}
                conflict={cloudConflict}
                onKeepLocal={dismissCloudConflict}
                onApplyRemote={applyPendingCloudConflict}
                restorePoints={cloudRestorePointOptions}
                onRestorePoint={(id) => {
                  const point = cloudRestorePoints.find((entry) => entry.id === id);
                  if (!point) return;
                  restoreFromCloudPoint(point);
                }}
                onClearRestorePoints={() => {
                  setCloudRestorePoints([]);
                  pushToast("info", t("messages.cloudRestorePointsCleared"));
                }}
              />
            </div>
          </>
        }
        mainContent={
          <MainContentPanels
            showPlayPane={showPlayPane}
            activePoolCount={activePool.length}
            exclusionSummarySuffix={exclusionSummarySuffix}
            cooldownExcludedSuffix={cooldownExcludedSuffix}
            advancedFilterExhausted={advancedFilterExhausted}
            statusExhausted={statusExhausted}
            cooldownSaturated={cooldownSaturated}
            games={activePool.map((candidate) => candidate.name)}
            rotation={rotation}
            spinning={spinning}
            spinDurationMs={effectiveSpinDurationMs}
            onSpinEnd={onSpinEnd}
            onSpin={handleSpin}
            onClearHistory={clearHistory}
            winner={winner}
            winnerMeta={winnerMeta}
            formatSourceList={sourceLabelList}
            formatOdds={formatOdds}
            onMarkPlayed={() => markGamesPlayed([winner])}
            onMarkCompleted={() => markGamesCompleted([winner])}
            showLibraryPane={showLibraryPane}
            manualInput={manualInput}
            onManualInputChange={setManualInput}
            onAddManual={addManualGames}
            onClearManual={clearManualGames}
            showHistoryPane={showHistoryPane}
            historyDisplayItems={historyDisplayItems}
            showSettingsGuidance={activeTab === "settings"}
          />
        }
      />

      <OnboardingModal
        show={showOnboarding}
        onboardingCardRef={onboardingCardRef}
        steps={onboardingSteps}
        currentStep={onboardingStep}
        onStepSelect={setOnboardingStep}
        onSkip={() => completeOnboarding("play")}
        onBack={() => setOnboardingStep((current) => current - 1)}
        onNext={() => setOnboardingStep((current) => current + 1)}
        onFinish={() => completeOnboarding("play")}
      />

      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <WinnerModal
        show={showWinnerPopup}
        winner={winner}
        winnerMeta={winnerMeta}
        winnerPulse={winnerPulse}
        winnerPopupRef={winnerPopupRef}
        winnerPopupCloseRef={winnerPopupCloseRef}
        formatSourceList={sourceLabelList}
        formatOdds={formatOdds}
        onClose={() => setShowWinnerPopup(false)}
        onMarkPlayed={() => markGamesPlayed([winner])}
        onMarkCompleted={() => markGamesCompleted([winner])}
      />
    </main>
  );
}
