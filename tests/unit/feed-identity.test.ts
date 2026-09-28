import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { dedupeFeedGames } from "../../scripts/lib/feedIdentity.mjs";

const fixture = JSON.parse(readFileSync(new URL("../fixtures/top-games-identity.json", import.meta.url), "utf8"));

test("feed ingestion keeps distinct same-title App IDs and merges repeated provider IDs", () => {
  const observations = [
    ...fixture.sources.steamdb.games,
    { name: "Echo Harbor alternate spelling", appId: 10101, source: "steamdb" },
  ];
  const deduped = dedupeFeedGames(observations);
  const echoGames = deduped.filter((game: { name: string }) => game.name.toLowerCase() === "echo harbor");
  assert.deepEqual(echoGames.map((game: { appId: number }) => game.appId), [10101, 20202]);
  assert.equal(deduped.filter((game: { appId: number }) => game.appId === 10101).length, 1);
});

test("feed ingestion retains one name-only observation per normalized source title", () => {
  assert.deepEqual(dedupeFeedGames([
    { name: "  Unknown Fields Adventure " },
    { name: "unknown fields adventure" },
  ]), [{ name: "  Unknown Fields Adventure " }]);
});
