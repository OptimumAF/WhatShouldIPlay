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

## 2026-09-28 — M01.06 service-worker cache isolation

**Task:** M01.06 (DONE).
**Implementation:** Cache names now include the application and exact service-worker registration scope. Activation removes obsolete names only within that namespace. The worker handles only this app's base/index navigation, exact top-games data path, generated assets, icons, and manifest, and sends update messages only to this app's clients. Cache writes are awaited. Old unscoped `pickagame-*-v1` caches are left untouched and not reused because another registration on the same origin could own them; the scoped caches refill normally.

- `npm run test:unit` before the fix: **6 passed, 3 failed / 9**. The new failures showed deletion of a sibling cache, handling of a sibling navigation, and absence of the new scoped data cache. After the fix: **9 passed / 9**. Unit tests exercise same-origin sibling paths, scope-specific stale-cache deletion, a changed data response, and update messages limited to this app's client.
- `npm run build`: passed with committed data; the worker was copied into the preview build.
- `npx playwright test tests/e2e/service-worker-cache.spec.ts --project=chromium`: **1 passed / 1**. In a fresh browser context, it seeded a sibling sentinel cache, the old unscoped cache name, and an obsolete cache for the app scope before registration. Activation preserved the first two, deleted only the scoped obsolete name, and stored the fetched top-games response in this scope's data cache.

**Limits:** The browser test used the local preview root scope; the unit test exercised a `/WhatShouldIPlay/` deployment scope. Cross-version upgrade of an existing installed user's worker was not exercised. Retaining legacy unscoped caches may consume storage until browser eviction or user cleanup, but avoids deleting data whose owner cannot be proven.

## 2026-09-28 — M00.02 fresh profile and suite recovery

**Task:** M00.02 (VERIFY); M01.05 (additional browser journey).
**Implementation:** Updated three pre-existing Chromium assertions to navigate the current History, Rules, Advanced, and Sources tabs. Added a fresh-profile journey that completes onboarding, configures an account-free manual-only pool, spins twice, checks two history entries, reloads, and checks retained source, animation, manual-library, and history settings. The first run found a genuine repeat-spin click failure: a transformed decorative wheel label intercepted the button. Both clients' wheel CSS now ignores pointer events so the control remains clickable.

- Initial `npx playwright test tests/e2e/critical-flows.spec.ts tests/e2e/storage-migration.spec.ts --project=chromium` after tab-navigation updates: **4 passed / 4**; the untouched-base run had **1 passed, 3 failed / 4** because the old assertions targeted hidden panels.
- Fresh-profile Chromium test before the wheel pointer-events fix: **1 failed / 1** after the first spin; the second button click was intercepted by `.wheel-label`. After the CSS fix and a correction to the test's preset expectation (changing reduced motion correctly marks the preset custom): **1 passed / 1**. The test uses ordinary clicks without force.
- `cargo check --manifest-path apps/desktop/Cargo.toml`: passed after the matching decorative-wheel CSS change. No desktop repeat-spin click was exercised.

**Limits:** The unchanged base's original web checks are recorded in the baseline entry. The fresh-profile journey and desktop startup happened later on this branch, so they do not prove the same journey at the untouched base SHA. M00.02 remains unchecked. No live provider credentials or fresh data download were used.

## 2026-09-28 — M01.07 first-claim reload

**Task:** M01.07 (DONE).
**Reason and dependency:** Two full Chromium runs lost page contexts or timed out while the first service worker claimed a page. `useRuntimeEffects` reloaded on every `controllerchange`. M01.07 was added after M01.06 because the activation check made this path visible; the reload race blocked reliable M00.02 journeys and credential regression runs.
**Implementation:** The runtime effect now remembers the previous controller. Initial claim updates that reference without reloading. Replacement of an existing controller still reloads to apply a confirmed update.

- A deterministic Chromium test stubs worker registration and dispatches controller changes: before the fix, the first synthetic claim navigated twice (**1 failed / 1**); after the fix, first claim stays on the page and replacement causes one reload (**1 passed / 1**).
- `npm run build`: passed with committed data. `npx playwright test --project=chromium --workers=4`: **16 passed / 16**. `npm run test:e2e:ci` at its default ten local workers: **16 passed / 16**. Before the fix, two full-suite runs had **13 passed / 15** and **12 passed / 15**, respectively, with navigation-context resets or settings waits; those failures are not treated as passing evidence.

**Limits:** The replacement behavior was tested with synthetic controller objects, not by installing a second production worker. Full browser runs still use local preview rather than a deployed GitHub Pages scope.

## 2026-09-28 — M00.04 toolchains and lockfiles

**Task:** M00.04 (DONE).
**Implementation:** `.nvmrc` pins Node 22.23.3, and package metadata names npm 10.9.9 and the supported Node 22 range. All three web workflows read `.nvmrc`; README and development instructions now use `npm ci` and the committed dataset for ordinary builds. `ci:web` and web CI run the TypeScript unit suite. The desktop application `Cargo.lock` is tracked; desktop build jobs use `--locked`, and the bundling job first builds the binary with `--locked`. Pre-existing Rust formatting differences were normalized without changing behavior.

- The installed Vite 7.3.1 manifest requires Node `^20.19.0 || >=22.12.0`. Official Node distribution metadata showed 22.23.3 with npm 10.9.9 on the current LTS line. `npx -y -p node@22.23.3 -p npm@10.9.9 -c "node --version"` printed `v22.23.3`; the corresponding npm command printed `10.9.9`.
- `npx -y -p node@22.23.3 -p npm@10.9.9 -c "npm ci"`: passed, installed 129 packages, and reported the same 9 audit findings (2 low, 1 moderate, 6 high) tracked under M10.04.
- `npx -y -p node@22.23.3 -p npm@10.9.9 -c "npm run ci:web"`: passed typecheck, **9/9** unit tests, build from committed data, and **16/16** Chromium E2E tests.
- `cargo fmt --manifest-path apps/desktop/Cargo.toml --check`: passed after normalization. `cargo check --manifest-path apps/desktop/Cargo.toml --locked`: passed. `cargo test --manifest-path apps/desktop/Cargo.toml --locked`: **2 passed / 2**. `cargo build --manifest-path apps/desktop/Cargo.toml --locked`: passed. `cargo check --manifest-path apps/desktop/Cargo.toml --locked --features deep-shortcut-scan`: passed on Windows.

**Limits:** Local Rust verification used Windows only; macOS/Linux and the `cargo-bundle` packaging step were not run. The bundler does not expose a documented `--locked` flag, so its workflow performs a locked binary build first. The 9 npm audit findings remain M10.04 work; no dependency versions were upgraded here.

## 2026-09-28 — M00.03 capability and roadmap audit

**Task:** M00.03 (DONE).
**Implementation:** Added `docs/feature-parity.md`, mapping each README/roadmap capability to its reachable web and desktop path, current verification state, evidence, and plan gap. Replaced elapsed March–June roadmap targets with status and next dependencies, corrected README's web feed/desktop sync claims, and clarified that the desktop strategy's portable snapshot contract is still an intended interface rather than implemented client parity. No runtime behavior changed.

- `git status --short --branch` before editing: clean branch `codex/continuation-hardening`, 11 local commits ahead of `origin/master`; no unrelated work to preserve.
- `gh issue list --state all`: `[]`. `gh pr list --state all`: open product dependencies were Dependabot upgrade PRs, including Vite 8, TypeScript 6, Playwright, scraper, and Actions; no product roadmap PR was identified in the returned list. M10.04 should inspect those PRs before dependency changes.
- Workflow queries: latest queried `master` Web CI [run 23127112622](https://github.com/OptimumAF/WhatShouldIPlay/actions/runs/23127112622) failed at baseline SHA `3278b2a`; its job logs returned HTTP 410 when fetched, so the cause is unverified. The corresponding [desktop build](https://github.com/OptimumAF/WhatShouldIPlay/actions/runs/23127112634) and [Pages deploy](https://github.com/OptimumAF/WhatShouldIPlay/actions/runs/23127112623) succeeded on 2026-03-16. The most recent queried [package run](https://github.com/OptimumAF/WhatShouldIPlay/actions/runs/22527192060) succeeded on 2026-02-28; the signed-release workflow returned no runs. Recent September refresh runs succeeded, but `refresh-data.yml` has `continue-on-error: true` on its PR step, so success does not prove publication.
- Source audit inspected README, `docs/ARCHITECTURE.md`, `docs/desktop-ui-strategy.md`, roadmap, web features/hooks, `scripts/fetch-top-games.mjs`, desktop main/data/engine/UI, contracts, tests, and workflows. `rg` found no remaining roadmap `Target: March/April/May/June` headings. `git diff --check`: passed.

**Plan revision:** The M00.03 task text and acceptance criteria are unchanged. Documentation now exposes cross-client sync, filters, local persistence, and source quality as partial/absent/unverified where appropriate. M01.05 remains VERIFY pending desktop interaction and stable IDs; M02–M10 keep their original dependencies and scope. Historical workflow results are explicitly not treated as validation of the current branch.

## 2026-09-28 — M00.05 synthetic fixtures

**Task:** M00.05 (DONE).
**Implementation:** Added invented top-game observations that distinguish a shared Steam App ID across sources from a same-title game with a different App ID. Added manual-entry ID and extreme-weight cases, a retained-data source-failure note, missing metadata, the exact nonzero-rotation case from the M01.04 failure, and a version-1 credential-bearing snapshot with fake canaries. The existing credential and wheel tests now read those shared fixtures. TypeScript and Rust tests parse the same feed; the fixture guide identifies current and intended contract semantics.

- Pinned Node 22.23.3/npm 10.9.9 `npm run test:unit`: **11 passed / 11**. Two added fixture tests validate the top-game contract, distinct provider/manual IDs, unknown metadata, source-failure note, and extreme-weight deterministic landing. Existing snapshot and wheel tests still pass using the files.
- `cargo test --manifest-path apps/desktop/Cargo.toml --locked`: **3 passed / 3**, including a new Rust deserialization test of the shared feed.
- `cargo fmt --manifest-path apps/desktop/Cargo.toml --check`: first failed on one new line wrap, then passed after `cargo fmt`. Pinned `npm run typecheck`: passed. `git diff --check`: passed.

**Recorded first failure:** [M01.04's red test](verification-log.md#2026-09-28--m0104-wheel-landing) observed the four-sector case from 90° start with eight turns land at the wrong pointer sector before the fix. `selection-edge-cases.json` now makes its inputs reusable and deterministic; the passing current wheel test is not presented as a newly discovered failure. Current name-keyed pool merging of distinct App IDs remains open for M02.01; these fixtures do not mark that task complete.

## 2026-09-28 — M02.01a web provider identity

**Task:** M02.01a (DONE); M02.01 aggregate remains IN_PROGRESS.
**Reason and dependency:** The web pool, Steam import, feed ingestion, desktop pool, and manual/status records each merge by name. M02.01 was split into provider web, manual migration, and ingestion/desktop children so identity changes can be checked without silently treating their untouched paths as complete. M01.05 still waits for the full identity and desktop interaction gates.
**Implementation:** Web entries with a valid Steam App ID now use `steam:<id>` as their pool key. Name-only observations are scoped by source rather than merged solely on title. Steam import sanitization and the live import handler retain distinct same-title App IDs. New spin history records the chosen key, which cooldown uses; older history without IDs still blocks by name. The portable history schema accepts the optional ID without changing version 1 compatibility.

- Regression before fix: pinned `npm run test:unit` **11 passed, 1 failed / 12**; the import dropped App ID 20202. Targeted Chromium **0 passed, 1 failed / 1**; the synthetic feed produced two wheel labels where three were expected.
- After fix: pinned `npm run ci:web` passed typecheck, **12/12** unit tests, committed-data production build, and **18/18** Chromium tests. The two new browser checks verify that App ID 10101 merges across sources, App ID 20202 stays separate despite the same title, and two spins under one-spin cooldown persist distinct provider IDs in history. Targeted identity browser run passed **2/2**.
- `git diff --check`: passed. No live Steam credentials or provider calls were used.

**Limits:** Existing manual games remain name strings, played/completed exclusions still use names, and the data ingester's `dedupeByName` and desktop pool still merge by name. The browser fixture intercepts the feed after ingestion; it does not validate published feed preservation. M02.01b/c own these gaps, and the parent stays unchecked.

## 2026-09-28 — M00.02 untouched SHA runtime journey

**Task:** M00.02 (DONE).
**Environment and isolation:** A managed, detached baseline checkout at original SHA `3278b2a2ad100790a33368bafe93c1e97bc5e1d0` was used solely for verification. Its `git status --short --branch` remained clean. The existing baseline checks from the first log entry used that same SHA; this later pass fills the fresh-profile and desktop-startup gaps without changing its source. No live data refresh or credentials were used.

- In the baseline checkout, pinned Node 22.23.3/npm 10.9.9 `npm ci` passed (126 packages; 9 audit findings: 2 low, 1 moderate, 6 high), and `npm run build` passed against the committed dataset.
- The current branch's `tests/e2e/fresh-profile.spec.ts` was run by Playwright against the baseline checkout's preview server, not the current branch build: **1 passed / 1**. It skipped onboarding, selected Owned Focus and reduced animation, added three manual games, spun twice with different winners, found two history entries, reloaded, and checked retained settings/manual games/history. This test file did not exist at the baseline SHA; its assertions exercise the untouched baseline runtime.
- Baseline `cargo run --manifest-path apps/desktop/Cargo.toml` built and launched on Windows using a shared ignored target directory. `Get-Process pick-a-game-desktop` reported one responding `Dioxus App` window. The preview server and desktop process were stopped after the check. No desktop spin or scan was exercised.
- Earlier unchanged-base checks: typecheck/build passed, original Chromium **1 passed / 4** with three stale-tab assertions, Cargo check passed, Cargo test found **0 tests**, and Cargo fmt check failed on pre-existing formatting. Those results are not recast as passes by the later corrected tests.

**Limits:** One successful baseline repeated-spin journey does not establish that the decorative-label click interception cannot occur intermittently; a later pre-fix run did fail at that click and the current branch has the pointer-events regression fix. Desktop startup does not verify a desktop spin. The baseline had no tracked `Cargo.lock`, which M00.04 addressed on the development branch. The baseline worktree was retired after use.
