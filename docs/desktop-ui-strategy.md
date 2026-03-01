# Desktop UI Strategy

Last updated: 2026-03-01

## Decision

WhatShouldIPlay will use a **dual implementation strategy** for the UI through 2026:

- Web app: React + TypeScript (`src/`)
- Desktop app: Dioxus + Rust (`apps/desktop/`)

The project will not migrate to a single shared UI runtime in 2026.

## Why this approach

- The desktop app already uses native Rust integrations for library scanning and local filesystem access.
- A full shared-UI migration (for example to a WebView shell with React) would add platform packaging and runtime complexity while the product is still expanding core features.
- Current team bandwidth favors feature delivery and release hardening over a full renderer migration.

## How parity is maintained

- Shared product behavior:
  - Same wheel rules (weights, cooldown, winner handling)
  - Same source defaults and preset intent
  - Same major UX patterns (content-first layout, collapsible settings)
- Shared data contracts:
  - Cloud snapshot structure is treated as canonical contract between clients.
  - Contract updates require backward-compatible parsing and migration handling.
- Shared design direction:
  - Token-based spacing/typography/color model on both clients.
  - Platform-specific desktop styling overlays for Windows/macOS/Linux.

## Guardrails

- New feature PRs that affect selection logic must update both clients in the same milestone.
- If parity intentionally diverges, record it in `docs/roadmap.md` with rationale.
- No breaking cloud snapshot changes without schema migration logic.

## Re-evaluation trigger

Revisit shared-UI migration only when all conditions are true:

- Desktop packaging/signing pipeline is stable across supported OS targets.
- Core feature velocity slows enough to absorb migration cost.
- Maintenance burden of dual UI exceeds agreed threshold (tracked in roadmap triage).

Target review window: Q1 2027.
