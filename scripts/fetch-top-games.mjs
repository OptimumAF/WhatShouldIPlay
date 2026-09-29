import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";
import { dedupeFeedGames } from "./lib/feedIdentity.mjs";
import {
  createVersionedPayload,
  mapSteamAppMetadata,
  normalizeName,
  parseItchioTopRated,
  sanitizeCachedSource,
} from "./lib/feedMetadata.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const outputPath = path.join(projectRoot, "public", "data", "top-games.json");

const TOP_N = 30;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36";
const METADATA_CONCURRENCY = 8;

const nonGameTwitchEntries = new Set([
  "Just Chatting",
  "Music",
  "Special Events",
  "IRL",
  "Pools, Hot Tubs, and Beaches",
  "ASMR",
  "Talk Shows & Podcasts",
  "Science & Technology",
  "Art",
  "Sports",
  "Makers & Crafting",
]);

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": USER_AGENT,
      accept: "text/html,application/json;q=0.9,*/*;q=0.8",
    },
  });
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }
  return response.text();
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": USER_AGENT,
      accept: "application/json;q=1,*/*;q=0.6",
    },
  });
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }
  return response.json();
}

async function fetchSteamAppMetadata(appId) {
  const data = await fetchJson(
    `https://store.steampowered.com/api/appdetails?appids=${appId}&filters=basic,genres,categories,release_date,price_overview,is_free`,
  );
  const appData = data?.[appId]?.success ? data[appId]?.data : null;
  if (!appData) return null;

  return mapSteamAppMetadata(appData, new Date().toISOString());
}

async function buildAppMetadataMap(appIds) {
  const uniqueAppIds = [...new Set(appIds.filter(Number.isFinite))];
  const map = new Map();

  for (let start = 0; start < uniqueAppIds.length; start += METADATA_CONCURRENCY) {
    const batch = uniqueAppIds.slice(start, start + METADATA_CONCURRENCY);
    await Promise.all(
      batch.map(async (appId) => {
        try {
          const metadata = await fetchSteamAppMetadata(appId);
          if (metadata) {
            map.set(appId, metadata);
          }
        } catch {
          // Skip metadata for individual apps on transient API failures.
        }
      }),
    );
  }

  return map;
}

function enrichSourceWithMetadata(source, metadataByAppId) {
  return {
    ...source,
    games: source.games.map((game) => {
      if (!game.appId) return game;
      const metadata = metadataByAppId.get(game.appId);
      return metadata ? { ...game, ...metadata } : game;
    }),
  };
}

function parseSteamCharts(html) {
  const $ = cheerio.load(html);
  const games = [];

  $("#top-games tbody tr").each((index, row) => {
    if (games.length >= TOP_N) return;
    const name = normalizeName($(row).find("td.game-name a").text());
    const rankText = normalizeName($(row).find("td").first().text()).replace(".", "");
    const currentPlayersText = normalizeName($(row).find("td.num").first().text()).replace(/,/g, "");
    const urlPath = $(row).find("td.game-name a").attr("href");
    const appId = urlPath?.match(/\/app\/(\d+)(?:\/|$)/)?.[1];
    const parsedAppId = appId && Number.isSafeInteger(Number(appId)) && Number(appId) > 0
      ? Number(appId)
      : undefined;

    if (!name) return;
    games.push({
      name,
      source: "steamcharts",
      rank: Number.parseInt(rankText, 10) || index + 1,
      score: Number.parseInt(currentPlayersText, 10) || undefined,
      appId: parsedAppId,
      providerId: parsedAppId ? String(parsedAppId) : undefined,
      url: urlPath ? `https://steamcharts.com${urlPath}` : undefined,
    });
  });

  return dedupeFeedGames(games);
}

function parseTwitchMetrics(html) {
  const $ = cheerio.load(html);
  const games = [];

  $("li.list-group-item").each((index, element) => {
    if (games.length >= TOP_N) return;
    const name = normalizeName($(element).find("h5").first().text());
    const scoreText = normalizeName($(element).find("samp").first().text()).replace(/,/g, "");
    const href = $(element).find("a[href^='/g/']").first().attr("href");
    if (!name || nonGameTwitchEntries.has(name)) return;

    games.push({
      name,
      source: "twitchmetrics",
      rank: index + 1,
      score: Number.parseInt(scoreText, 10) || undefined,
      url: href ? `https://www.twitchmetrics.net${href}` : undefined,
    });
  });

  return dedupeFeedGames(games).slice(0, TOP_N);
}

function parseSteamDbPage(html) {
  if (/cf_chl_opt|Enable JavaScript and cookies to continue|Just a moment/i.test(html)) {
    throw new Error("SteamDB blocked request with Cloudflare challenge");
  }

  const $ = cheerio.load(html);
  const games = [];
  const selectors = [
    "table.table-products tbody tr",
    "#table-apps tbody tr",
    "table tbody tr",
  ];

  for (const selector of selectors) {
    $(selector).each((index, row) => {
      if (games.length >= TOP_N) return;
      const candidate = normalizeName($(row).find("a[href*='/app/']").first().text());
      if (!candidate) return;
      const href = $(row).find("a[href*='/app/']").first().attr("href") ?? "";
      const scoreText = normalizeName($(row).find("td").eq(3).text()).replace(/,/g, "");
      const appId = href.match(/\/app\/(\d+)(?:\/|$)/)?.[1];
      const parsedAppId = appId && Number.isSafeInteger(Number(appId)) && Number(appId) > 0
        ? Number(appId)
        : undefined;
      games.push({
        name: candidate,
        source: "steamdb",
        rank: index + 1,
        score: Number.parseInt(scoreText, 10) || undefined,
        appId: parsedAppId,
        providerId: parsedAppId ? String(parsedAppId) : undefined,
        url: href ? `https://steamdb.info${href}` : undefined,
      });
    });
    if (games.length > 0) {
      break;
    }
  }

  if (games.length === 0) {
    throw new Error("SteamDB parsing selectors returned no rows");
  }

  return dedupeFeedGames(games).slice(0, TOP_N);
}

async function fetchSteamAppName(appId) {
  const url = `https://store.steampowered.com/api/appdetails?appids=${appId}&filters=basic`;
  try {
    const data = await fetchJson(url);
    if (data?.[appId]?.success && data?.[appId]?.data?.name) {
      return normalizeName(data[appId].data.name);
    }
  } catch {
    // ignore and fallback
  }
  return `App ${appId}`;
}

async function fetchSteamDbFallbackFromSteamApi() {
  const data = await fetchJson("https://api.steampowered.com/ISteamChartsService/GetMostPlayedGames/v1/");
  const ranks = data?.response?.ranks;
  if (!Array.isArray(ranks) || ranks.length === 0) {
    throw new Error("Steam API did not return ranks");
  }

  const sliced = ranks.slice(0, TOP_N);
  const ids = sliced.map((entry) => Number(entry.appid)).filter(Number.isFinite);

  const names = new Map();
  const chunks = [];
  for (let i = 0; i < ids.length; i += 6) {
    chunks.push(ids.slice(i, i + 6));
  }

  for (const chunk of chunks) {
    await Promise.all(
      chunk.map(async (appId) => {
        const name = await fetchSteamAppName(appId);
        names.set(appId, name);
      }),
    );
  }

  return sliced.map((entry, index) => ({
    name: names.get(Number(entry.appid)) ?? `App ${entry.appid}`,
    source: "steamdb",
    rank: Number(entry.rank) || index + 1,
    score: Number(entry.peak_in_game) || undefined,
    appId: Number(entry.appid),
    providerId: String(entry.appid),
    url: `https://steamdb.info/app/${entry.appid}/`,
  }));
}

async function fetchSteamDbGames() {
  try {
    const html = await fetchText("https://steamdb.info/charts/");
    const parsed = parseSteamDbPage(html);
    return {
      games: parsed,
      note: "Direct SteamDB scrape.",
    };
  } catch (error) {
    const fallback = await fetchSteamDbFallbackFromSteamApi();
    return {
      games: dedupeFeedGames(fallback).slice(0, TOP_N),
      note: `SteamDB blocked scraping; used Steam charts API fallback. (${error.message})`,
    };
  }
}

async function readExistingData(destinationPath) {
  try {
    const raw = await readFile(destinationPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function run({ destinationPath = outputPath, log = console.log } = {}) {
  const now = new Date().toISOString();
  const existing = await readExistingData(destinationPath);

  const fallbackSource = (id, label, error) => {
    const previous = existing?.sources?.[id];
    if (previous && Array.isArray(previous.games) && previous.games.length > 0) {
      return {
        ...sanitizeCachedSource(previous, existing?.schemaVersion),
        note: `Using cached data from ${previous.fetchedAt} because refresh failed: ${error.message}`,
      };
    }

    return {
      id,
      label,
      fetchedAt: now,
      note: `Refresh failed: ${error.message}`,
      games: [],
    };
  };

  let steamchartsSource;
  let steamdbSource;
  let twitchmetricsSource;
  let itchioSource;

  try {
    const steamchartsHtml = await fetchText("https://steamcharts.com/top");
    steamchartsSource = {
      id: "steamcharts",
      label: "SteamCharts",
      fetchedAt: new Date().toISOString(),
      games: parseSteamCharts(steamchartsHtml),
    };
  } catch (error) {
    steamchartsSource = fallbackSource("steamcharts", "SteamCharts", error);
  }

  try {
    const steamdbResult = await fetchSteamDbGames();
    steamdbSource = {
      id: "steamdb",
      label: "SteamDB",
      fetchedAt: new Date().toISOString(),
      note: steamdbResult.note,
      games: steamdbResult.games,
    };
  } catch (error) {
    steamdbSource = fallbackSource("steamdb", "SteamDB", error);
  }

  try {
    const twitchHtml = await fetchText("https://www.twitchmetrics.net/games/popularity");
    twitchmetricsSource = {
      id: "twitchmetrics",
      label: "TwitchMetrics",
      fetchedAt: new Date().toISOString(),
      games: parseTwitchMetrics(twitchHtml),
    };
  } catch (error) {
    twitchmetricsSource = fallbackSource("twitchmetrics", "TwitchMetrics", error);
  }

  try {
    const itchioHtml = await fetchText("https://itch.io/games/top-rated");
    const observedAt = new Date().toISOString();
    itchioSource = {
      id: "itchio",
      label: "itch.io",
      fetchedAt: observedAt,
      games: parseItchioTopRated(itchioHtml, observedAt),
    };
  } catch (error) {
    itchioSource = fallbackSource("itchio", "itch.io", error);
  }

  const appIds = [
    ...steamchartsSource.games.map((game) => game.appId),
    ...steamdbSource.games.map((game) => game.appId),
  ];
  const metadataByAppId = await buildAppMetadataMap(appIds);
  const payload = createVersionedPayload(new Date().toISOString(), {
    steamcharts: enrichSourceWithMetadata(steamchartsSource, metadataByAppId),
    steamdb: enrichSourceWithMetadata(steamdbSource, metadataByAppId),
    twitchmetrics: twitchmetricsSource,
    itchio: itchioSource,
  });

  await writeFile(destinationPath, JSON.stringify(payload, null, 2), "utf8");
  log(`Wrote ${destinationPath}`);
  return payload;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
