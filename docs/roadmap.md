# Product Roadmap

This roadmap tracks planned work for WhatShouldIPlay across web, desktop, and release engineering.

## Milestone: M1 Core UX Hardening (Target: March 2026)

Owner: `@OptimumAF`

- Accessibility pass (ARIA, keyboard flow, focus states, contrast review)
- Advanced filters (platform, genre/tags, release date, play session length)
- Improve wheel data quality and naming normalization consistency
- Add "exclude completed/played" controls

## Milestone: M2 Discovery and Integrations (Target: April 2026)

Owner: `@OptimumAF`

- Additional launcher/library integrations (Epic, GOG, Ubisoft, Xbox app)
- Additional trend/review sources for discovery
- Optional community sharing hooks (share result card, seedable wheel links)

## Milestone: M3 Accounts and Sync (Target: May 2026)

Owner: `@OptimumAF`

- Optional account model for web + desktop
- Cloud sync of presets, history, and source weights
- Session portability between web and desktop

## Milestone: M4 Release and Trust (Target: June 2026)

Owner: `@OptimumAF`

- Cross-platform desktop build artifacts (Windows/macOS/Linux)
- Installer packaging and release channel docs
- Artifact attestations/provenance
- Fully enabled signed desktop release pipeline

## Contribution Notes

- Use GitHub issues for roadmap work and link each issue to its milestone.
- Tag enhancement items with `enhancement` and `needs-design` until implementation starts.
- Keep PRs scoped to one roadmap item when possible.
- Use `Roadmap Feedback` issues and Discussions to feed prioritization updates.
- See `docs/feedback-loop.md` for feedback intake and triage cadence.
