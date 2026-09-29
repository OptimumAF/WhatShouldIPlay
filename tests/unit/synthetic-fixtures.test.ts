import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { topGamesPayloadSchema } from "../../src/contracts/topGamesContract";
import { defaultEnabledSources, defaultFilters, defaultSourceWeights, type PoolGame } from "../../src/lib/appConfig";
import { useGamePoolData } from "../../src/hooks/useGamePoolData";
import { pickSpinWithWeights } from "../../src/lib/wheel";

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), "utf8"));

test("synthetic feed preserves same-provider observations and distinct same-title IDs", () => {
  const feed = topGamesPayloadSchema.parse(fixture("top-games-identity.json"));
  assert.equal(feed.schemaVersion, undefined);
  const observations = [...feed.sources.steamcharts.games, ...feed.sources.steamdb.games];
  assert.deepEqual(observations.map((game) => game.appId), [10101, 10101, 20202]);
  assert.equal(new Set(observations.map((game) => game.appId)).size, 2);
  assert.match(feed.sources.twitchmetrics.note ?? "", /fetch failure/);
  assert.equal(feed.sources.twitchmetrics.games[0].priceUsd, undefined);
  assert.equal(feed.sources.itchio.games[0].isFree, undefined);
});

test("versioned metadata fixture retains currency, timestamps, estimate provenance, and unknown values", () => {
  const feed = topGamesPayloadSchema.parse(fixture("top-games-metadata-v1.json"));
  const game = feed.sources.steamcharts.games[0];
  assert.equal(feed.schemaVersion, 1);
  assert.equal(feed.sources.steamcharts.fetchedAt, "2026-01-01T12:00:00.000Z");
  assert.equal(game.appId, 10101);
  assert.equal(game.providerId, "10101");
  assert.equal(game.url, "https://example.invalid/games/echo-harbor");
  assert.deepEqual(game.platforms, ["windows", "linux"]);
  assert.deepEqual(game.price, { amount: 19.99, currency: "EUR" });
  assert.deepEqual(game.lengthEstimate, {
    value: "long", method: "genreHeuristic", confidence: "low",
  });
  assert.equal(game.metadataObservedAt, "2026-01-01T11:30:00.000Z");
  assert.equal(feed.sources.itchio.games[0].price, undefined);
  assert.equal(feed.sources.itchio.games[0].isFree, undefined);

  const unsupported = fixture("top-games-metadata-v1.json") as Record<string, unknown>;
  unsupported.schemaVersion = 99;
  assert.throws(() => topGamesPayloadSchema.parse(unsupported), /schemaVersion|expected 1/i);

  const wrongCurrency = fixture("top-games-metadata-v1.json") as {
    sources: { steamcharts: { games: Array<{ price: { amount: number; currency: string } }> } };
  };
  wrongCurrency.sources.steamcharts.games[0].price.currency = "eur";
  assert.equal(topGamesPayloadSchema.safeParse(wrongCurrency).success, false);
  wrongCurrency.sources.steamcharts.games[0].price.currency = "EUR";
  wrongCurrency.sources.steamcharts.games[0].price.amount = -1;
  assert.equal(topGamesPayloadSchema.safeParse(wrongCurrency).success, false);
});

test("web pool keeps versioned feed metadata and does not treat EUR as USD", () => {
  const raw = fixture("top-games-metadata-v1.json") as {
    sources: {
      steamcharts: { games: Array<{ priceUsd?: number; price: { amount: number; currency: string } }> };
      steamdb: { games: Array<{ price?: { amount: number; currency: string } }> };
    };
  };
  raw.sources.steamcharts.games[0].priceUsd = 19.99;
  let feed = topGamesPayloadSchema.parse(raw);
  let selected: PoolGame | undefined;
  let filtered = false;
  let filters = defaultFilters;
  function Probe() {
    const result = useGamePoolData({
      topGames: feed,
      manualRecords: [],
      steamImportGames: [],
      enabledSources: defaultEnabledSources,
      sourceWeights: defaultSourceWeights,
      weightedMode: false,
      playedGames: [],
      completedGames: [],
      playedRecords: [],
      completedRecords: [],
      spinHistory: [],
      adaptiveRecommendations: false,
      filters,
      setFilters: () => {},
      excludePlayed: false,
      excludeCompleted: false,
      cooldownSpins: 0,
    });
    selected = result.activePool.find((game) => game.appId === 10101);
    filtered = !result.activePool.some((game) => game.appId === 10101);
    return null;
  }
  renderToStaticMarkup(createElement(Probe));
  assert.ok(selected);
  assert.equal(selected.providerId, "10101");
  assert.equal(selected.url, "https://example.invalid/games/echo-harbor");
  assert.deepEqual(selected.platforms, ["windows", "linux", "mac"]);
  assert.deepEqual(selected.tags, ["Puzzle"]);
  assert.equal(selected.releaseDate, "2025-12-01");
  assert.equal(selected.isFree, false);
  assert.deepEqual(selected.price, { amount: 19.99, currency: "EUR" });
  assert.equal(selected.priceUsd, undefined);
  assert.deepEqual(selected.lengthEstimate, {
    value: "long", method: "genreHeuristic", confidence: "low",
  });
  assert.equal(selected.metadataObservedAt, "2026-01-01T11:30:00.000Z");
  assert.deepEqual(selected.sourceObservations.map(({ source, fetchedAt }) => ({ source, fetchedAt })), [
    { source: "steamcharts", fetchedAt: "2026-01-01T12:00:00.000Z" },
    { source: "steamdb", fetchedAt: "2026-01-01T13:00:00.000Z" },
  ]);
  assert.equal(selected.sourceObservations[0].providerId, "10101");
  assert.equal(selected.sourceObservations[1].providerId, "steamdb-10101");
  assert.deepEqual(selected.sourceObservations[0].price, { amount: 19.99, currency: "EUR" });
  assert.deepEqual(selected.sourceObservations[0].lengthEstimate, {
    value: "long", method: "genreHeuristic", confidence: "low",
  });
  assert.deepEqual(selected.sourceObservations[1].platforms, ["mac"]);
  filters = { ...defaultFilters, maxPriceUsd: 25 };
  renderToStaticMarkup(createElement(Probe));
  assert.equal(filtered, true);

  raw.sources.steamcharts.games[0].price = { amount: 19.99, currency: "USD" };
  raw.sources.steamdb.games[0].price = { amount: 17.99, currency: "EUR" };
  feed = topGamesPayloadSchema.parse(raw);
  filters = defaultFilters;
  renderToStaticMarkup(createElement(Probe));
  assert.equal(selected?.priceUsd, undefined);
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
