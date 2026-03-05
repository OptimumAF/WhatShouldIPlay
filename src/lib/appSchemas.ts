import { z } from "zod";
import {
  gameMetadataSchema,
  topGamesPayloadSchema,
} from "../contracts/topGamesContract";
import type { TopGamesPayload } from "../types";

export const payloadSchema = topGamesPayloadSchema;

export const steamOwnedSchema = z.object({
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

export const storedSteamImportSchema = z.object({
  steamApiKey: z.string().default(""),
  steamId: z.string().default(""),
  steamImportGames: z.array(gameMetadataSchema).default([]),
});

export const storedExclusionsSchema = z.object({
  excludePlayed: z.boolean().default(true),
  excludeCompleted: z.boolean().default(true),
  playedGames: z.array(z.string()).default([]),
  completedGames: z.array(z.string()).default([]),
});

export const storedNotificationSettingsSchema = z.object({
  notificationsEnabled: z.boolean().default(false),
  trendNotifications: z.boolean().default(true),
  reminderNotifications: z.boolean().default(false),
  reminderIntervalMinutes: z.number().default(120),
});

export const storedCloudSyncSchema = z.object({
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

export const cloudSyncSnapshotSchema = z.object({
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

export const cloudRestorePointsSchema = z.array(
  z.object({
    id: z.string(),
    createdAt: z.string(),
    reason: z.string(),
    snapshot: cloudSyncSnapshotSchema,
  }),
);

export const accountProfilesSchema = z.array(accountProfileSchema);

export type CloudSyncSnapshot = z.infer<typeof cloudSyncSnapshotSchema>;

export async function fetchTopGames(): Promise<TopGamesPayload> {
  const url = `${import.meta.env.BASE_URL}data/top-games.json`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Unable to load game data (${response.status})`);
  }
  const json = await response.json();
  return payloadSchema.parse(json) as TopGamesPayload;
}
