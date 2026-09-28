import type { TopGameSourceId } from "../contracts/topGamesContract";
import type { SourceId } from "../types";

const trendSourceIds: ReadonlySet<SourceId> = new Set([
  "steamcharts", "steamdb", "twitchmetrics", "itchio",
]);

/** A source reports where a game was seen; it is not itself proof of availability. */
export interface GameObservations {
  trendSources: TopGameSourceId[];
  ownership: { status: "unknown" } | { status: "observed"; source: "steamImport" };
  installation: { status: "unknown" };
}

export const observeGameSources = (sources: readonly SourceId[]): GameObservations => ({
  trendSources: [...new Set(sources.filter((source): source is TopGameSourceId => trendSourceIds.has(source)))],
  ownership: sources.includes("steamImport")
    ? { status: "observed", source: "steamImport" }
    : { status: "unknown" },
  installation: { status: "unknown" },
});
