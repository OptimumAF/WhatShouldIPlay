# Architecture

## Overview

WhatShouldIPlay is a monorepo with two runtime targets and one shared data pipeline:

- Web app (`src/`) served as static assets on GitHub Pages
- Desktop app (`apps/desktop/`) built with Rust + Dioxus
- Source ingestion script (`scripts/fetch-top-games.mjs`) generating static JSON consumed by web

## System Components

### 1. Data Ingestion

- Script: `scripts/fetch-top-games.mjs`
- Output: `public/data/top-games.json`
- Sources:
  - SteamCharts (HTML parse)
  - SteamDB (direct parse attempt)
  - Steam charts API fallback when SteamDB is blocked
  - TwitchMetrics (HTML parse)

### 2. Web Application

- Entry: `src/main.tsx`
- Root UI: `src/App.tsx`
- Wheel rendering: `src/components/Wheel.tsx`
- Static data load: `public/data/top-games.json`

### 3. Desktop Application

- Entry: `apps/desktop/src/main.rs`
- Dioxus UI for:
  - online source fetch
  - manual list
  - local game scan
  - wheel and winner presentation

### 4. UI Parity Strategy

- Current strategy: dual implementation (React web + Dioxus desktop) with shared behavior contracts.
- Strategy document: `docs/desktop-ui-strategy.md`

## Deployment Model

- Web deploy: GitHub Actions workflow builds and deploys static `dist/` to Pages
- Data refresh: scheduled workflow updates `public/data/top-games.json` every 6 hours
- Desktop artifact: Windows workflow builds release executable and uploads artifact

## Reliability Considerations

- Source parsing is resilient to transient failures:
  - per-source fallback to existing cached data where applicable
  - SteamDB fallback to Steam charts API
- Static serving avoids backend operational cost and availability risk
