import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { sanitizeCloudRestorePoints } from "../../src/lib/appConfig";
import { cloudSyncSnapshotSchema } from "../../src/lib/appSchemas";
import { createSyncGist, updateSyncGist } from "../../src/lib/cloudSyncClient";
import { serializePortableSnapshot } from "../../src/lib/portableSnapshot";

const STEAM_CANARY = "synthetic-steam-key-never-export";
const GIST_CANARY = "synthetic-gist-token-never-export";

const legacySnapshot = (): unknown =>
  JSON.parse(readFileSync(new URL("../fixtures/legacy-snapshot.json", import.meta.url), "utf8"));

const assertCredentialFree = (value: unknown) => {
  const serialized = JSON.stringify(value);
  assert.equal(serialized.includes(STEAM_CANARY), false);
  assert.equal(serialized.includes(GIST_CANARY), false);
};

test("legacy snapshot parsing keeps game data and drops credential fields recursively", () => {
  const parsed = cloudSyncSnapshotSchema.parse(legacySnapshot());
  assertCredentialFree(parsed);
  assert.deepEqual(parsed.manualGames, ["Synthetic Game"]);
  assert.equal(parsed.settings?.weightedMode, false);
  assert.equal(parsed.steamImport?.steamId, "synthetic-steam-id");
  assert.equal(parsed.steamImport?.steamImportGames[0]?.appId, 42);
  assert.equal(parsed.profiles?.items[0]?.settings.weightedMode, true);
});

test("portable snapshots retain manual identity while excluding credentials and unexpected fields", () => {
  const snapshot = serializePortableSnapshot({
    version: 1,
    manualGames: ["Renamed Game"],
    manualRecords: [{ id: "manual:synthetic-one", name: "Renamed Game", gistToken: GIST_CANARY }],
    spinHistory: [{ id: "manual:synthetic-one", name: "Old Game", sources: ["manual"], odds: 1,
      spunAt: "2026-01-01T00:00:00.000Z", steamApiKey: STEAM_CANARY }],
    exclusions: {
      excludePlayed: true, excludeCompleted: true,
      playedGames: ["Old Game"], completedGames: [],
      playedRecords: [{ id: "manual:synthetic-one", name: "Renamed Game", gistToken: GIST_CANARY }],
      completedRecords: [],
    },
    steamImport: { steamId: "synthetic-id", steamImportGames: [], steamApiKey: STEAM_CANARY },
  });
  assertCredentialFree(snapshot);
  assert.deepEqual(snapshot.manualRecords, [{ id: "manual:synthetic-one", name: "Renamed Game" }]);
  assert.equal(snapshot.spinHistory?.[0]?.id, "manual:synthetic-one");
  assert.deepEqual(snapshot.exclusions?.playedRecords, [{ id: "manual:synthetic-one", name: "Renamed Game" }]);
  assert.deepEqual(cloudSyncSnapshotSchema.parse(snapshot), snapshot);
});

test("Gist create and update strip credentials at the outgoing transport boundary", async () => {
  const requests: Array<{ method: string; body: unknown }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    requests.push({ method: init?.method ?? "GET", body: JSON.parse(String(init?.body)) });
    return new Response(JSON.stringify({ id: "synthetic-gist-id" }), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  };
  try {
    await createSyncGist({ token: "synthetic-auth-only", snapshot: legacySnapshot() });
    await updateSyncGist({
      gistId: "synthetic-gist-id",
      token: "synthetic-auth-only",
      snapshot: legacySnapshot(),
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.deepEqual(requests.map(({ method }) => method), ["POST", "PATCH"]);
  for (const request of requests) {
    assertCredentialFree(request.body);
    const content = (request.body as { files: Record<string, { content: string }> }).files[
      "whatshouldiplay-sync.json"
    ].content;
    const snapshot = JSON.parse(content);
    assertCredentialFree(snapshot);
    assert.deepEqual(snapshot.manualGames, ["Synthetic Game"]);
    assert.equal(snapshot.steamImport.steamImportGames[0].appId, 42);
  }
});

test("legacy local restore points are sanitized without losing the library", () => {
  const points = sanitizeCloudRestorePoints([
    {
      id: "synthetic-point",
      createdAt: "2026-09-28T00:00:00.000Z",
      reason: "synthetic test",
      snapshot: legacySnapshot(),
    },
  ]);
  assert.equal(points.length, 1);
  assertCredentialFree(points);
  assert.deepEqual(points[0].snapshot.manualGames, ["Synthetic Game"]);
  assert.equal(points[0].snapshot.steamImport?.steamImportGames[0]?.appId, 42);
});
