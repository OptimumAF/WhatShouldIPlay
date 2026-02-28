# WhatShouldIPlay

WhatShouldIPlay includes:

- A **GitHub Pages web app** that loads top games from SteamCharts, SteamDB/Steam API fallback, and TwitchMetrics.
- A **Rust + Dioxus desktop app** that does the same and can also scan your computer for installed games.
- A **spin-the-wheel animation** that picks what to play next.

## Stack

- Web: React 19, TypeScript 5, Vite 7, TanStack Query 5, Zod 4
- Data pipeline: Node.js + Cheerio
- Desktop: Rust + Dioxus 0.7 + Reqwest + Scraper

## Quick Start (Web)

```bash
npm install
npm run fetch:data
npm run dev
```

Build for production:

```bash
npm run build:all
```

## Desktop App

Desktop source lives in `apps/desktop`.

Run locally (after Rust install):

```bash
cd apps/desktop
cargo run
```

Build release binary:

```bash
cd apps/desktop
cargo build --release
```

## GitHub Actions

- `.github/workflows/refresh-data.yml`
  - Refreshes `public/data/top-games.json` every 6 hours.
- `.github/workflows/deploy-pages.yml`
  - Builds and deploys the web app to GitHub Pages.
- `.github/workflows/build-desktop.yml`
  - Builds the desktop executable on Windows and uploads artifact.

## Notes

- SteamDB is often protected by Cloudflare. The updater attempts direct SteamDB first, then falls back to Steam's public charts API.
- Browser apps cannot directly scan installed games; desktop scanning is available in the Dioxus app.
