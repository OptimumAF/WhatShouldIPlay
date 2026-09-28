import assert from "node:assert/strict";
import test from "node:test";
import { fallbackExclusions, migrateLegacyManualExclusions, sanitizeExclusions } from "../../src/lib/appConfig";
import { attachLegacyManualHistoryIds, reconcileManualNames, sanitizeManualRecords } from "../../src/lib/manualIdentity";

test("manual records keep IDs across rename and preserve equal display names as separate records", () => {
  const original = [
    { id: "manual:one", name: "Echo Harbor" },
    { id: "manual:two", name: "Echo Harbor" },
  ];
  assert.deepEqual(sanitizeManualRecords(original, []), original);
  const renamed = reconcileManualNames(original, ["Echo Harbor", "Echo Harbor", "Third Name"]);
  assert.deepEqual(renamed.slice(0, 2), original);
  assert.match(renamed[2].id, /^manual:/);
  assert.notEqual(renamed[2].id, original[0].id);
  assert.notEqual(renamed[2].id, original[1].id);
  const collision = sanitizeManualRecords([
    { id: "manual:one", name: "First" },
    { id: "manual:one", name: "Second" },
  ], []);
  assert.equal(collision.length, 2);
  assert.notEqual(collision[0].id, collision[1].id);
});

test("legacy name status remains available while a unique manual ID is attached", () => {
  const manual = [{ id: "manual:one", name: "Same Title" }];
  const legacy = {
    ...fallbackExclusions,
    playedGames: ["Same Title"],
    completedGames: ["Finished Title"],
  };
  const migrated = migrateLegacyManualExclusions(legacy, manual, {
    playedGames: legacy.playedGames,
    completedGames: legacy.completedGames,
  });
  assert.deepEqual(migrated.playedGames, ["Same Title"]);
  assert.deepEqual(migrated.completedGames, ["Finished Title"]);
  assert.deepEqual(migrated.playedRecords, [{ id: "manual:one", name: "Same Title" }]);
  assert.deepEqual(sanitizeExclusions(migrated), migrated);
  assert.deepEqual(attachLegacyManualHistoryIds([
    { name: "Same Title", sources: ["manual"] },
  ], manual), [{ id: "manual:one", name: "Same Title", sources: ["manual"] }]);
});

test("ambiguous legacy titles remain name-only and are not assigned to one manual record", () => {
  const manual = [
    { id: "manual:one", name: "Same Title" },
    { id: "manual:two", name: "Same Title" },
  ];
  const migrated = migrateLegacyManualExclusions({ ...fallbackExclusions, playedGames: ["Same Title"] }, manual, {
    playedGames: ["Same Title"],
  });
  assert.deepEqual(migrated.playedGames, ["Same Title"]);
  assert.deepEqual(migrated.playedRecords, []);
  assert.deepEqual(attachLegacyManualHistoryIds([
    { name: "Same Title", sources: ["manual"] },
  ], manual), [{ name: "Same Title", sources: ["manual"] }]);
});

test("a cleared ID rule stays cleared on reload while its legacy name rule remains", () => {
  const manual = [{ id: "manual:one", name: "Same Title" }];
  const modern = { ...fallbackExclusions, playedGames: ["Same Title"], playedRecords: [] };
  const reopened = migrateLegacyManualExclusions(sanitizeExclusions(modern), manual, modern);
  assert.deepEqual(reopened.playedGames, ["Same Title"]);
  assert.deepEqual(reopened.playedRecords, []);
});
