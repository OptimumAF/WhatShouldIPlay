# Verification log

Record actual checks against the committed dataset and note environmental limits. A passing build alone does not complete a user journey.

## 2026-09-28 — Baseline and plan adoption

**Task:** M00.01 (DONE), M00.02 (VERIFY)  
**Base commit:** `3278b2a2ad100790a33368bafe93c1e97bc5e1d0`  
**Branch:** `codex/continuation-hardening`  
**Environment:** Windows, Node 23.10.0, npm 11.2.0, Cargo 1.93.1, rustc 1.93.1. This is the available local toolchain; a supported pinned Node version is still an M00.04 task.

- `gh repo view OptimumAF/WhatShouldIPlay --json nameWithOwner,url,defaultBranchRef`: confirmed repository and `master` default branch.
- `git remote -v`, `git status --short --branch`, `git rev-parse HEAD`: verified `origin` points to `OptimumAF/WhatShouldIPlay`, clean checkout before edits, and base SHA above. No repository `AGENTS.md` or existing execution plan was found. The supplied plan was copied to its canonical path and the roadmap now links it. No unrelated files were present.
- `npm ci`: passed; installed 126 packages. npm reported 9 audit findings (2 low, 1 moderate, 6 high); dependency audit is open under M10.04.
- `npm run typecheck`: passed.
- `npm run build`: passed with the committed `public/data/top-games.json`; no live data refresh was run.
- `npm run test:e2e:ci`: **1 passed, 3 failed** of 4 Chromium tests on the unchanged source. The manual-library add test passed. The spin test found the winner card but then looked for history in a panel that is now on the History tab. Two settings tests looked for controls immediately after opening Settings, while the UI now groups controls under settings tabs. These are pre-existing test/UI mismatches at the base SHA, not failures introduced by this branch. Screenshots and traces are local ignored test artifacts.
- `cargo fmt --manifest-path apps/desktop/Cargo.toml --check`: failed on pre-existing formatting differences in `data.rs`, `engine.rs`, `main.rs`, and `ui/mod.rs`; no formatting changes made.
- `cargo check --manifest-path apps/desktop/Cargo.toml`: passed. Cargo generated an ignored `apps/desktop/Cargo.lock`; lockfile policy and committing it remain M00.04 work.
- `cargo test --manifest-path apps/desktop/Cargo.toml`: passed with **0 tests**. This confirms compilation only; engine behavior remains untested.

**Still to check for M00.02:** fresh-profile manual-game spin, repeat spin, settings persistence, desktop startup, and any available platform-specific behavior. Existing E2E tests require updating to match the current tab structure, with product behavior verified separately.

## 2026-09-28 — M01.01 portable snapshot boundary

**Task:** M01.01 (DONE); M00.04 unit harness (partial)  
**Implementation:** `src/lib/appSchemas.ts`, `src/lib/portableSnapshot.ts`, `src/lib/cloudSyncClient.ts`, the cloud snapshot/apply hooks, `tests/unit/portable-snapshot.test.ts`, and `tests/e2e/credential-snapshot.spec.ts`. Commit recorded in branch history.  
**Acceptance checked:** Legacy Steam keys and synthetic future token fields disappear from parsed snapshots, outgoing Gist create/update JSON, and persisted local restore points, including nested profile/settings/history/game objects. Manual games, Steam ID, App ID, and supported settings survive. Applying a portable snapshot no longer sets the local Steam key. Existing file export and sharing flows were absent on code inspection; M05.05 must use the same serializer when implemented.

- `npm run test:unit` before the fix: **3 failed / 3**, each on a synthetic credential canary leaking through the old schema or outgoing body.
- `npm run test:unit` after the fix: **3 passed / 3**.
- `npm run typecheck`: passed.
- `npm run build`: passed with the committed dataset.
- `npx playwright test tests/e2e/credential-snapshot.spec.ts --project=chromium`: **1 passed / 1** after correcting a test-only navigation wait. It seeded an old restore point and inspected the application's intercepted `PATCH` payload in Chromium.

**Limits:** GitHub was intercepted with synthetic credentials; this establishes the payload sent at the browser boundary, not successful live Gist sync. Live transport and disclosure remain M01.03/M07. Browser local Steam-key retention and historical remote revisions remain M01.02/M01.03. The three pre-existing Chromium failures recorded above are unresolved. Node pinning and a committed Cargo lockfile remain M00.04.
