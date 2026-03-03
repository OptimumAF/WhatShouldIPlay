import { normalizeGames } from "./wheel";
import { MAX_CLOUD_RESTORE_POINTS } from "./storageKeys";
import {
  accountProfilesSchema,
  cloudRestorePointsSchema,
  storedCloudSyncSchema,
  storedExclusionsSchema,
  storedNotificationSettingsSchema,
  storedSteamImportSchema,
  type CloudSyncSnapshot,
} from "./appSchemas";
import type { GameEntry, GameLength, GamePlatform, SourceId } from "../types";

export const sourceKeys = ["steamcharts", "steamdb", "twitchmetrics", "itchio", "manual", "steamImport"] as const;
export type SourceToggleKey = (typeof sourceKeys)[number];

export type EnabledSources = Record<SourceToggleKey, boolean>;
export type SourceWeights = Record<SourceToggleKey, number>;
export type ThemeMode = "system" | "light" | "dark" | "high-contrast";
export type WorkspaceTab = "play" | "library" | "history" | "settings";
export type SpinSpeedProfile = "cinematic" | "balanced" | "rapid";

export interface PoolGame {
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

export interface WinnerInfo {
  name: string;
  sources: SourceId[];
  odds: number;
  appId?: number;
  url?: string;
}

export interface SpinHistoryItem extends WinnerInfo {
  spunAt: string;
}

export interface ModePreset {
  id: string;
  label: string;
  description: string;
  enabledSources: EnabledSources;
  sourceWeights: SourceWeights;
  weightedMode: boolean;
  cooldownSpins: number;
}

export interface StoredSettings {
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

export type PlatformFilter = "any" | GamePlatform;
export type LengthFilter = "any" | GameLength;

export interface AdvancedFilters {
  platform: PlatformFilter;
  tag: string;
  length: LengthFilter;
  releaseFrom: string;
  releaseTo: string;
  freeOnly: boolean;
  maxPriceUsd: number;
}

export interface StoredSteamImport {
  steamApiKey: string;
  steamId: string;
  steamImportGames: GameEntry[];
}

export interface StoredExclusions {
  excludePlayed: boolean;
  excludeCompleted: boolean;
  playedGames: string[];
  completedGames: string[];
}

export interface StoredNotificationSettings {
  notificationsEnabled: boolean;
  trendNotifications: boolean;
  reminderNotifications: boolean;
  reminderIntervalMinutes: number;
}

export interface StoredCloudSync {
  provider: "githubGist";
  gistId: string;
  gistToken: string;
}

export interface CloudRestorePoint {
  id: string;
  createdAt: string;
  reason: string;
  snapshot: CloudSyncSnapshot;
}

export interface AccountProfilePreset {
  id: string;
  name: string;
  updatedAt: string;
  settings: StoredSettings;
}

export interface ToastMessage {
  id: string;
  tone: "info" | "success" | "error";
  text: string;
}

export interface ScreenReaderAnnouncement {
  id: number;
  text: string;
}

export interface OnboardingStep {
  titleKey: string;
  descriptionKey: string;
  focusTab: WorkspaceTab;
}

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
}

export const sourceLabels: Record<SourceToggleKey, string> = {
  steamcharts: "SteamCharts",
  steamdb: "SteamDB",
  twitchmetrics: "TwitchMetrics",
  itchio: "itch.io",
  manual: "Manual",
  steamImport: "Steam Library",
};

export const defaultEnabledSources: EnabledSources = {
  steamcharts: true,
  steamdb: true,
  twitchmetrics: true,
  itchio: false,
  manual: true,
  steamImport: true,
};

export const defaultSourceWeights: SourceWeights = {
  steamcharts: 1.2,
  steamdb: 1.15,
  twitchmetrics: 1,
  itchio: 0.95,
  manual: 0.9,
  steamImport: 1.35,
};

export const modePresets: ModePreset[] = [
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

export const modePresetTranslationKeys: Record<string, { label: string; description: string }> = {
  balanced: { label: "modePreset.balanced.label", description: "modePreset.balanced.description" },
  quick: { label: "modePreset.quick.label", description: "modePreset.quick.description" },
  "no-repeats": { label: "modePreset.noRepeats.label", description: "modePreset.noRepeats.description" },
  "owned-first": { label: "modePreset.ownedFirst.label", description: "modePreset.ownedFirst.description" },
};

export const defaultFilters: AdvancedFilters = {
  platform: "any",
  tag: "any",
  length: "any",
  releaseFrom: "",
  releaseTo: "",
  freeOnly: false,
  maxPriceUsd: 70,
};

export const spinSpeedProfiles: Record<
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

export const fallbackSettings: StoredSettings = {
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

export const fallbackSteamImport: StoredSteamImport = {
  steamApiKey: "",
  steamId: "",
  steamImportGames: [],
};

export const fallbackExclusions: StoredExclusions = {
  excludePlayed: true,
  excludeCompleted: true,
  playedGames: [],
  completedGames: [],
};

export const fallbackNotificationSettings: StoredNotificationSettings = {
  notificationsEnabled: false,
  trendNotifications: true,
  reminderNotifications: false,
  reminderIntervalMinutes: 120,
};

export const fallbackCloudSync: StoredCloudSync = {
  provider: "githubGist",
  gistId: "",
  gistToken: "",
};

export const onboardingSteps: OnboardingStep[] = [
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

export const sourceLabelList = (sources: SourceId[]) =>
  sources
    .map((source) => sourceLabels[source as SourceToggleKey] ?? source)
    .filter((value, index, arr) => arr.indexOf(value) === index)
    .join(" + ");

export const gameWeight = (entry: GameEntry, sourceWeights: SourceWeights, weightedMode: boolean) => {
  if (!weightedMode) return 1;
  const sourceWeight = sourceWeights[entry.source as SourceToggleKey] ?? 1;
  const rankBoost = entry.rank ? Math.max(0.7, 1.45 - (entry.rank - 1) / 40) : 1;
  const scoreBoost = entry.score ? Math.min(1.9, 1 + Math.log10(entry.score + 10) / 4) : 1;
  return Math.max(0.1, sourceWeight * rankBoost * scoreBoost);
};

export const sanitizeFilters = (input: AdvancedFilters | null | undefined): AdvancedFilters => {
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

export const sanitizeSpinSpeedProfile = (input: unknown): SpinSpeedProfile => {
  if (input === "cinematic" || input === "balanced" || input === "rapid") {
    return input;
  }
  return fallbackSettings.spinSpeedProfile;
};

export const sanitizeSettings = (input: StoredSettings | null): StoredSettings => {
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

export const sanitizeSteamImport = (input: StoredSteamImport | null): StoredSteamImport => {
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

export const sanitizeExclusions = (input: StoredExclusions | null): StoredExclusions => {
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

export const sanitizeNotificationSettings = (input: StoredNotificationSettings | null): StoredNotificationSettings => {
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

export const sanitizeCloudSync = (input: StoredCloudSync | null): StoredCloudSync => {
  if (!input) return fallbackCloudSync;
  const parsed = storedCloudSyncSchema.safeParse(input);
  if (!parsed.success) return fallbackCloudSync;
  return {
    provider: "githubGist",
    gistId: parsed.data.gistId.trim(),
    gistToken: parsed.data.gistToken.trim(),
  };
};

export const sanitizeThemeMode = (input: ThemeMode | null): ThemeMode => {
  if (input === "light" || input === "dark" || input === "high-contrast" || input === "system") {
    return input;
  }
  return "system";
};

export const sanitizeCloudRestorePoints = (input: CloudRestorePoint[] | null): CloudRestorePoint[] => {
  if (!input) return [];
  const parsed = cloudRestorePointsSchema.safeParse(input);
  if (!parsed.success) return [];
  return parsed.data.slice(0, MAX_CLOUD_RESTORE_POINTS);
};

export const sanitizeAccountProfiles = (input: AccountProfilePreset[] | null): AccountProfilePreset[] => {
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
