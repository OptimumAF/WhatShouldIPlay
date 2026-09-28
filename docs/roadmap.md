# Product Roadmap

This roadmap tracks planned work for WhatShouldIPlay across web, desktop, and release engineering.

**Current execution status (September 2026):** The March–June 2026 targets have elapsed. This roadmap records current scope and gaps without a replacement deadline. See the [living development plan](DEVELOPMENT_PLAN.md) for task gates and the [capability/parity audit](feature-parity.md) for client and verification status.

## Milestone: M1 Core UX Hardening — Partial

Owner: `@OptimumAF`

- Accessibility pass (ARIA, keyboard flow, focus states, contrast review)
- Advanced filters (platform, genre/tags, release date, play session length)
- Improve wheel data quality and naming normalization consistency
- Add "exclude completed/played" controls

The web controls exist, but metadata quality, canonical identity, focused exclusion tests, and desktop parity remain open (plan M02–M05 and M08).

## Milestone: M2 Discovery and Integrations — Partial

Owner: `@OptimumAF`

- Additional launcher/library integrations (Epic, GOG, Ubisoft, Xbox app)
- Additional trend/review sources for discovery
- Optional community sharing hooks (share result card, seedable wheel links)

Desktop scan code covers several launcher locations; actual scans are unverified. Extra discovery sources and shareable results are not implemented (plan M04–M05).

## Milestone: M3 Accounts and Sync — Partial web implementation

Owner: `@OptimumAF`

- Optional account model for web + desktop
- Cloud sync of presets, history, and source weights
- Session portability between web and desktop

The web app has local named profiles and optional secret-Gist sync code. A live sync round trip, desktop sync, cross-client portability, and a product account model are not verified or implemented. The core remains usable without an account (plan M01.03, M02, M06–M07).

## Milestone: M4 Release and Trust — Workflows present, release unverified

Owner: `@OptimumAF`

- Cross-platform desktop build artifacts (Windows/macOS/Linux)
- Installer packaging and release channel docs
- Artifact attestations/provenance
- Fully enabled signed desktop release pipeline

Windows, macOS, and Linux artifact workflows exist, but this branch has no hosted runs. Packaging and signing require separate validation; signing also requires owner-managed secrets and an owner-approved release (plan M10–M11).

## Contribution Notes

- Use GitHub issues for roadmap work and link each issue to its milestone.
- Tag enhancement items with `enhancement` and `needs-design` until implementation starts.
- Keep PRs scoped to one roadmap item when possible.
- Use `Roadmap Feedback` issues and Discussions to feed prioritization updates.
- See `docs/feedback-loop.md` for feedback intake and triage cadence.

## Decisions

- Desktop/web UI parity strategy is documented in `docs/desktop-ui-strategy.md`.
