import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { sanitizeSteamImport } from "../../src/lib/appConfig";

test("Steam import preserves distinct App IDs when their display names match", () => {
  const feed = JSON.parse(
    readFileSync(new URL("../fixtures/top-games-identity.json", import.meta.url), "utf8"),
  ) as { sources: { steamdb: { games: Array<{ name: string; appId: number }> } } };
  const imported = sanitizeSteamImport({
    steamApiKey: "",
    steamId: "synthetic-steam-id",
    steamImportGames: feed.sources.steamdb.games.map((game) => ({ ...game, source: "steamImport" as const })),
  });
  assert.deepEqual(imported.steamImportGames.map((game) => game.appId), [10101, 20202]);
});
