# WhatShouldIPlay

[![Deploy Web App](https://github.com/OptimumAF/WhatShouldIPlay/actions/workflows/deploy-pages.yml/badge.svg?branch=master)](https://github.com/OptimumAF/WhatShouldIPlay/actions/workflows/deploy-pages.yml)
[![Build Desktop App](https://github.com/OptimumAF/WhatShouldIPlay/actions/workflows/build-desktop.yml/badge.svg?branch=master)](https://github.com/OptimumAF/WhatShouldIPlay/actions/workflows/build-desktop.yml)
[![Web CI](https://github.com/OptimumAF/WhatShouldIPlay/actions/workflows/web-ci.yml/badge.svg?branch=master)](https://github.com/OptimumAF/WhatShouldIPlay/actions/workflows/web-ci.yml)

WhatShouldIPlay is an open source game-picker platform with:

- A GitHub Pages web app for spinning a wheel from live top-game sources and user-entered games
- A Rust + Dioxus desktop app with local game scanning and the same spin experience
- Automated data refresh and deployment workflows

Live site:

- https://optimumaf.github.io/WhatShouldIPlay/

## Features

- Multi-source pool support:
  - SteamCharts
  - SteamDB (with Steam charts API fallback)
  - TwitchMetrics
  - itch.io top rated
  - Manual game entry
  - Desktop-only local scan (Steam manifests + Epic manifests + common Epic/GOG/Ubisoft/Xbox install folders)
- Mode presets (`Balanced Mix`, `Quick Pick`, `No Repeats`, `Owned Focus`)
- Weighted wheel odds with per-source weighting controls
- Spin history + configurable cooldown to reduce immediate repeats
- Advanced filters (platform, tags, estimated length, release window, price)
- Steam account import using Steam Web API key + SteamID64
- Source-mix random wheel spin with animated result
- Winner popup celebration overlay with odds + source details in both web and desktop apps
- Optional cloud sync across devices via a user-provided secret GitHub Gist (unlisted, not private)
- Progressive Web App support (installable web app + offline shell cache)
- Optional web notifications for trend updates and spin reminders
- Multi-language web UI support (English and Spanish)
- Scheduled data refresh and deterministic static hosting

## Technology

- Web UI: React 19, TypeScript 5, Vite 7, TanStack Query, Zod
- Data ingestion: Node.js + Cheerio
- Desktop: Rust + Dioxus 0.7 + Reqwest + Scraper
- CI/CD: GitHub Actions + GitHub Pages

## Repository Layout

```text
.
├─ src/                      # Web app source
├─ public/data/              # Generated source dataset consumed by web app
├─ scripts/                  # Data ingestion/updater scripts
├─ apps/desktop/             # Rust + Dioxus desktop app
├─ .github/workflows/        # CI/CD automation
└─ docs/                     # Contributor and architecture documentation
```

## Getting Started

### Prerequisites

- Node.js 22.23.3 (see `.nvmrc`; Vite 7 requires at least Node 22.12 on this line)
- npm 10.9.9 (bundled with the pinned Node release)
- Rust toolchain (for desktop app only)

### Web App

```bash
npm ci
npm run dev
```

Build for production:

```bash
npm run build
```

### Desktop App

```bash
cd apps/desktop
cargo run --locked
```

Enable optional shortcut crawling scan:

```bash
cd apps/desktop
cargo run --locked --features deep-shortcut-scan
```

Configure Windows code-signing secrets for CI (requires a `.pfx` code-signing cert):

```powershell
.\scripts\set-windows-signing-secrets.ps1 -CertPath "C:\path\codesign.pfx" -CertPassword "your-password"
```

Release build:

```bash
cd apps/desktop
cargo build --locked --release
```

## NPM Scripts

- `npm run dev`: Start local web development server
- `npm run typecheck`: TypeScript type checking
- `npm run build`: Build web app
- `npm run fetch:data`: Refresh source data JSON
- `npm run build:all`: Refresh data and build web app
- `npm run test:unit`: Run pure TypeScript regression tests
- `npm run test:e2e:ci`: Run Chromium browser tests against a built `dist`
- `npm run ci:web`: Run web CI checks locally

`npm run fetch:data` and `npm run build:all` access live providers and rewrite the dataset. Use `npm run build` for a deterministic build from the committed `public/data/top-games.json`.

## Automation

- `refresh-data.yml`: Scheduled source data refresh every 6 hours
- `deploy-pages.yml`: Web build and Pages deploy on `master`
- `build-desktop.yml`: Windows/macOS/Linux desktop artifact builds on push/PR to `master`
- `package-desktop.yml`: Native desktop package build on version tags (`v*`) and manual runs, with packaged artifacts published to GitHub Releases on tags
- `release-desktop-signed.yml`: Enforced Windows signed release pipeline on version tags (`v*`)
- `web-ci.yml`: Web quality checks on push/PR

## Data Source Caveats

- SteamDB can block non-browser traffic via Cloudflare.
- The updater attempts direct SteamDB parsing first, then falls back to Steam charts API to maintain continuity.
- Browser environments cannot scan installed local games; local scan is desktop-only.

## Legacy sync data

Earlier versions could include a Steam API key in Gist sync snapshots and retain Steam/GitHub credentials in browser storage. The current local records are rewritten without those credentials when the app starts; imported games and IDs remain. If you used Gist sync with an earlier version, consider rotating the Steam API key. Updating the current Gist file does not remove older revisions, and this application does not delete remote Gist history. GitHub documents [Gist revision history](https://docs.github.com/en/get-started/writing-on-github/editing-and-sharing-content-with-gists/creating-gists). This is a precaution based on the old serialization path, not evidence that anyone accessed a key.

## Optional Gist sync privacy

The web app creates or updates `whatshouldiplay-sync.json` through `api.github.com` only when you choose a sync action. The snapshot includes settings, named profiles, manual and Steam-imported games and metadata, SteamID64, exclusions, notification preferences, and spin history. Credential fields are omitted. The GitHub token authenticates the API request and remains in page memory only; the Steam API key is also session-only. Reloading requires reentry. Gist ID and non-secret imported game data remain in local browser storage until changed or disconnected.

A secret Gist is unlisted, **not private**: anyone with its URL can read it. The app does not encrypt snapshots before upload. Disconnect clears the local token, Gist ID, and sync reference without deleting local games or remote Gist content. See [GitHub's Gist visibility guidance](https://docs.github.com/en/get-started/writing-on-github/editing-and-sharing-content-with-gists/creating-gists).

## Open Source Standards

- License: MIT
- Contributor Covenant code of conduct
- Standard issue and pull request templates
- Security disclosure policy
- Governance and support docs

See:

- [CONTRIBUTING.md](CONTRIBUTING.md)
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- [SECURITY.md](SECURITY.md)
- [SUPPORT.md](SUPPORT.md)
- [GOVERNANCE.md](GOVERNANCE.md)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/desktop-ui-strategy.md](docs/desktop-ui-strategy.md)
- [docs/component-system.md](docs/component-system.md)
- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)
- [docs/RELEASING.md](docs/RELEASING.md)
- [docs/feedback-loop.md](docs/feedback-loop.md)
