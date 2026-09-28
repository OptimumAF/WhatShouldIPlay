import assert from "node:assert/strict";
import test from "node:test";
import { cloudSyncSnapshotSchema } from "../../src/lib/appSchemas";
import { observeGameSources } from "../../src/lib/gameObservations";

test("trend, Steam import, and installation remain separate observations", () => {
  assert.deepEqual(observeGameSources(["steamcharts", "steamdb"]), {
    trendSources: ["steamcharts", "steamdb"],
    ownership: { status: "unknown" },
    installation: { status: "unknown" },
  });
  assert.deepEqual(observeGameSources(["steamcharts", "steamImport"]), {
    trendSources: ["steamcharts"],
    ownership: { status: "observed", source: "steamImport" },
    installation: { status: "unknown" },
  });
  assert.deepEqual(observeGameSources(["manual", "scan"]), {
    trendSources: [],
    ownership: { status: "unknown" },
    installation: { status: "unknown" },
  });
});

test("portable spin history accepts canonical source IDs, not presentation labels", () => {
  const snapshot = {
    version: 1,
    spinHistory: [{
      id: "steam:10101",
      name: "Echo Harbor",
      sources: ["steamcharts", "steamImport"],
      odds: 1,
      spunAt: "2026-01-01T00:00:00.000Z",
    }],
  };
  assert.deepEqual(cloudSyncSnapshotSchema.parse(snapshot).spinHistory?.[0]?.sources,
    ["steamcharts", "steamImport"]);
  assert.equal(cloudSyncSnapshotSchema.safeParse({
    ...snapshot,
    spinHistory: [{ ...snapshot.spinHistory[0], sources: ["Steam Library"] }],
  }).success, false);
  assert.equal(cloudSyncSnapshotSchema.safeParse({
    ...snapshot,
    settings: { enabledSources: { SteamCharts: true } },
  }).success, false);
  assert.equal(cloudSyncSnapshotSchema.safeParse({
    ...snapshot,
    settings: { sourceWeights: { "Steam Library": 1.5 } },
  }).success, false);
});
