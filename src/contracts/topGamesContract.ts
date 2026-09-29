import { z } from "zod";

export const topGameSourceIds = ["steamcharts", "steamdb", "twitchmetrics", "itchio"] as const;
export const topGameSourceSchema = z.enum(topGameSourceIds);
export const sourceIdSchema = z.enum([...topGameSourceIds, "manual", "scan", "steamImport"]);

export const gamePlatformSchema = z.enum(["windows", "mac", "linux"]);
export const gameLengthSchema = z.enum(["short", "medium", "long"]);
export const gamePriceSchema = z.object({
  amount: z.number().finite().nonnegative(),
  currency: z.string().regex(/^[A-Z]{3}$/),
}).strict();
export const gameLengthEstimateSchema = z.object({
  value: gameLengthSchema,
  method: z.enum(["genreHeuristic", "provider", "user"]),
  confidence: z.enum(["low", "medium", "high"]),
}).strict();

export const gameMetadataSchema = z.object({
  name: z.string(),
  rank: z.number().optional(),
  score: z.number().optional(),
  appId: z.number().optional(),
  providerId: z.string().min(1).optional(),
  url: z.string().optional(),
  platforms: z.array(gamePlatformSchema).optional(),
  tags: z.array(z.string()).optional(),
  releaseDate: z.string().optional(),
  priceUsd: z.number().optional(),
  price: gamePriceSchema.optional(),
  isFree: z.boolean().optional(),
  estimatedLength: gameLengthSchema.optional(),
  lengthEstimate: gameLengthEstimateSchema.optional(),
  metadataObservedAt: z.string().optional(),
});

export const topGamesGameSchema = gameMetadataSchema.extend({
  source: topGameSourceSchema,
});

export const sourcePayloadSchema = z.object({
  id: topGameSourceSchema,
  label: z.string(),
  fetchedAt: z.string(),
  note: z.string().optional(),
  games: z.array(topGamesGameSchema),
});

export const topGamesPayloadSchema = z.object({
  schemaVersion: z.literal(1).optional(),
  generatedAt: z.string(),
  sources: z.object({
    steamcharts: sourcePayloadSchema.extend({ id: z.literal("steamcharts") }),
    steamdb: sourcePayloadSchema.extend({ id: z.literal("steamdb") }),
    twitchmetrics: sourcePayloadSchema.extend({ id: z.literal("twitchmetrics") }),
    itchio: sourcePayloadSchema.extend({ id: z.literal("itchio") }),
  }),
});

export type TopGameSourceId = z.infer<typeof topGameSourceSchema>;
export type GamePlatform = z.infer<typeof gamePlatformSchema>;
export type GameLength = z.infer<typeof gameLengthSchema>;
export type GamePrice = z.infer<typeof gamePriceSchema>;
export type GameLengthEstimate = z.infer<typeof gameLengthEstimateSchema>;
export type ContractGameMetadata = z.infer<typeof gameMetadataSchema>;
export type TopGamesGameEntry = z.infer<typeof topGamesGameSchema>;
export type SourcePayloadContract = z.infer<typeof sourcePayloadSchema>;
export type TopGamesPayloadContract = z.infer<typeof topGamesPayloadSchema>;
