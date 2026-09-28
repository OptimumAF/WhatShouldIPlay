# WhatShouldIPlay — Living Development and Release Plan

**Prepared:** September 28, 2026  
**Target repository:** `OptimumAF/WhatShouldIPlay`  
**Canonical location after adoption:** `docs/DEVELOPMENT_PLAN.md`  
**Inspected branch:** `master`  
**Inspected commit:** `3278b2a2ad100790a33368bafe93c1e97bc5e1d0`  
**Commit date:** March 16, 2026 — “Upgrade winner presentation accents”  
**Plan status:** Active on `codex/continuation-hardening` as of September 28, 2026. The inspected commit remains the execution baseline; results are recorded in [verification-log.md](verification-log.md).

> **Instructions to the executing agent:** Treat this as a living execution document, not a one-time specification. Read it at the beginning of every work session. Update it as work progresses. Change a task from `[ ]` to `[x]` only after its acceptance criteria are satisfied and its verification evidence is recorded. Revise, split, add, or reorder tasks when repository evidence justifies the change; preserve stable task IDs, record the reason and dependency impact, and never silently weaken an acceptance criterion. Reopen completed tasks when a regression invalidates their evidence. Leave an actionable handoff before ending every session.

## 1. Scope, evidence, and product direction

The supplied hyperlink resolves to **WhatShouldIPlay**, although its visible label mentions `our-escape`. This plan is exclusively for the game-picker repository. Before making changes, verify that the working checkout's remote is `OptimumAF/WhatShouldIPlay`. Do not apply this plan to an escape-room game or another project.

This plan is grounded in a static review of the repository's source, manifests, documentation, and workflow definitions. It is **not** a claim that the application was built, run in a browser, tested on a desktop, deployed, or security-audited comprehensively. Latest workflow results, existing release assets, and the live data's freshness were not verified. Recheck the current checkout and repository state before implementation.

### Product outcome

Make WhatShouldIPlay a dependable way to answer:

> “Given the games I can play and the constraints I care about, help me choose something and get started.”

The core journey is: **choose or import a library → understand the eligible pool → spin or use an existing fast-pick mode → receive an accurate result → optionally mark the game played/completed → retain the state for next time.** Browsing trends and optional sync should enrich that journey, not become prerequisites.

For this continuation cycle, prioritize trust, selection correctness, usable libraries, durability, and a release that matches its claims. Do not begin with a redesign, another launcher integration, a new account service, or an AI recommendation backend.

### Architectural boundaries

Preserve React/TypeScript for the web application and Rust/Dioxus for desktop. The existing desktop UI strategy explicitly retains the dual implementation through 2026 and identifies Q1 2027 as a review window, not an automatic migration deadline. Share contracts, fixtures, and behavior rather than attempting an unrequested renderer rewrite. [S03]

Keep the core web experience statically hostable and useful without credentials. Keep local scanning desktop-only. Treat cloud sync, Steam account import, and notifications as optional capabilities. Do not turn a browser integration limitation into a mandatory hosted backend without the owner's approval.

### What already exists

The repository contains the web and desktop applications, trend ingestion, manual entry, Steam import code, weighted selection, cooldown/history, web filters and exclusions, cloud snapshot/Gist utilities, English/Spanish localization, service-worker caching, Playwright tests, accessibility CI gates, and desktop packaging/provenance workflows. Existing code is a starting point to verify and improve—not evidence that every documented feature works on both clients. [S01, S04–S19]

### Findings driving the order of work

| Finding from the inspected code | Consequence for this plan |
|---|---|
| The web cloud snapshot includes `steamApiKey`; restore points use that snapshot builder. | Remove credentials from every portable payload before extending sync. This demonstrates an unsafe serialization path, not proof that a user's key was exposed. |
| Gist creation uses `public: false`, while documentation calls the destination private. GitHub distinguishes secret Gists from private storage. | Correct disclosure and consent. Do not promise confidentiality based on an unlisted URL. |
| Web wheel rotation adds a target angle to an existing accumulated rotation, and permits fractional revolutions. | Add deterministic landing tests and correct the rotation calculation; browser-level confirmation is still required. |
| Web and desktop differ in source coverage, metadata retention, ordering, and adaptive signals. Desktop Steam import explicitly discards the App ID. | Define canonical identity and behavior, then validate both implementations with the same fixtures. |
| The ingest script infers session length from genres, labels Steam amounts `priceUsd` without checking the returned currency, and treats unparsed itch.io prices as free. | Preserve unknown values, provenance, currency, and confidence instead of inventing filter certainty. |
| The service worker deletes every cache except its four named caches during activation. | Restrict cleanup to this application's own cache namespace and test that unrelated caches survive. |
| The scheduled data workflow creates a PR and allows that step to fail without failing the job. | Verify the complete publication chain; a scheduled run does not establish deployed freshness. |
| Existing web tests cover several basic flows, and accessibility/packaging/provenance automation already exists. | Extend and validate those safeguards rather than replacing them or claiming they are absent. |

Supporting code paths are listed in the source map at the end. Findings refer to the inspected revision and must be reconfirmed if HEAD has changed.

## 2. How the agent must operate

### One execution source of truth

Adopt this file as `docs/DEVELOPMENT_PLAN.md`. If a plan already exists, reconcile rather than overwrite it. Keep `docs/roadmap.md` as the concise product-level roadmap linking to this execution plan. Respect any existing repository and directory-specific agent instructions; do not replace them with a large duplicate of this document.

Maintain these lightweight companion records only when needed:

- `docs/verification-log.md`: commands, results, environment, commit, and relevant manual checks.
- `docs/decisions.md`: meaningful behavior, schema, architecture, and scope decisions.
- `docs/feature-parity.md`: supported, missing, intentional, and unverified web/desktop behavior.

Use existing equivalent files instead of creating competing records. Prefer evidence links from each task over copying the same notes into several documents.

### Task lifecycle and completion rules

All 72 implementation tasks below begin unchecked. Use status text on unchecked tasks: `TODO`, `IN_PROGRESS`, `VERIFY`, `BLOCKED`, `DEFERRED`, or `SUPERSEDED`. Only verified `DONE` tasks use `[x]`. A skipped test, an unavailable toolchain, a missing credential, an untested platform, or a mock-only integration is not a pass.

Keep stable IDs such as `M03.02`. When splitting a task, retain its ID and introduce children such as `M03.02a`; record whether the parent remains a required aggregation task or is superseded. Do not erase unfinished work or renumber the entire backlog. Reopen an invalidated task and explain which acceptance criterion no longer holds.

A task is complete only when the implementation is integrated into its intended path, appropriate automated checks pass, necessary manual checks are recorded, changed behavior is documented, and required client parity is either verified or explicitly approved as a scoped exception. A compiling function, screenshot, placeholder, passing mock, or zero-test test command is insufficient evidence by itself.

Use this evidence shape under a task or in the verification log:

```text
Task: Mxx.yy
Status: TODO | IN_PROGRESS | VERIFY | BLOCKED | DONE | DEFERRED | SUPERSEDED
Implementation commit / PR:
Acceptance criteria checked:
Commands and actual results, including test counts:
Manual checks and environment:
Known limitations / blocked checks:
Evidence links:
```

Mark progress after each meaningful implementation-and-verification chunk, not only at the end of a milestone. Finish the active chunk before expanding scope. Each agent should own at most one active task at a time; parallel agents need explicit file ownership and integration responsibility.

### How to adjust the plan

The agent may improve implementation details, add a missing prerequisite, split an oversized task, or reorder independent work when new evidence supports it. Record the date, affected task IDs, observation, decision, acceptance-criteria changes, dependency changes, and user-visible impact. Tests that reveal a wrong assumption are a reason to revise the plan—not a reason to modify tests to accept the defect.

Do not silently defer a security fix, remove a promised feature, weaken a CI gate, or change the product's architecture. Obtain owner approval before introducing paid services, mandatory accounts, a hosted backend, a renderer migration, destructive data changes, new telemetry, broad filesystem access, new credential scopes, or public release/deployment actions. A blocker requiring approval should not stop unrelated safe work.

### Worktree and change discipline

Inspect `git status` before editing. Preserve unrelated and uncommitted work; do not reset, clean, stash, or overwrite it without permission. Use the existing appropriate development branch, or create a dedicated branch/worktree such as `feat/continuation-hardening` from the agreed base. Do not bypass branch protection or push directly to `master` merely to accelerate completion.

Prefer reviewable changes: characterization test → focused fix → verification → plan update. Scope each PR to one coherent result, and reference task IDs. Avoid incidental mass formatting, dependency upgrades, and generated-data churn in functional changes. Public publishing and destructive operations remain separate from implementing and validating code.

### Session handoff

At the end of every session, record:

```text
Branch and current HEAD:
Completed task IDs and supporting evidence:
Current task, partial implementation, and changed files:
Plan changes / decisions:
Checks passed:
Checks failed or not run, with the exact reason:
Outstanding risks and owner decisions:
Next task ID and the first concrete command or action:
```

Never include credentials, real private libraries, tokens, or personal filesystem paths in committed examples, issue text, screenshots, logs, fixtures, or handoffs.

## 3. Milestones and dependencies

| Milestone | Priority | Outcome | Primary dependencies |
|---|---|---|---|
| M00 | P0 | Reproducible baseline and adopted living plan | None |
| M01 | P0 | Immediate credential, wheel, and cache safety fixes | Minimal M00 baseline |
| M02 | P1 | Stable game identity and portable contracts | M00; security boundaries from M01 |
| M03 | P1 | Explainable, deterministic selection behavior | M02; wheel fix from M01 |
| M04 | P1 | Trustworthy ingestion and observable data publication | M02 |
| M05 | P1 | Useful, resilient library workflows | M02, relevant M03/M04 contracts |
| M06 | P1 | Durable desktop state and safe responsive scanning | M02; coordinate with M05 |
| M07 | P1 | Safe local persistence and optional sync | M01, M02, desktop persistence from M06 |
| M08 | P1 | Fast, accessible, understandable user journey | Stable M03/M05 behavior; may start earlier |
| M09 | P1 | Scoped caching and honest offline/update behavior | M01 cache fix; coordinate with M04/M07 |
| M10 | P1 | Continuous test coverage and trustworthy packaging | Testing starts in M00; release work integrates all applicable milestones |
| M11 | Release gate | Verified candidate, documentation, and controlled rollout | Required tasks in the owner-agreed release scope |

Do not wait until M10 to write tests. Its safeguards are built alongside every milestone. Parallelize contracts/fixtures and independent platform work only after interfaces and file ownership are clear. Security fixes should not wait for the entire baseline audit or a large refactor.

Default release scope includes M00–M10, with M11 as the release process. Any smaller release must explicitly identify its included capabilities, deferred IDs, and honest limitations. Do not describe the whole plan as complete when only a web subset ships. Optional future ideas at the end are not release blockers.

## M00 — Establish the baseline and adopt the plan

**Start with:** repository docs, manifests, workflow definitions, `src/hooks/`, and `apps/desktop/src/`.

- [x] **M00.01 — Adopt the plan and verify the checkout.** Verify the remote, branch, current HEAD, local changes, and applicable agent instructions. Reconcile this plan with existing planning documents and work already in progress. Set up the safe working branch or worktree. **Done when:** the canonical plan is committed or otherwise deliberately preserved in the agreed workflow, its baseline is accurate, and unrelated work is untouched. **Evidence:** The checkout was initially an empty repository with no remote or local changes. `origin` was set to `https://github.com/OptimumAF/WhatShouldIPlay.git`, fetched, and checked out at `3278b2a2ad100790a33368bafe93c1e97bc5e1d0` on `codex/continuation-hardening`; `git status --short --branch` was clean before edits. No repository `AGENTS.md` or prior `docs/DEVELOPMENT_PLAN.md` existed. This plan and the roadmap link are adopted in the branch commit; see [verification-log.md](verification-log.md#2026-09-28--baseline-and-plan-adoption).

- [ ] **M00.02 — Record an honest runtime baseline (VERIFY).** Run the existing web checks and available desktop checks against the unchanged baseline, using the committed dataset rather than refreshing live sources. Exercise a fresh-profile manual-game spin, a repeated spin, settings persistence, and available desktop startup. **Done when:** commands, test counts, observed defects, and environmental blockers are recorded without conflating pre-existing failures with new regressions. **Partial evidence:** [verification-log.md](verification-log.md#2026-09-28--baseline-and-plan-adoption); Windows desktop startup was observed later, while fresh-profile/repeated spin and settings persistence checks remain open.

- [ ] **M00.03 — Reconcile documentation with implementation.** Map each README/roadmap capability to code, UI reachability, client support, tests, and known limitations. Review available issues, PRs, and recent workflow outcomes to avoid duplicating work. Replace obsolete March–June 2026 target dates with an evidence-based status rather than invented new deadlines. **Done when:** a capability/parity matrix distinguishes implemented-and-verified, partial, absent, and unverified behavior.

- [ ] **M00.04 — Make toolchains and checks reproducible.** Align the documented Node version with the locked Vite release; pin a compatible toolchain instead of blindly upgrading frameworks. Confirm Cargo lockfile policy and commit an application lockfile if absent. Add a small unit-test harness suitable for existing TypeScript pure functions and Rust engine tests. **Done when:** clean-checkout instructions are precise, lockfiles are intentional, and new unit commands actually run tests.

- [ ] **M00.05 — Create reusable synthetic fixtures.** Add small fixtures for duplicate names with distinct IDs, the same game from several sources, manual games, absent metadata, source failure, old snapshots, and unusual weights. Never use actual user credentials or libraries. **Done when:** fixtures can drive repeatable tests without live APIs and a recorded first failure can be reproduced deterministically.

**Exit gate:** the agent understands the current system, can distinguish code failures from environment failures, and has a minimal test path for urgent fixes.

## M01 — Fix immediate trust and correctness defects

**Start with:** `useCloudSnapshotBuilders.ts`, `cloudSyncClient.ts`, `wheel.ts`, `useSpinController.ts`, `Wheel.tsx`, `public/sw.js`, and desktop wheel handling.

- [x] **M01.01 — Remove credentials from every portable payload.** Introduce an explicit allowlisted serializer for cloud snapshots, file exports, sharing, and restore points. Exclude Steam API keys, GitHub tokens, and future credential fields at the serialization boundary, including nested profile data. **Done when:** canary-secret tests prove that these values never appear in any outgoing or persisted portable representation, while supported non-secret settings still round-trip. **Evidence:** [verification-log.md](verification-log.md#2026-09-28--m0101-portable-snapshot-boundary). The allowlisted serializer is used by both Gist write paths and restore-point creation. Three unit tests failed before the fix and passed after it; the targeted Chromium persistence/upload test passed. File export and sharing flows do not yet exist; M05.05 must reuse this boundary when adding them.

- [x] **M01.02 — Handle legacy credential-bearing data safely.** Accept supported older snapshots without carrying their credential fields forward. Sanitize local restore points and legacy persistence deliberately, preserving valid game data. Document that previously exported keys may require rotation and that changing the current Gist file does not establish removal from all historical copies. **Done when:** legacy fixtures migrate without re-exporting secrets; the user notice is accurate; no remote data is silently deleted. **Evidence:** [verification-log.md](verification-log.md#2026-09-28--m0102-legacy-credential-migration). Chromium fixtures verify old local credentials are rewritten out while imports/IDs survive, a credential-bearing old Gist can be pulled without adopting its key, a subsequent push contains no key, and the intercepted sequence has no DELETE. The UI and README explain key rotation and Gist history without claiming a confirmed exposure.

- [ ] **M01.03 — Correct Gist privacy and credential handling (VERIFY).** Replace claims of “private Gist” security with accurate secret-Gist disclosure. Make upload destinations and payload contents explicit. Prefer session-only web tokens; any persistent storage requires an informed choice and documented limitations. Use OS credential storage for desktop persistence when supported, otherwise do not retain the secret. **Done when:** disconnect removes retained credentials, logs are redacted, and no UI promises encryption or privacy that is not implemented. **Partial evidence:** [verification-log.md](verification-log.md#2026-09-28--m0103-gist-disclosure-and-error-redaction). Web copy, disconnect, session-only keys, error redaction, and desktop non-persistence were checked locally. A live GitHub Gist round trip has not been run without an owner-provided credential, so this stays unchecked.

- [x] **M01.04 — Correct wheel landing mathematics on both clients.** Inject deterministic randomness or a selected-index test seam. Calculate a normalized absolute target orientation, compensating for the current angle; do not let fractional animation turns change the winner's final segment. Keep motion styling separate from selection. **Done when:** repeated spins from nonzero rotations, every motion profile, varied pool sizes, and bounded jitter land in the selected segment in engine tests and available UI verification. **Evidence:** [verification-log.md](verification-log.md#2026-09-28--m0104-wheel-landing). TypeScript uses an injected random function and Rust uses a selected-index calculation. Unit tests span 1–37 sectors, all four motion settings, jitter bounds, and accumulated rotations; a rebuilt Chromium run checked pointer/result/history agreement across two actual spins. Desktop rendering itself remains visually unverified.

- [ ] **M01.05 — Make a spin a single immutable operation (VERIFY).** Capture eligible IDs, ordering, effective weights, winner, and display data at spin start. Prevent same-tick reentry. Finalize once even if transition completion and fallback fire together. Prevent source refreshes, profile changes, or history/cooldown recomputation from relabeling a wheel already in motion or its just-finished result. **Done when:** regression tests show one selection, one history entry, and consistent pointer/result/history identity. **Partial evidence:** [web verification](verification-log.md#2026-09-28--m0105-web-spin-lifecycle) and [desktop verification](verification-log.md#2026-09-28--m0105-desktop-spin-lifecycle). Both clients now snapshot the ordered pool, effective weights, winner, labels, and motion. Browser regressions pass; Rust tests check the desktop snapshot and one-time result consumption. Desktop startup is visible, but a desktop spin and pointer/result/history journey has not been exercised. Existing name-based identities remain provisional until M02.01; this dependency does not waive the task's identity requirement.

- [x] **M01.06 — Stop deleting unrelated service-worker caches.** Namespace caches by this application and its deployment scope. Delete only obsolete caches that belong to this namespace, and narrow URL matching to the application's intended resources. Handle migration from the current names without claiming ownership of another app's caches. **Done when:** activation preserves sentinel caches belonging to another same-origin application and updates this app's caches correctly. **Evidence:** [verification-log.md](verification-log.md#2026-09-28--m0106-service-worker-cache-isolation). Three unit regressions failed against the old worker and passed after scoping. A Chromium activation test preserved sibling and unscoped legacy caches, removed only an obsolete cache for the current scope, and cached the app's data in the new namespace. Old unscoped caches are deliberately not reused or deleted because ownership cannot be established.

**Rotation characterization example:** With four equal segments, winner index 0 has center 45°. Assuming the existing top-pointer convention and zero jitter, its target orientation is 315° modulo 360. The inspected expression adds `currentRotation + 360 * revolutions + 315`. From a current rotation of 90° and eight turns, it ends at 45° modulo 360, not 315°. Fractional turns also introduce a residual angle. This is a mathematical characterization of the inspected formula, not a substitute for checking the rendered pointer convention. [S09]

**Exit gate:** no known credential-bearing portable output, no unrelated-cache deletion, and a reproducibly correct single-spin result.

## M02 — Establish identity and cross-client contracts

**Start with:** `src/types.ts`, `src/contracts/`, `src/lib/appSchemas.ts`, `contracts/`, and desktop `contracts.rs`/data models.

- [ ] **M02.01 — Introduce stable game identity.** Prefer provider-qualified IDs such as Steam App IDs over display names. Give manual-only entries persistent local IDs. Preserve aliases for legacy name-based records, but do not merge distinct games simply because their normalized names match. **Done when:** renaming a game does not lose history/status, and fixtures distinguish same-title different games from the same game reported by several sources.

- [ ] **M02.02 — Separate provenance, ownership, and installation.** Use canonical source IDs rather than presentation labels in portable state. Model a trend observation separately from an ownership or installed-game observation. Keep launcher-specific location data local. **Done when:** a popular Steam game is not implicitly treated as owned, imported games are not implicitly installed, and unsupported installation facts remain unknown rather than false claims.

- [ ] **M02.03 — Preserve useful metadata across clients.** Evolve the data contract for provider IDs, URLs, platform support, price/currency, source timestamps, and estimate provenance. Update TypeScript and Rust adapters so desktop import and shared-feed consumption do not discard IDs or needed filter metadata. **Done when:** a shared fixture survives both adapters with its relevant fields intact, and unsupported versions fail with a useful message.

- [ ] **M02.04 — Version portable settings and history.** Define a credential-free snapshot contract with stable entry/history IDs, timestamps, schema version, and bounded collections. Separate portable preferences from machine-only paths, permissions, and notification capabilities. Add explicit legacy migration rather than untyped casting. **Done when:** supported older snapshots migrate, invalid ones do not replace valid state, and the wire contract is documented independently of either UI implementation.

- [ ] **M02.05 — Add cross-language golden fixtures.** Store canonical input/output examples for normalization, identity resolution, filtering, effective weights, selection boundaries, snapshots, and migration failures. Both clients consume the same fixtures. Use the same supplied random values or a documented compatible algorithm when exact seeded results are required. **Done when:** TypeScript and Rust independently produce matching required behavior, with intentional differences named rather than hidden.

- [ ] **M02.06 — Decide and document parity semantics.** Set explicit policies for source ordering, duplicate contributions, manual-entry ranking, uniform versus weighted selection, cooldown exhaustion, and advanced filtering. Account for desktop-only scanning without expecting identical pools when inputs differ. **Done when:** the parity matrix and golden fixtures agree; the same supported input produces equivalent decisions on both clients.

**Exit gate:** identity is not merely a lowercased name, and behavior can be specified and tested without either UI.

## M03 — Make selection trustworthy and explainable

**Start with:** `useGamePoolData.ts`, `appConfig.ts`, `wheel.ts`, and desktop `engine.rs`.

- [ ] **M03.01 — Extract a pure selection pipeline.** Separate source selection, identity resolution, metadata filtering, status exclusion, cooldown, weighting, and sampling. Keep effects and React/Dioxus state outside the pure logic. Return exclusion reasons and an immutable eligible pool alongside weights. **Done when:** each stage has focused tests and the UI delegates to it without reimplementing a second set of rules.

- [ ] **M03.02 — Use one effective-weight calculation everywhere.** Sanitize finite/nonnegative weights once and use the same result for selection and displayed odds. Define zero-total and invalid-vector handling. Uniform mode must be uniform over the agreed unique eligible games. Specify how cross-source duplicates and incomparable popularity/playtime scores contribute. **Done when:** boundary tests include zero, negative, non-finite, huge, mismatched, and all-zero inputs; zero-weight entries cannot win through a boundary bug.

- [ ] **M03.03 — Make exclusion and cooldown policies explicit.** Distinguish hard constraints from soft cooldown. Never silently reinclude completed/excluded games. Decide whether “No Repeats” stops when exhausted or prompts for a reset; disclose any relaxed cooldown before the next draw. **Done when:** empty, one-game, and exhausted-pool scenarios produce the documented result and action, and both clients agree.

- [ ] **M03.04 — Define unknown-metadata filter behavior.** Distinguish “does not match” from “cannot determine.” Provide a clear inclusion/exclusion policy for unknown values, with understandable counts. Validate contradictory ranges. Do not erase a saved filter just because a source is still loading or temporarily unavailable. **Done when:** manual/imported games with missing metadata behave predictably and transient refreshes do not silently alter the user's constraints.

- [ ] **M03.05 — Finish the spin lifecycle beyond the urgent fix.** Filter relevant transition events, clean up timers, support reduced or disabled motion, and recover from interrupted animation without drawing a different winner. Keep old popup timers from closing a new result. Define profile-switch and navigation behavior while spinning. **Done when:** fake-clock tests and UI flows cover cancellation, backgrounding, unmounting, duplicate events, and fallback completion.

- [ ] **M03.06 — Explain the actual choice.** Show the effective pool size, useful exclusion reasons, source provenance, and the winner's real odds. Do not imply that equal visual sectors represent equal probability in weighted mode. Keep a readable candidate list independent of the wheel animation. **Done when:** displayed odds match tested effective probabilities and the user can understand why a game is eligible without inspecting code.

- [ ] **M03.07 — Correct adaptive recommendation signals.** Keep personalization optional and local by default. Do not treat the algorithm's own random outputs as equivalent to explicit preference. Define intentional signals such as accepted choices, played/completed actions, or dismissals, with bounded effects and undo/reset. **Done when:** a repeated spin alone does not manufacture a preference-feedback loop, and disabling adaptation restores the documented base behavior.

**Exit gate:** a valid eligible game is selected according to the disclosed rules, or the user receives an actionable explanation of why selection is unavailable.

## M04 — Harden ingestion, metadata, and freshness

**Start with:** `scripts/fetch-top-games.mjs`, `contracts/top-games.schema.json`, desktop `data.rs`, and refresh/deploy workflows.

- [ ] **M04.01 — Make parsers independently testable.** Separate pure parsing and normalization from network access and filesystem writes. Add saved synthetic/minimal fixtures for expected source pages, changed markup, blocked responses, non-game categories, malformed numbers, and Unicode titles. **Done when:** parser tests require no live provider and suspicious empty results are distinguishable from legitimate empty datasets.

- [ ] **M04.02 — Bound network work.** Add explicit request deadlines, bounded concurrency, bounded response sizes, and limited retries for appropriate transient failures. Respect provider retry guidance and rate limits. Treat challenges/denials as unavailable data rather than bypass targets. **Done when:** stalled, rate-limited, malformed, and partially failing responses terminate predictably and do not block successful sources indefinitely.

- [ ] **M04.03 — Preserve last-known-good data.** Validate each source independently and retain its valid cached entries on fetch or suspicious parse failure. Track attempted refresh separately from last successful observation. Write validated output atomically. **Done when:** a bad refresh cannot replace a useful dataset with an accidental empty array or partial file, and stale fallback data is visibly labeled.

- [ ] **M04.04 — Stop manufacturing metadata certainty.** Keep unparsed price unknown, retain currency and observation time, and only compare prices under a defined compatible-currency policy. Label genre-derived session length as a heuristic, not measured playtime; support unknown values or a user override. **Done when:** tests cover non-USD prices, missing prices, free/pay-what-you-want ambiguity, and absent duration, without asserting unsupported facts.

- [ ] **M04.05 — Enforce publication quality.** Validate producer output against the shared contract before publication. Check IDs, names, URL schemes, count changes, impossible values, duplicate observations, and source freshness. Choose initial alert thresholds from the baseline and document them. **Done when:** malformed or implausibly degraded output fails or quarantines the update with a useful diagnostic instead of silently becoming production data.

- [ ] **M04.06 — Align desktop feed and fallback behavior.** Prefer the shared validated feed and preserve supported metadata. Isolate fallback fetches so one provider failure does not discard other successful results. Avoid maintaining duplicate scraper logic without a clear requirement. **Done when:** desktop reports per-source status, works from cached data where appropriate, and matches the source-coverage claims in the parity matrix.

- [ ] **M04.07 — Verify refresh-to-publication end to end.** Follow scheduled refresh → validated change → PR/checks → authorized merge/publication → Pages output → client refresh. Do not label PR creation or deployment failure as success. Preserve branch protections; any automation policy change requires approval. **Done when:** a controlled update reaches the served dataset with an observable revision, and a failed stage reports failure while last-good data remains available.

**Exit gate:** data remains usable during provider failures, metadata limitations are honest, and publication—not merely scheduling—is verifiable.

## M05 — Make the library workflow genuinely useful

**Start with:** manual-game components, `useLibraryActions.ts`, Steam import UI, exclusions UI, and winner actions.

- [ ] **M05.01 — Complete manual-library editing.** Support adding, editing, removing, searching, and undoing relevant changes while retaining stable identity. Make bulk input rules clear; do not corrupt legitimate game titles containing punctuation or commas. Reuse existing controls where they are adequate. **Done when:** a user can maintain a small library without clearing and reentering everything, and edits do not orphan status/history.

- [ ] **M05.02 — Make owned/installed presets truthful.** Define exactly what “Owned Focus” and any installed-only option mean. Do not silently fall back to unrelated trending games when an owned-only pool is empty. Explain missing imports or unavailable scans. **Done when:** preset tests enforce the advertised eligibility rules and the user can distinguish discovery, ownership, and installation.

- [ ] **M05.03 — Establish a supported Steam-import path.** Test the existing direct browser request in an actual supported browser before promising success. Distinguish invalid credentials, inaccessible game details, an empty library, rate limiting, and connectivity/CORS failure. Where browser access is unsupported, provide an honest desktop or safe file-import route; a new proxy/backend is a separate decision. **Done when:** a documented end-to-end path works and no public CORS relay receives user keys.

- [ ] **M05.04 — Make imports resilient and reversible.** Preserve existing valid library data on failed or ambiguous refreshes. Use stable provider IDs, prevent stale in-flight requests from overwriting newer choices, and retain manual metadata/status during a refresh. Show a preview when replacement or removal is involved. **Done when:** refresh, cancellation, retry, duplicate entries, and concurrent input changes have deterministic tested outcomes.

- [ ] **M05.05 — Provide portable library import/export.** Use the credential-free versioned format from M02. Validate size, schema, counts, and links before applying; show a merge/replace preview and retain a recoverable pre-import state. Keep machine paths out of portable files. **Done when:** a library can be exported and restored across supported clients without lost identity, secret leakage, or silent destructive replacement.

- [ ] **M05.06 — Connect results to safe next actions.** Preserve existing played/completed controls and add missing undo or clear-state actions. Open verified store links or supported launcher protocols only after a user gesture; never execute a shell command assembled from a title or imported path. Treat new native launching as optional if not already supported. **Done when:** result actions preserve identity, reject unsafe links, and accurately distinguish marking played from merely drawing a winner.

**Exit gate:** a user can build a real eligible library, choose a game, record an outcome, and retain control of that data without an account.

## M06 — Make desktop durable and scanning safe

**Start with:** desktop `main.rs`, `data.rs`, `contracts.rs`, `engine.rs`, and settings UI.

- [ ] **M06.01 — Verify and implement durable desktop state.** Audit whether settings, manual entries, imported entries, exclusions, and history survive restart; do not infer durability from in-memory signals. Persist supported state in an OS-appropriate application-data location with versioned parsing, atomic replacement, and recoverable corruption handling. **Done when:** restart, upgrade migration, and malformed-state tests preserve valid user data without writing it into the repository or portable exports.

- [ ] **M06.02 — Move scanning off the UI-critical path.** The inspected async scan wrapper directly calls synchronous filesystem scanning. Run blocking work in an appropriate bounded worker, publish progress safely, and provide cancellation or a clear bounded completion policy. **Done when:** a large or slow test library does not freeze interaction, cancellation does not corrupt previous results, and stale scan completions cannot overwrite newer choices.

- [ ] **M06.03 — Harden launcher discovery adapters.** Test Steam library manifests, Epic manifests, and existing folder-based integrations with temporary directories. Cover additional library roots, unreadable files, malformed manifests, removed drives, unusual names, and symlink/junction boundaries. Keep broad shortcut scanning explicitly opt-in. **Done when:** scans require no elevation, have explicit bounds, and report partial failure without traversing unrelated user data.

- [ ] **M06.04 — Preserve local installation identity.** Return structured observations with launcher, stable ID when available, display name, confidence, and local-only location. Do not claim that a similarly named directory proves a supported installed game. Reconcile installations with imported ownership conservatively. **Done when:** duplicate installations do not become duplicate choices unintentionally, ambiguous discoveries can be reviewed, and filesystem paths never enter sync snapshots.

- [ ] **M06.05 — Close required desktop behavior gaps.** Add or correct source handling, metadata filters, exclusions, and result information required by the agreed parity scope, including itch.io support if that remains a promised shared capability. Do not advertise web-only features as implemented on desktop. **Done when:** the parity matrix is backed by shared fixtures and actual desktop checks, or the owner has approved a plainly documented capability limitation.

- [ ] **M06.06 — Verify the desktop journey as an application.** Test startup, rescan, manual entry, import, repeated selection, offline cached/manual use, restart, and state recovery on the available target systems. Keep missing-platform verification explicitly blocked. **Done when:** evidence covers the user journey, not just compilation, and the supported-OS claims match the systems actually validated.

**Exit gate:** the desktop app is responsive, preserves user work, and treats scanning as bounded local access rather than unrestricted discovery.

## M07 — Harden persistence and optional cloud sync

**Start with:** persistence hooks, cloud workspace/transport/apply hooks, `cloudSyncClient.ts`, schemas, and desktop persistence.

- [ ] **M07.01 — Make web persistence recoverable.** Handle unavailable storage, quota errors, malformed records, and partially migrated state. Keep migrations idempotent and avoid default-state effects overwriting data before initialization finishes. Bound history/restore storage intentionally. **Done when:** seeded legacy and corrupted-state browser tests preserve recoverable data, explain failures, and do not produce a startup overwrite race.

- [ ] **M07.02 — Apply snapshots transactionally.** Validate and migrate into a complete candidate state before changing live settings. Show an informative preview for imports/restores, maintain a credential-free restore point, and apply state consistently across dependent stores. **Done when:** invalid or incompatible data leaves the previous state intact and valid application does not create mixed old/new state after reload.

- [ ] **M07.03 — Harden the Gist transport.** Require the expected named sync file rather than arbitrarily choosing another file. Handle GitHub's `truncated` content flag with an appropriate bounded fetch of the documented raw resource. Validate response shape, URLs, size, and schema; sanitize error messages. **Done when:** missing files, partial content, 401/403/404/429, invalid JSON, and interrupted downloads fail safely without replacing local data.

- [ ] **M07.04 — Prevent silent sync conflicts.** Track the downloaded base/revision and distinguish local changes from remote changes. Provide explicit conflict choices and a safe default that preserves local work. Verify actual provider concurrency guarantees before relying on conditional writes; a preflight GET alone is not atomic conflict prevention. **Done when:** two-device tests expose conflicts rather than silently losing changes, and any residual race limitation is documented accurately.

- [ ] **M07.05 — Make cloud consent and disconnect clear.** Let the user inspect what is uploaded and where. Keep syncing optional and separate from local profile selection; a local preset/profile is not proof of an authenticated cross-device account. Disconnect must stop transport and discard retained credentials without deleting local library data. **Done when:** the full product remains usable with sync disabled and no upload occurs before an explicit user action or previously granted setting.

- [ ] **M07.06 — Test supported cross-client/version round trips.** Exercise web → desktop → web and supported legacy/current versions using synthetic fixtures. Preserve portable data an older client does not understand where safe, or refuse a lossy write with a clear explanation; never restore unknown credential fields. **Done when:** history, IDs, settings, and exclusions survive supported cycles, and unsupported capabilities cannot be silently erased by a sync.

**Exit gate:** local work is safe without the network, and enabling optional sync does not introduce secret exposure, silent replacement, or undocumented compatibility loss.

## M08 — Improve the core experience and accessibility

**Start with:** existing layout/play/library/settings components, design tokens, localization, and modal/focus hooks.

- [ ] **M08.01 — Optimize the first useful choice.** Keep the content-first layout and progressive settings disclosure. Provide an obvious route to use the existing pool or enter manual games without demanding API keys, sync, or notification permission. Review actual rendered screens before changing them. **Done when:** a fresh-profile usability check reaches a valid choice without setup confusion, and source failures still leave a clear manual path.

- [ ] **M08.02 — Make constraints and empty states understandable.** Show selected sources, eligibility counts, and the specific reasons that a pool became empty. Offer targeted remedies such as adding games, removing one filter, or explicitly resetting cooldown—not an unexplained global reset. **Done when:** every empty/error/loading state has a useful next action and changing one constraint does not unexpectedly reset unrelated preferences.

- [ ] **M08.03 — Make the result durable and accessible.** Keep the winner available after any celebration disappears. Manage focus correctly, announce the result once, preserve keyboard access, and make dismissal user-controlled where an auto-close would interrupt reading or action. Avoid announcing a result before the spin operation is committed. **Done when:** keyboard and screen-reader checks can find the same winner, odds, and actions shown visually.

- [ ] **M08.04 — Handle large pools without misleading visuals.** Benchmark representative large synthetic libraries before optimizing. Limit or simplify wheel labels and use a readable searchable list; do not silently truncate the actual selectable pool to improve rendering. Add virtualization only if measurements justify it. **Done when:** the documented large-library fixture remains usable, selected probabilities include the full eligible pool, and before/after measurements support any optimization.

- [ ] **M08.05 — Verify accessibility across interaction states.** Extend existing accessibility checks to opened settings, dialogs, library editing, empty states, and result actions. Manually test keyboard-only navigation, visible focus, screen-reader output, touch targets, zoom, narrow layouts, and reduced/no motion. **Done when:** relevant automated violations are resolved and manual evidence covers controls that initial-page scanning cannot exercise.

- [ ] **M08.06 — Complete supported localization.** Move remaining hard-coded UI/error/status strings into the English/Spanish localization system. Handle interpolation, pluralization, date/number formatting, and long translations. Include desktop and service-worker-facing copy where supported. **Done when:** both language journeys work without missing keys or clipped critical controls, and language changes do not reset product state.

**Exit gate:** a new user can make and understand a choice, and the same journey remains usable without animation, a mouse, or English-only text.

## M09 — Make PWA, offline, and updates reliable

**Start with:** `public/sw.js`, `src/lib/pwa.ts`, runtime effects, update banners, and the manifest.

- [ ] **M09.01 — Define offline readiness and cache ownership.** Extend the M01 namespace fix into an intentional install/cache lifecycle. Ensure the required built shell assets are available before claiming offline readiness; runtime interception after first navigation is not sufficient evidence. **Done when:** a controlled online initialization reaches a testable ready state and every cache/resource belongs to a defined application scope.

- [ ] **M09.02 — Test real offline user journeys.** Test reopening after a successful online visit, refreshing while offline, manual-only operation, cached-data selection, and missing/corrupted cache. Be honest that a never-loaded site cannot fetch its application while disconnected. **Done when:** offline-ready users can complete the supported core journey and unavailable capabilities have clear, non-destructive fallbacks.

- [ ] **M09.03 — Cache only valid data and recover appropriately.** Validate fetched game data before promoting it to last-good cache. Decide which HTTP errors use cached fallback instead of returning an unusable error page/body. Bound network waits and retain source freshness information. **Done when:** malformed 200 responses, non-success statuses, and network failures do not poison the cache or misrepresent stale data as fresh.

- [ ] **M09.04 — Verify upgrades, multiple tabs, and rollback.** Test build N → N+1 with update accepted, postponed, and interrupted. Avoid forcing a reload during an active spin or unsaved input. Handle changed hashed assets and schema compatibility coherently across tabs. **Done when:** the documented upgrade/rollback paths preserve user state and avoid an old shell/new assets mismatch or stranded client.

- [ ] **M09.05 — Keep notification promises accurate.** Ask permission only after an intentional action; handle denial, revocation, and unsupported environments. Avoid repeated trend notices from timestamp-only payload changes. Document whether reminders require the application to be open rather than implying a reliable closed-app scheduler. **Done when:** tests cover permission states and notifications reflect meaningful supported events without introducing an unapproved push service.

**Exit gate:** offline use and updates have tested boundaries, and caching or notifications do not make unsupported reliability promises.

## M10 — Expand quality gates and secure release engineering

**Build these checks throughout development; do not defer them until the end.**

- [ ] **M10.01 — Gate domain and parser behavior.** Run unit, migration, parser, schema, and shared-fixture tests on relevant PRs. Include deterministic random-boundary tests and a reproducible distribution sanity test where useful; do not use a flaky unseeded statistical check as the sole proof. **Done when:** seeded regressions for the identified defects fail before their fixes and pass after, and critical logic is tested independently of animation.

- [ ] **M10.02 — Extend browser regression coverage.** Preserve existing Playwright tests and add fresh onboarding, repeated weighted spins, hard/soft exclusions, failed imports, storage recovery, sync conflicts, offline state, and update transitions. Use synthetic intercepted responses for required CI; run real integrations separately. Add supported browser/mobile coverage deliberately. **Done when:** failures produce useful sanitized traces/screenshots and required checks do not depend on third-party availability.

- [ ] **M10.03 — Establish meaningful Rust checks.** Run formatting, linting, unit/contract tests, and appropriate platform builds with the agreed lockfile. Cover default and optional scan features. Separate pure engine/manifest tests from GUI/system prerequisites where beneficial. **Done when:** nonzero tests exercise selection, persistence, and scanner fixtures, and platform limitations are visible rather than masked as successful verification.

- [ ] **M10.04 — Audit dependency and workflow trust.** Review vulnerable/outdated dependencies, runtime requirements, downloaded build tools, workflow permissions, and secret exposure paths. Make targeted compatible upgrades; do not combine a framework migration with urgent bug fixes. Pin or otherwise control release tooling. **Done when:** findings are resolved or explicitly accepted with rationale, and untrusted PR code cannot access signing/release credentials through the revised workflows.

- [ ] **M10.05 — Preserve and rationalize existing CI gates.** Retain web typecheck/build, Chromium checks, Lighthouse, Axe, and required desktop checks while integrating new tests. Preserve required status-check names or coordinate protection updates with the owner. Keep a build of committed data separate from live ingestion. **Done when:** a clean checkout produces reproducible required results, failures are not hidden with blanket ignores, and accessibility checks exercise meaningful states.

- [ ] **M10.06 — Establish one authoritative release-artifact path.** Audit overlapping package, EXE, and signed-release workflows for competing writers or ambiguous assets. Produce checksums and provenance for the final distributable bytes after signing or other mutation. Name platform/architecture/artifact type clearly; a portable EXE is not an installer. **Done when:** a nonpublishing candidate build has unambiguous assets, verified hashes/provenance, and accurately reported signing status.

- [ ] **M10.07 — Write and rehearse the release runbook.** Check package/Cargo version consistency, platform dependencies, clean-machine startup, upgrade behavior, state preservation, rollback, and signing/notarization requirements for each claimed target. Rehearse with a candidate or draft path that does not publish without approval. **Done when:** another contributor can follow the runbook, missing certificates/platform tests are explicit blockers for affected claims, and stable core delivery is not confused with optional release readiness.

**Exit gate:** CI protects behavior, and distributed artifacts can be traced to the reviewed code and their actual signing/verification state.

## M11 — Validate, document, and release the agreed scope

- [ ] **M11.01 — Freeze an explicit candidate scope.** Record the candidate commit, included platforms/capabilities, required task IDs, approved deferrals, known limitations, and remaining verification. Separate web and native release claims when their readiness differs. **Done when:** the owner-agreed scope contains no unresolved blocker for its advertised capabilities, and no deferred task is presented as completed.

- [ ] **M11.02 — Perform acceptance checks against candidate artifacts.** Test the built web app at its actual Pages subpath, fresh and returning profiles, representative data, offline/update paths, and the supported desktop packages. Verify source revision/freshness rather than assuming the workflow deployed. **Done when:** acceptance evidence names the actual candidate artifacts and environments, including any explicitly unsupported platform.

- [ ] **M11.03 — Bring public documentation into agreement.** Update setup instructions, feature/parity tables, roadmap, troubleshooting, privacy/data-flow descriptions, source limitations, release formats, signing status, and migration notes. Explain secret-Gist limits and legacy-key handling without claiming a confirmed incident. **Done when:** a reader can distinguish implemented support, optional integration requirements, and future work without inspecting the code.

- [ ] **M11.04 — Validate the choice journey with users.** Run a small owner-approved usability pass focused on first choice, trusted constraints, importing games, understanding odds, and recovering from failure. Collect only necessary feedback without introducing hidden analytics. Triage observations into blockers, fixes, or future tasks. **Done when:** critical confusion and data-loss/correctness findings are resolved or explicitly reflected in the release scope.

- [ ] **M11.05 — Publish only with authorization and verify afterward.** After explicit approval, use the reviewed release process. Verify the deployed app and final downloadable assets, release notes, hashes, and available provenance. Record rollback information and the next maintenance tasks. **Done when:** the approved release is observable and verified; if publication is not authorized, leave this task blocked rather than claiming the release shipped.

**Closure rule:** complete only the owner-agreed release scope. Maintain all deferred or future work as visibly unfinished. Archive the verified milestone evidence, update the next active milestone, and retain stable IDs for subsequent continuation.

## 4. Verification commands and acceptance matrix

### Existing web commands at the inspected revision

Run from the repository root after selecting the compatible toolchain and inspecting scripts:

```bash
npm ci
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e:ci
```

`npm run ci:web` currently combines typecheck, build, and Chromium E2E. It does not represent every accessibility check in the GitHub workflow. `npm run fetch:data` accesses live providers and updates the dataset; run it deliberately for ingestion verification, not as a prerequisite for every local build. `npm run build:all` includes that live refresh and is not the deterministic build path. [S04, S16]

Browser downloads or system libraries may require an environment-specific setup step. Record unavailable dependencies instead of repeatedly retrying without a new hypothesis.

### Desktop baseline commands

Inspect the manifest, Cargo toolchain, and OS dependencies first:

```bash
cargo fmt --manifest-path apps/desktop/Cargo.toml --check
cargo check --manifest-path apps/desktop/Cargo.toml
cargo test --manifest-path apps/desktop/Cargo.toml
cargo check --manifest-path apps/desktop/Cargo.toml --features deep-shortcut-scan
```

Once the application's Cargo lockfile is deliberately established, use `--locked` for reproducible check/test/build jobs. Add appropriate lint and feature-test jobs after establishing the baseline. A command reporting zero tests is not proof of domain correctness. Compilation on one operating system does not establish GUI or scanning support on the others.

### Required scenario coverage

| Area | Minimum relevant scenarios |
|---|---|
| Selection | Empty/one/many games; same-title different IDs; cross-source duplicates; invalid/zero weights; current rotation nonzero; fractional motion profiles; repeated draws; immutable spin pool; matching pointer/result/history/odds. |
| Constraints | Unknown metadata; contradictory ranges; played/completed exclusion; exhausted cooldown; no-repeat policy; preset changes; transient source loss without preference reset. |
| Ingestion | Success, timeout, denial, rate limit, malformed payload, changed markup, suspicious empty parse, partial-source failure, cached fallback, currency ambiguity, atomic publication failure. |
| Persistence | Legacy versions, partial/corrupt records, quota denial, initialization race, reversible imports, restart, failed writes, bounded history, credential canaries. |
| Sync | Exact file missing, truncated content, expired token, incompatible schema, oversized payload, simultaneous edits, interruption, supported cross-client round trips, disconnect. |
| Desktop scan | Multiple roots, malformed manifests, permission denial, removed drives, duplicate installs, unusual filenames, symlink/junction bounds, cancellation, UI responsiveness, no path export. |
| PWA | First controlled online load, verified offline-ready reopen, network/HTTP error fallback, invalid data not cached, unrelated caches preserved, update acceptance/postponement, multiple tabs, rollback. |
| UX/release | Keyboard/screen reader, reduced/no motion, narrow/zoomed layout, English/Spanish, large library, fresh and upgraded installs, final artifact hash/provenance/signing truth. |

Choose performance budgets from measurements on documented fixtures/environments, then record the budgets before optimizing. Do not invent a responsiveness result, coverage percentage, successful CI run, or completed platform test.

## 5. First implementation sequence

Begin with M00.01 and the minimum baseline needed to reproduce a defect. Then implement M01.01–M01.03 as a focused credential-safety change, M01.04–M01.05 as a tested wheel-correctness change, and M01.06 as an independently testable cache-isolation change. Keep these changes reviewable rather than waiting for a large combined feature branch.

Complete the remaining M00 audit while those fixes establish the test foundation. Move into M02 contracts before broad library, filtering, or desktop parity work. A discovered crash, data-loss path, or secret leak may move ahead of the stated order; record why and continue with the highest-value unblocked task.

For already implemented tasks, verify against their acceptance criteria and record the evidence instead of rewriting working code. For partly implemented tasks, extend the existing path. Do not create a second framework or competing persistence system merely because the first is inconvenient to test.

## 6. Optional future backlog — not authorized by this plan

After the core release is reliable, evaluate explicit user demand for seedable/shareable wheel configurations, additional catalog providers, deeper launcher integrations, richer session preferences, and group-choice workflows. These are discovery candidates, not obligations to implement now.

Any seeded sharing feature needs canonical identity/order, versioned selection rules, reproducible random semantics, a bounded payload, and a preview of shared data. A link must never carry API keys, tokens, or private installation paths. Real-time rooms, mandatory hosted accounts, and a recommendation service require separate product, privacy, infrastructure, and maintenance decisions.

## 7. Initial handoff

**Completed implementation tasks:** None.  
**Source review:** Performed against the inspected revision above.  
**Runtime/build/test verification:** Not performed during plan preparation.  
**Repository changes made during preparation:** None.  
**Next task:** M00.01 — verify the checkout, preserve local changes, and adopt/reconcile this plan.  
**First implementation priority after the minimum baseline:** M01.01 — prevent credential-bearing portable snapshots.

## 8. Source map and external constraints

Repository observations refer to commit `3278b2a2ad100790a33368bafe93c1e97bc5e1d0`. Paths below are repository-relative. Revalidate them at execution time; path names in later tasks that do not yet exist are proposed outputs, not claims of existing implementation.

| Reference | Inspected source |
|---|---|
| S01 | `README.md` |
| S02 | `docs/roadmap.md` |
| S03 | `docs/desktop-ui-strategy.md` |
| S04 | `package.json` |
| S05 | `src/hooks/useGamePoolData.ts` |
| S06 | `src/hooks/useLibraryActions.ts` |
| S07 | `src/hooks/useCloudSnapshotBuilders.ts` |
| S08 | `src/lib/cloudSyncClient.ts` |
| S09 | `src/lib/wheel.ts` |
| S10 | `src/hooks/useSpinController.ts`, `src/components/Wheel.tsx` |
| S11 | `apps/desktop/src/engine.rs` |
| S12 | `apps/desktop/src/main.rs`, `apps/desktop/src/data.rs` — relevant inspected portions; full-file audit remains an execution task |
| S13 | `scripts/fetch-top-games.mjs` — relevant parsing, metadata, and fallback portions |
| S14 | `public/sw.js` |
| S15 | `tests/e2e/critical-flows.spec.ts`; repository tree also contains `tests/e2e/storage-migration.spec.ts` |
| S16 | `.github/workflows/web-ci.yml` |
| S17 | `.github/workflows/refresh-data.yml` |
| S18 | `.github/workflows/package-desktop.yml`; repository tree also contains separate desktop release workflows |
| S19 | `apps/desktop/Cargo.toml` and the recursive repository tree |
| S20 | GitHub repository/branch metadata for the baseline SHA and default branch |

Primary external documentation checked during preparation:

- GitHub Docs, **Creating gists**: secret Gists are not private; someone who discovers the URL can read them. Gists have revision history. Recheck the current privacy/security wording when updating the application disclosure.
- GitHub REST Docs, **Gists**: file content may be marked `truncated`; use the documented raw resource handling rather than assuming nonempty inline content is complete. Verify current API limits and supported concurrency behavior before implementing transport guarantees.
- Vite 7 Docs, **Migration guide**: the inspected Vite major requires Node 20.19+ or 22.12+, which is more specific than the README's generic Node 20+ prerequisite. Pin a presently supported compatible toolchain after checking the current dependency lock, not merely the minimum version.
- Valve Steamworks Docs, **IPlayerService / GetOwnedGames**: accessible game-detail information constrains returned library data. Visibility and credential failures must not be treated as proof of an empty owned library. A real supported import path still requires end-to-end verification.

These external constraints supplement the code review; they do not establish that an integration was exercised successfully or that an existing user's data was exposed.

Primary documentation locations (for the executing agent to verify):

```text
GitHub — Creating gists
https://docs.github.com/en/get-started/writing-on-github/editing-and-sharing-content-with-gists/creating-gists

GitHub REST — Gists
https://docs.github.com/en/rest/gists/gists

Vite 7 — Migration
https://v7.vite.dev/guide/migration

Valve — IPlayerService
https://partner.steamgames.com/doc/webapi/iplayerservice
```
