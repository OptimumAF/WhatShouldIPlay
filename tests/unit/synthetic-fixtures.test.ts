import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { topGamesPayloadSchema } from "../../src/contracts/topGamesContract";
import { pickSpinWithWeights } from "../../src/lib/wheel";

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), "utf8"));

test("synthetic feed preserves same-provider observations and distinct same-title IDs", () => {
  const feed = topGamesPayloadSchema.parse(fixture("top-games-identity.json"));
  const observations = [...feed.sources.steamcharts.games, ...feed.sources.steamdb.games];
  assert.deepEqual(observations.map((game) => game.appId), [10101, 10101, 20202]);
  assert.equal(new Set(observations.map((game) => game.appId)).size, 2);
  assert.match(feed.sources.twitchmetrics.note ?? "", /fetch failure/);
  assert.equal(feed.sources.twitchmetrics.games[0].priceUsd, undefined);
  assert.equal(feed.sources.itchio.games[0].isFree, undefined);
});

test("edge fixture supplies distinct manual IDs and deterministic extreme-weight selection", () => {
  const edge = fixture("selection-edge-cases.json") as {
    manualGames: Array<{ id: string; name: string }>;
    distinctProviderKeys: string[];
    sameProviderKeyAcrossSources: string;
    unusualWeights: number[];
  };
  assert.equal(edge.manualGames[0].name, edge.manualGames[1].name);
  assert.notEqual(edge.manualGames[0].id, edge.manualGames[1].id);
  assert.deepEqual(edge.distinctProviderKeys, ["steam:10101", "steam:20202"]);
  assert.equal(edge.sameProviderKeyAcrossSources, "steam:10101");
  const result = pickSpinWithWeights(3, 90, edge.unusualWeights, { revolutions: 8, jitterRatio: 0 }, () => 0.5);
  assert.equal(result.winnerIndex, 2);
  assert.equal(Math.floor((((-result.nextRotation % 360) + 360) % 360) / 120), 2);
});
