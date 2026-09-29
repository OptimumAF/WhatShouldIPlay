import type {
  GameLength as ContractGameLength,
  GameLengthEstimate as ContractGameLengthEstimate,
  GamePlatform as ContractGamePlatform,
  GamePrice as ContractGamePrice,
  TopGameSourceId,
  TopGamesPayloadContract,
} from "./contracts/topGamesContract";

export interface GameEntry {
  id?: string;
  name: string;
  source: SourceId;
  rank?: number;
  score?: number;
  appId?: number;
  providerId?: string;
  url?: string;
  platforms?: GamePlatform[];
  tags?: string[];
  releaseDate?: string;
  priceUsd?: number;
  price?: GamePrice;
  isFree?: boolean;
  estimatedLength?: GameLength;
  lengthEstimate?: GameLengthEstimate;
  metadataObservedAt?: string;
  sourceFetchedAt?: string;
}

export interface SourcePayload {
  id: TopGameSourceId;
  label: string;
  fetchedAt: string;
  note?: string;
  games: GameEntry[];
}

export interface TopGamesPayload {
  schemaVersion?: TopGamesPayloadContract["schemaVersion"];
  generatedAt: string;
  sources: TopGamesPayloadContract["sources"];
}

export type SourceId = TopGameSourceId | "manual" | "scan" | "steamImport";
export type GamePlatform = ContractGamePlatform;
export type GameLength = ContractGameLength;
export type GamePrice = ContractGamePrice;
export type GameLengthEstimate = ContractGameLengthEstimate;
