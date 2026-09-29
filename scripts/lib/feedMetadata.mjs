import * as cheerio from "cheerio";
import { dedupeFeedGames } from "./feedIdentity.mjs";

const TOP_N = 30;

export function normalizeName(name) {
  return name
    .replace(/Â®/g, "®")
    .replace(/Â™/g, "™")
    .replace(/â€™/g, "’")
    .replace(/â€“/g, "–")
    .replace(/Â/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function dedupeStrings(values) {
  return [...new Set(values.filter(Boolean).map((value) => normalizeName(value)))];
}

export function parseReleaseDate(rawValue) {
  if (!rawValue || /coming soon|tba|to be announced/i.test(rawValue)) return undefined;
  const parsed = new Date(rawValue);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString().slice(0, 10);
}

export function inferLengthEstimate(tags) {
  if (!Array.isArray(tags) || tags.length === 0) return undefined;
  const joined = tags.join(" ").toLowerCase();
  const longSignals = ["rpg", "strategy", "simulation", "open world", "mmo", "grand strategy", "4x"];
  const shortSignals = ["fps", "shooter", "battle royale", "moba", "racing", "sports", "fighting", "arena"];
  const value = longSignals.some((signal) => joined.includes(signal))
    ? "long"
    : shortSignals.some((signal) => joined.includes(signal))
      ? "short"
      : undefined;
  return value ? { value, method: "genreHeuristic", confidence: "low" } : undefined;
}

function steamPrice(priceOverview) {
  // Interpret only the two-decimal storefront currencies handled here. If the
  // response includes a formatted total, reject a disagreement with `final`.
  const currency = priceOverview?.currency;
  const final = priceOverview?.final;
  if (!["USD", "EUR"].includes(currency) || !Number.isSafeInteger(final) || final < 0) {
    return undefined;
  }
  const amount = final / 100;
  const formatted = priceOverview?.final_formatted;
  if (typeof formatted === "string") {
    const text = formatted.trim();
    const match = currency === "USD"
      ? text.match(/^(?:US)?\$\s*((?:\d{1,3}(?:,\d{3})*|\d+)\.\d{2})$/i)
      : text.match(/^€\s*(\d+(?:[.,]\d{2})?)$/)
        ?? text.match(/^(\d+(?:[.,]\d{2})?)\s*€$/);
    if (!match) return undefined;
    const displayed = Number(currency === "USD" ? match[1].replace(/,/g, "") : match[1].replace(",", "."));
    if (displayed !== amount) return undefined;
  }
  return { amount, currency };
}

export function mapSteamAppMetadata(appData, observedAt) {
  if (!appData || typeof appData !== "object") return null;
  const tags = dedupeStrings([
    ...(Array.isArray(appData.genres) ? appData.genres.map((genre) => genre.description ?? "") : []),
    ...(Array.isArray(appData.categories) ? appData.categories.map((category) => category.description ?? "") : []),
  ]);
  const price = steamPrice(appData.price_overview);
  const isFree = appData.is_free === true && !(price && price.amount > 0)
    ? true
    : price && price.amount > 0 && appData.is_free !== true
      ? false
      : undefined;
  const platforms = ["windows", "mac", "linux"].filter((key) => appData.platforms?.[key] === true);
  return {
    platforms: platforms.length > 0 ? platforms : undefined,
    tags: tags.length > 0 ? tags : undefined,
    releaseDate: parseReleaseDate(appData.release_date?.date ?? ""),
    price,
    isFree,
    lengthEstimate: inferLengthEstimate(tags),
    metadataObservedAt: observedAt,
  };
}

function itchioPrice(priceText) {
  const text = normalizeName(priceText);
  if (/^free$/i.test(text)) return { isFree: true };
  const usd = text.match(/^(?:US)?\$\s*((?:\d{1,3}(?:,\d{3})*|\d+)(?:\.\d{1,2})?)$/i);
  const eur = text.match(/^€\s*(\d+(?:[.,]\d{1,2})?)$/)
    ?? text.match(/^(\d+(?:[.,]\d{1,2})?)\s*€$/);
  const amount = usd ? Number(usd[1].replace(/,/g, "")) : eur ? Number(eur[1].replace(",", ".")) : NaN;
  const currency = usd ? "USD" : eur ? "EUR" : undefined;
  if (!currency || !Number.isFinite(amount) || amount < 0) return {};
  return { price: { amount, currency }, isFree: amount === 0 };
}

export function parseItchioTopRated(html, observedAt) {
  const $ = cheerio.load(html);
  const games = [];
  $(".game_cell").each((index, element) => {
    if (games.length >= TOP_N) return;
    const name = normalizeName($(element).find(".game_title a.title").first().text());
    if (!name) return;
    const href = $(element).find(".game_title a.title").first().attr("href");
    const genre = normalizeName($(element).find(".game_genre").first().text());
    const priceText = $(element).find(".price_value").first().text();
    const ratingCountText = normalizeName($(element).find(".rating_count").first().text()).replace(/[(),]/g, "");
    const platforms = [];
    if ($(element).find(".game_platform .icon-windows8").length > 0) platforms.push("windows");
    if ($(element).find(".game_platform .icon-apple").length > 0) platforms.push("mac");
    if ($(element).find(".game_platform .icon-tux").length > 0) platforms.push("linux");
    const tags = genre ? [genre] : undefined;
    games.push({
      name,
      source: "itchio",
      rank: index + 1,
      score: Number.parseInt(ratingCountText, 10) || undefined,
      url: href?.startsWith("http") ? href : href ? `https://itch.io${href}` : undefined,
      platforms: platforms.length > 0 ? platforms : undefined,
      tags,
      ...itchioPrice(priceText),
      lengthEstimate: inferLengthEstimate(tags),
      metadataObservedAt: observedAt,
    });
  });
  return dedupeFeedGames(games).slice(0, TOP_N);
}

export function sanitizeCachedSource(source, schemaVersion) {
  if (schemaVersion === 1) return source;
  return {
    ...source,
    games: source.games.map(({ priceUsd, price, isFree, estimatedLength, lengthEstimate, metadataObservedAt, ...game }) => game),
  };
}

export function createVersionedPayload(generatedAt, sources) {
  return { schemaVersion: 1, generatedAt, sources };
}
