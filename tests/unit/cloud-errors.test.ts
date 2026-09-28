import assert from "node:assert/strict";
import test from "node:test";
import { createSyncGist, pullSyncSnapshot, updateSyncGist } from "../../src/lib/cloudSyncClient";

const ERROR_CANARY = "synthetic-secret-in-server-error";

test("GitHub error response bodies cannot appear in displayed sync errors", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(`request rejected: ${ERROR_CANARY}`, { status: 403 });
  try {
    const attempts = [
      () => createSyncGist({ token: "synthetic-auth-only", snapshot: { version: 1 } }),
      () => updateSyncGist({ gistId: "synthetic-id", token: "synthetic-auth-only", snapshot: { version: 1 } }),
      () => pullSyncSnapshot({
        gistId: "synthetic-id",
        token: "synthetic-auth-only",
        noFileError: "No file",
        emptyFileError: "Empty file",
      }),
    ];
    for (const attempt of attempts) {
      await assert.rejects(attempt, (error: Error) => {
        assert.equal(error.message.includes(ERROR_CANARY), false);
        assert.match(error.message, /403/);
        return true;
      });
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});
