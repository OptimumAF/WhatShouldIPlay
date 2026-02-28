export type SourceId = "steamcharts" | "steamdb" | "twitchmetrics" | "manual" | "scan" | "steamImport";

export interface GameEntry {
  name: string;
  source: SourceId;
  rank?: number;
  score?: number;
  appId?: number;
  url?: string;
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
