import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { sanitizeCloudRestorePoints } from "../../src/lib/appConfig";
import { cloudSyncSnapshotSchema } from "../../src/lib/appSchemas";
import { createSyncGist, updateSyncGist } from "../../src/lib/cloudSyncClient";

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
