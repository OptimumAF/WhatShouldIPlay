export type SourceId = "steamcharts" | "steamdb" | "twitchmetrics" | "manual" | "scan" | "steamImport";
export type GamePlatform = "windows" | "mac" | "linux";
export type GameLength = "short" | "medium" | "long";

export interface GameEntry {
  name: string;
  source: SourceId;
  rank?: number;
  score?: number;
  appId?: number;
  url?: string;
  platforms?: GamePlatform[];
  tags?: string[];
  releaseDate?: string;
  priceUsd?: number;
  isFree?: boolean;
  estimatedLength?: GameLength;
}

export interface SourcePayload {
  id: "steamcharts" | "steamdb" | "twitchmetrics";
  label: string;
  fetchedAt: string;
  note?: string;
  games: GameEntry[];
}

export interface TopGamesPayload {
  generatedAt: string;
  sources: Record<"steamcharts" | "steamdb" | "twitchmetrics", SourcePayload>;
}
