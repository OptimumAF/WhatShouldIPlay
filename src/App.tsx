import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { useTranslation } from "react-i18next";
import { normalizeGames } from "./lib/wheel";
import { formatOdds, getFocusableElements, keepFocusInContainer, readStorage } from "./lib/appUtils";
import {
  cloudSyncSnapshotSchema,
  fetchTopGames,
  steamOwnedSchema,
  type CloudSyncSnapshot,
} from "./lib/appSchemas";
import {
  defaultFilters,
  defaultSourceWeights,
  gameWeight,
  modePresetTranslationKeys,
  modePresets,
  onboardingSteps,
  sanitizeAccountProfiles,
  sanitizeCloudRestorePoints,
  sanitizeCloudSync,
  sanitizeExclusions,
  sanitizeFilters,
  sanitizeNotificationSettings,
  sanitizeSettings,
  sanitizeSteamImport,
  sanitizeThemeMode,
  sourceKeys,
  sourceLabelList,
  sourceLabels,
  spinSpeedProfiles,
  type AccountProfilePreset,
  type AdvancedFilters,
  type BeforeInstallPromptEvent,
  type CloudRestorePoint,
  type EnabledSources,
  type LengthFilter,
  type PlatformFilter,
  type PoolGame,
  type ScreenReaderAnnouncement,
  type SourceToggleKey,
  type SourceWeights,
  type SpinHistoryItem,
  type SpinSpeedProfile,
  type StoredCloudSync,
  type StoredExclusions,
  type StoredNotificationSettings,
  type StoredSettings,
  type StoredSteamImport,
  type ThemeMode,
  type ToastMessage,
  type WorkspaceTab,
} from "./lib/appConfig";
import { useCloudSyncTransport } from "./hooks/useCloudSyncTransport";
import { useCloudProfileActions } from "./hooks/useCloudProfileActions";
import { useCloudSnapshotBuilders } from "./hooks/useCloudSnapshotBuilders";
import { useApplyCloudSnapshot } from "./hooks/useApplyCloudSnapshot";
import { useCloudPanelData } from "./hooks/useCloudPanelData";
import { useStoredSettingsState } from "./hooks/useStoredSettingsState";
import { useSpinController } from "./hooks/useSpinController";
import { useLibraryActions } from "./hooks/useLibraryActions";
import { useRuntimeActions } from "./hooks/useRuntimeActions";
import { useWorkspaceLayout } from "./hooks/useWorkspaceLayout";
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
import type { GameEntry, SourceId } from "./types";


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

  const {
    rotation,
    spinning,
    winner,
    winnerMeta,
    showWinnerPopup,
    winnerPulse,
    spinHistory,
    setShowWinnerPopup,
    setSpinHistory,
    spin,
    onSpinEnd,
    clearHistory,
  } = useSpinController<SourceId>({
    initialHistory,
    onWinnerResolved: (selectedWinner, meta) => {
      announceForScreenReader(
        "success",
        `Winner selected: ${selectedWinner}. Odds ${formatOdds(meta.odds)}. Sources ${sourceLabelList(meta.sources)}.`,
      );
    },
  });
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

  const parseSteamOwnedGames = useCallback(
    (raw: unknown) => steamOwnedSchema.parse(raw).response.games ?? [],
    [],
  );

  const {
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
  } = useLibraryActions<EnabledSources, SourceWeights>({
    normalizeGames,
    t,
    pushToast,
    parseOwnedGames: parseSteamOwnedGames,
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
  });
  const { handleInstall, applyServiceWorkerUpdate, setNotificationsEnabledWithPermission } = useRuntimeActions({
    installPrompt,
    skipWaitingMessageType: SW_SKIP_WAITING_MESSAGE,
    clearInstallPrompt: () => setInstallPrompt(null),
    setUpdateInProgress,
    setSwUpdateReady,
    setNotificationsEnabled,
    setNotificationStatus,
    t,
  });

  const { currentSettingsSnapshot, applyStoredSettings } = useStoredSettingsState<
    EnabledSources,
    SourceWeights,
    SpinSpeedProfile,
    AdvancedFilters
  >({
    enabledSources,
    sourceWeights,
    weightedMode,
    adaptiveRecommendations,
    cooldownSpins,
    spinSpeedProfile,
    reducedSpinAnimation,
    activePreset,
    filters,
    sanitizeFilters: (value) => sanitizeFilters(value),
    setEnabledSources,
    setSourceWeights,
    setWeightedMode,
    setAdaptiveRecommendations,
    setCooldownSpins,
    setSpinSpeedProfile,
    setReducedSpinAnimation,
    setActivePreset,
    setFilters,
  });

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

  const mapSnapshotSpinHistory = useCallback(
    (entries: Array<{ sources: string[] } & Record<string, unknown>>): SpinHistoryItem[] =>
      entries.map(
        (entry) =>
          ({
            ...entry,
            sources: entry.sources as SourceId[],
          }) as SpinHistoryItem,
      ),
    [],
  );
  const safeParseCloudSnapshot = useCallback(
    (raw: unknown) => cloudSyncSnapshotSchema.safeParse(raw) as { success: true; data: CloudSyncSnapshot } | { success: false },
    [],
  );
  const clearPendingCloudConflict = useCallback(() => {
    setPendingCloudConflictSnapshot(null);
  }, []);

  const { applyCloudSnapshot } = useApplyCloudSnapshot<
    StoredSettings,
    SpinHistoryItem,
    GameEntry,
    StoredSteamImport,
    StoredExclusions,
    StoredNotificationSettings,
    AccountProfilePreset
  >({
    safeParseSnapshot: safeParseCloudSnapshot,
    invalidSnapshotMessage: t("messages.cloudSnapshotInvalid"),
    sanitizeSettings: (raw) => sanitizeSettings(raw as StoredSettings | null),
    applyStoredSettings,
    mapSpinHistory: mapSnapshotSpinHistory,
    setSpinHistory,
    normalizeManualGames: normalizeGames,
    setManualGames,
    sanitizeSteamImport: (raw) => sanitizeSteamImport(raw as StoredSteamImport | null),
    setSteamApiKey,
    setSteamId,
    setSteamImportGames,
    sanitizeExclusions: (raw) => sanitizeExclusions(raw as StoredExclusions | null),
    setExcludePlayed,
    setExcludeCompleted,
    setPlayedGames,
    setCompletedGames,
    sanitizeNotifications: (raw) => sanitizeNotificationSettings(raw as StoredNotificationSettings | null),
    setNotificationsEnabled,
    setTrendNotifications,
    setReminderNotifications,
    setReminderIntervalMinutes,
    sanitizeAccountProfiles: (raw) => sanitizeAccountProfiles(raw as AccountProfilePreset[] | null),
    setAccountProfiles,
    setActiveAccountProfileId,
    setCloudSyncReferenceAt,
    clearPendingCloudConflict,
  });

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
  const handleSpin = () => {
    spin({
      activePool,
      weightedMode,
      adaptiveRecommendations,
      adaptivePoolWeights,
      spinMotion,
      fallbackDurationMs: effectiveSpinDurationMs,
    });
  };
  const {
    showSettingsPane,
    showPlayPane,
    showLibraryPane,
    showHistoryPane,
    settingsSidebarVisible,
    settingsSheetMode,
    settingsTabActive,
    historyDisplayItems,
  } = useWorkspaceLayout<SourceId, WorkspaceTab>({
    activeTab,
    settingsTabValue: "settings",
    playTabValue: "play",
    libraryTabValue: "library",
    historyTabValue: "history",
    isMobileLayout,
    sidebarOpen,
    spinHistory,
    sourceLabelList,
    formatOdds,
  });
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
  const {
    cloudProfileOptions,
    cloudReferenceLabel,
    cloudConflict,
    cloudRestorePointOptions,
    onRestorePoint,
    onClearRestorePoints,
  } = useCloudPanelData<AccountProfilePreset, CloudSyncSnapshot, CloudRestorePoint>({
    accountProfiles,
    cloudSyncReferenceAt,
    pendingCloudConflictSnapshot,
    cloudRestorePoints,
    restoreFromCloudPoint,
    setCloudRestorePoints,
    t,
    pushToast,
  });
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
                onRestorePoint={onRestorePoint}
                onClearRestorePoints={onClearRestorePoints}
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
