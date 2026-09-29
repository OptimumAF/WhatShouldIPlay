import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import test from "node:test";
import { run } from "../../scripts/fetch-top-games.mjs";
import {
  createVersionedPayload,
  mapSteamAppMetadata,
  parseItchioTopRated,
  sanitizeCachedSource,
} from "../../scripts/lib/feedMetadata.mjs";
import { topGamesPayloadSchema } from "../../src/contracts/topGamesContract";

const fixture = (name: string): any => JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), "utf8"));
const steam = fixture("producer-steam-apps.json");
const itchHtml = readFileSync(new URL("../fixtures/producer-itchio.html", import.meta.url), "utf8");
const observedAt = "2026-01-02T03:00:00.000Z";

test("Steam metadata preserves USD and EUR without inventing absent or unsupported prices", () => {
  const usd = mapSteamAppMetadata(steam.usdPaid, observedAt);
  const eur = mapSteamAppMetadata(steam.eurPaid, observedAt);
  const free = mapSteamAppMetadata(steam.free, observedAt);
  const missing = mapSteamAppMetadata(steam.missingPrice, observedAt);
  const unsupported = mapSteamAppMetadata(steam.unsupportedCurrency, observedAt);
  assert.deepEqual(usd.price, { amount: 12.99, currency: "USD" });
  assert.deepEqual(eur.price, { amount: 9.5, currency: "EUR" });
  assert.equal(usd.isFree, false);
  assert.equal(free.isFree, true);
  assert.equal(free.price, undefined);
  assert.equal(missing.isFree, undefined);
  assert.equal(missing.price, undefined);
  assert.equal(unsupported.price, undefined);
  assert.equal(unsupported.isFree, undefined);
  assert.equal(mapSteamAppMetadata({ ...steam.usdPaid, price_overview: {
    ...steam.usdPaid.price_overview, final_formatted: "$13.99",
  } }, observedAt).price, undefined);
  assert.deepEqual(usd.lengthEstimate, { value: "long", method: "genreHeuristic", confidence: "low" });
  assert.equal(eur.lengthEstimate, undefined);
  assert.equal(missing.lengthEstimate, undefined);
  assert.equal(usd.metadataObservedAt, observedAt);
  assert.deepEqual(usd.platforms, ["windows", "linux"]);
});

test("itch.io listing distinguishes observed minimum, free, donation, and missing price", () => {
  const games = parseItchioTopRated(itchHtml, observedAt);
  assert.equal(games.length, 5);
  assert.deepEqual(games[0].price, { amount: 4, currency: "USD" });
  assert.deepEqual(games[0].lengthEstimate, { value: "long", method: "genreHeuristic", confidence: "low" });
  assert.deepEqual(games[1].price, { amount: 9.5, currency: "EUR" });
  for (const index of [2, 3]) {
    assert.equal(games[index].price, undefined);
    assert.equal(games[index].isFree, undefined);
    assert.equal(games[index].lengthEstimate, undefined);
  }
  assert.equal(games[4].isFree, true);
  assert.equal(games[4].price, undefined);
  assert.equal(games[0].metadataObservedAt, observedAt);
});

test("version-1 producer fixture matches offline parser output and shared contract", () => {
  const sourceAt = "2026-01-02T04:00:00.000Z";
  const payload = createVersionedPayload(sourceAt, {
    steamcharts: {
      id: "steamcharts", label: "Synthetic SteamCharts", fetchedAt: "2026-01-02T01:00:00.000Z",
      games: [{ name: "USD Paid", source: "steamcharts", appId: 10101, providerId: "10101", url: "https://steamcharts.com/app/10101", ...mapSteamAppMetadata(steam.usdPaid, observedAt) }],
    },
    steamdb: {
      id: "steamdb", label: "Synthetic SteamDB", fetchedAt: "2026-01-02T02:00:00.000Z",
      games: [{ name: "EUR Paid", source: "steamdb", appId: 20202, providerId: "20202", url: "https://steamdb.info/app/20202/", ...mapSteamAppMetadata(steam.eurPaid, observedAt) }],
    },
    twitchmetrics: { id: "twitchmetrics", label: "Synthetic TwitchMetrics", fetchedAt: sourceAt, games: [] },
    itchio: { id: "itchio", label: "Synthetic itch.io", fetchedAt: observedAt, games: parseItchioTopRated(itchHtml, observedAt) },
  });
  const parsed = topGamesPayloadSchema.parse(payload);
  assert.equal(parsed.schemaVersion, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(payload)), fixture("top-games-producer-v1.json"));
});

test("cached legacy source loses unsupported price and duration certainty without changing source time", () => {
  const source = {
    id: "itchio", label: "itch.io", fetchedAt: "2025-01-01T00:00:00.000Z",
    games: [{ name: "Unverified", source: "itchio", priceUsd: 0, isFree: true, estimatedLength: "medium", url: "https://example.invalid" }],
  };
  const sanitized = sanitizeCachedSource(source, undefined);
  assert.equal(sanitized.fetchedAt, source.fetchedAt);
  assert.deepEqual(sanitized.games[0], { name: "Unverified", source: "itchio", url: "https://example.invalid" });
  assert.deepEqual(sanitizeCachedSource(source, 1), source);
});

test("producer writes a version-1 feed from offline provider responses", async () => {
  const originalFetch = globalThis.fetch;
  const requests: string[] = [];
  const steamChartsHtml = `<table id="top-games"><tbody><tr><td>1.</td><td class="game-name"><a href="/app/10101">USD Paid</a></td><td class="num">1,234</td></tr></tbody></table>`;
  const steamDbHtml = `<table class="table-products"><tbody><tr><td><a href="/app/20202/">EUR Paid</a></td><td></td><td></td><td>567</td></tr></tbody></table>`;
  const twitchHtml = `<li class="list-group-item"><h5>Twitch Only</h5><samp>200</samp><a href="/g/twitch-only"></a></li>`;
  const responses = new Map([
    ["https://steamcharts.com/top", steamChartsHtml],
    ["https://steamdb.info/charts/", steamDbHtml],
    ["https://www.twitchmetrics.net/games/popularity", twitchHtml],
    ["https://itch.io/games/top-rated", itchHtml],
  ]);
  globalThis.fetch = async (input) => {
    const url = String(input);
    requests.push(url);
    if (url.startsWith("https://store.steampowered.com/api/appdetails?")) {
      const appId = new URL(url).searchParams.get("appids");
      const data = appId === "10101" ? steam.usdPaid : appId === "20202" ? steam.eurPaid : undefined;
      if (!data) throw new Error(`Unexpected App ID: ${appId}`);
      return new Response(JSON.stringify({ [appId]: { success: true, data } }), { status: 200 });
    }
    const body = responses.get(url);
    if (body === undefined) throw new Error(`Unexpected provider URL: ${url}`);
    return new Response(body, { status: 200 });
  };
  const directory = await mkdtemp(join(tmpdir(), "wsp-feed-"));
  const destinationPath = join(directory, "top-games.json");
  try {
    await run({ destinationPath, log: () => {} });
    const emitted = topGamesPayloadSchema.parse(JSON.parse(await readFile(destinationPath, "utf8")));
    assert.equal(emitted.schemaVersion, 1);
    assert.equal(emitted.sources.steamcharts.games[0].providerId, "10101");
    assert.deepEqual(emitted.sources.steamcharts.games[0].price, { amount: 12.99, currency: "USD" });
    assert.equal(emitted.sources.steamdb.games[0].providerId, "20202");
    assert.deepEqual(emitted.sources.steamdb.games[0].price, { amount: 9.5, currency: "EUR" });
    assert.equal(emitted.sources.steamcharts.games[0].priceUsd, undefined);
    assert.equal(emitted.sources.itchio.games[2].isFree, undefined);
    assert.equal(emitted.sources.itchio.games[3].price, undefined);
    assert.equal(emitted.sources.itchio.games[0].lengthEstimate?.confidence, "low");
    assert.equal(emitted.sources.itchio.games[1].lengthEstimate, undefined);
    assert.equal(emitted.sources.itchio.games[0].metadataObservedAt, emitted.sources.itchio.fetchedAt);
    assert.ok(Date.parse(emitted.sources.steamcharts.fetchedAt) <= Date.parse(emitted.sources.steamcharts.games[0].metadataObservedAt!));
    assert.ok(requests.length >= 6);

    globalThis.fetch = async () => new Response("Unavailable", { status: 503 });
    await run({ destinationPath, log: () => {} });
    const cached = topGamesPayloadSchema.parse(JSON.parse(await readFile(destinationPath, "utf8")));
    assert.equal(cached.sources.steamcharts.fetchedAt, emitted.sources.steamcharts.fetchedAt);
    assert.deepEqual(cached.sources.steamcharts.games[0].price, { amount: 12.99, currency: "USD" });

    const legacy = JSON.parse(JSON.stringify(cached));
    delete legacy.schemaVersion;
    legacy.sources.itchio.games[2].priceUsd = 0;
    legacy.sources.itchio.games[2].isFree = true;
    legacy.sources.itchio.games[2].estimatedLength = "medium";
    await writeFile(destinationPath, JSON.stringify(legacy), "utf8");
    await run({ destinationPath, log: () => {} });
    const recovered = topGamesPayloadSchema.parse(JSON.parse(await readFile(destinationPath, "utf8")));
    assert.equal(recovered.schemaVersion, 1);
    assert.equal(recovered.sources.itchio.fetchedAt, emitted.sources.itchio.fetchedAt);
    assert.equal(recovered.sources.itchio.games[2].priceUsd, undefined);
    assert.equal(recovered.sources.itchio.games[2].isFree, undefined);
    assert.equal(recovered.sources.itchio.games[2].estimatedLength, undefined);
  } finally {
    globalThis.fetch = originalFetch;
    assert.ok(resolve(directory).startsWith(`${resolve(tmpdir())}${sep}`));
    await rm(directory, { recursive: true, force: true });
  }
});
