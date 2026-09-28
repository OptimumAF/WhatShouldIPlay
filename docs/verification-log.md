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

## 2026-09-28 — M01.02 legacy credential migration

**Task:** M01.02 (DONE); session-only credential state also advances M01.03.  
**Implementation:** Browser state initialization ignores old saved Steam/GitHub credentials; persistence rewrites only Steam ID/imported games and Gist ID/provider. The Cloud Sync panel and README warn that old snapshots could contain a Steam key, rotation may be appropriate, and replacing the current Gist file does not erase its revision history. No remote content is deleted by this migration.

- New Chromium local-storage test before the fix: **1 failed / 2 total**, showing the old Steam key still stored. The existing portable-payload test passed.
- `npm run typecheck`: passed after the fix.
- `npm run build`: passed with committed data.
- `npx playwright test tests/e2e/credential-snapshot.spec.ts --project=chromium`: **3 passed / 3**. Tests cover startup rewrite while preserving imported game/App ID/Steam ID/Gist ID, UI fields blank for keys, legacy Gist pull, no adoption of the remote key, subsequent credential-free push, and an intercepted GET/PATCH sequence with no DELETE. They also assert the visible revision-history notice.

**Limits:** The tests use synthetic credentials and intercepted GitHub responses. GitHub's historical revisions cannot be removed by rewriting the app's current file. No live account was used, and no claim of actual key access is made. Desktop credential persistence has not yet been audited. The adjacent “private Gist” copy remains incorrect and is the active M01.03 fix.

## 2026-09-28 — M01.03 Gist disclosure and error redaction

**Task:** M01.03 (VERIFY).  
**Implementation:** English/Spanish UI and README now describe secret Gists as unlisted and readable by anyone with the URL, state the exact categories sent to `api.github.com`, and explain session-only Steam/GitHub keys. Disconnect clears local token, Gist ID, conflict, and sync reference while preserving the library. Gist transport errors no longer echo response bodies; unexpected sync errors use generic text. Web and desktop Steam import errors no longer display arbitrary provider/HTTP error text. Desktop Steam key is a Dioxus signal initialized empty; no desktop persistence path was found in this audit.

- `npm run test:unit` before the error fix: **3 passed, 1 failed / 4**; the server-error canary appeared in the old message. After the fix: **4 passed / 4**.
- Targeted Chromium test before disclosure/disconnect implementation: **3 passed, 1 failed / 4**; the secret-Gist explanation was absent. After implementation and a test locator correction: `npx playwright test tests/e2e/credential-snapshot.spec.ts --project=chromium` **5 passed / 5**. It checks disclosure, disconnect, retained local games, and a synthetic provider error body remaining out of the UI.
- `npm run typecheck`: passed. `npm run build`: passed with committed data. `cargo check --manifest-path apps/desktop/Cargo.toml`: passed.
- `cargo run --manifest-path apps/desktop/Cargo.toml`: started on Windows; process `pick-a-game-desktop` had a responding `Dioxus App` window. It was then stopped. This is startup evidence only, not a desktop journey check.

**Limits:** No live GitHub credential was available, so upload/pull success and disconnect behavior against a real account are unverified. The browser tests intercepted GitHub and Steam API requests with synthetic values. The desktop import error UI compiled but was not exercised with a real request. M01.03 remains VERIFY. M00.02 still needs fresh-profile repeated-spin and settings-persistence checks.

## 2026-09-28 — M01.04 wheel landing

**Task:** M01.04 (DONE).
**Implementation:** Web spin selection accepts an injected random function for deterministic tests. Both clients now calculate the selected sector's absolute target orientation and advance from the current normalized orientation by whole turns plus a forward offset. The fractional profile values affect the number of whole visual turns, not the final sector. Rust exposes a pure selected-index target calculation and the desktop UI uses it.

- `npm run test:unit` before the web fix: **4 passed, 2 failed / 6**. The new cases showed a nonzero starting rotation and fractional profile landing on the wrong sector. After the fix: **6 passed / 6**. The new tests cover 1, 2, 3, 4, 5, 10, and 37 sectors; 10.5, 8, 6.4, and 2.2 revolution settings; bounded jitter samples; and repeated spins from accumulated rotations.
- Targeted Chromium pointer/result/history test with the corrected manual-only fixture against the previous build: **1 failed / 1**, with Delta under the pointer and Alpha reported as winner. The Playwright configuration serves `dist`, so the test was rerun after `npm run build` for the fix: **1 passed / 1**, checking two actual spins and the History tab.
- `npm run typecheck`: passed. `npm run build`: passed with committed data. `cargo test --manifest-path apps/desktop/Cargo.toml`: **1 passed / 1** after adding the Rust sector test. `cargo check --manifest-path apps/desktop/Cargo.toml`: passed. `git diff --check`: passed.

**Limits:** Desktop wheel rendering was not visually checked; the Rust engine test and successful wiring/compilation establish the desktop calculation. The Chromium test used a seeded profile, so fresh-profile onboarding and settings persistence remain M00.02 gaps. Spin state mutation and one-time finalization are M01.05 work.

## 2026-09-28 — M01.05 web spin lifecycle

**Task:** M01.05 (IN_PROGRESS, web portion verified).
**Implementation:** The web controller copies the eligible ordering, available entry keys/App IDs, effective weights, selected winner metadata, and motion duration into one spin operation before rotating. A synchronous ref blocks repeat entry, and finalization clears the pending operation before writing history. The wheel renders the captured labels through the completed result, and its transition handler ignores bubbled child events and other properties. The fallback uses the captured duration.

- New Chromium regressions against the pre-fix build: **2 failed / 2** after the fixture navigation wait was corrected. Adding a manual game during a spin changed the wheel labels, and a bubbled child transition ended the spin. The corrected fixture uses four manual games and a one-spin cooldown.
- `npm run typecheck`: passed. `npm run test:unit`: **6 passed / 6**. `npm run build`: passed with committed data.
- `npx playwright test tests/e2e/spin-lifecycle.spec.ts tests/e2e/wheel-landing.spec.ts --project=chromium`: **3 passed / 3** after rebuilding; the two lifecycle regressions and repeat-spin pointer/result/history check passed. A further synchronous repeat-activation test passed **3 / 3** targeted lifecycle tests, measuring one pair of random draws and one history item.

**Limits at this checkpoint:** The desktop UI still used live derived labels and had no fallback finalizer; the next chunk addresses those paths. Entry keys are provisional for manual games until M02.01 introduces persistent IDs. The web test did not use live data refresh or a real account.

## 2026-09-28 — M01.05 desktop spin lifecycle

**Task:** M01.05 (VERIFY).
**Implementation:** A desktop `SpinOperation` now copies the selected pool, effective weights, winner, labels, gradient, and transition before rotation. The Dioxus wheel renders that snapshot through the result; new settings or derived cooldown data cannot replace its labels mid-spin. A duration-based fallback and the transition handler both consume the pending operation by ID, so a duplicate or stale completion cannot write another history item. Child label/hub transition events stop propagation. A previous popup timeout cannot hide a newer spin's popup.

- `cargo check --manifest-path apps/desktop/Cargo.toml`: passed.
- `cargo test --manifest-path apps/desktop/Cargo.toml`: **2 passed / 2**. The new test mutates the original pool after snapshot creation, verifies preserved winner/weights/labels, rejects an old completion ID, consumes the matching ID once, and rejects a duplicate. The earlier varied-sector landing test also passes.
- `cargo run --manifest-path apps/desktop/Cargo.toml`: built and launched on Windows. `Get-Process pick-a-game-desktop` reported a responding `Dioxus App` main window. A temp screenshot of that window showed the masthead, pool summary, and wheel rendering; the run was then stopped.

**Limits:** The desktop startup screenshot did not exercise a spin, result, history, profile change, or fallback. No desktop automation or manual interaction has verified pointer/result/history identity. M01.05 stays unchecked. Current desktop entries have names and source lists but no persistent cross-client IDs; M02.01 owns that identity migration.
