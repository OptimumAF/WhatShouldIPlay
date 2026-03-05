import type {
  GameLength as ContractGameLength,
  GamePlatform as ContractGamePlatform,
  TopGameSourceId,
  TopGamesPayloadContract,
} from "./contracts/topGamesContract";

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
  id: TopGameSourceId;
  label: string;
  fetchedAt: string;
  note?: string;
  games: GameEntry[];
}

export interface TopGamesPayload {
  generatedAt: string;
  sources: TopGamesPayloadContract["sources"];
}

export type SourceId = TopGameSourceId | "manual" | "scan" | "steamImport";
export type GamePlatform = ContractGamePlatform;
export type GameLength = ContractGameLength;
