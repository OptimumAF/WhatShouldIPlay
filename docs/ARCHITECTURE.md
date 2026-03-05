# Architecture

## Overview

WhatShouldIPlay is a monorepo with two runtime targets, a shared data pipeline, and shared data contracts:

- Web app (`src/`) served as static assets on GitHub Pages
- Desktop app (`apps/desktop/`) built with Rust + Dioxus
- Source ingestion script (`scripts/fetch-top-games.mjs`) generating static JSON consumed by web
- Shared contract definitions (`contracts/`, `src/contracts/`, `apps/desktop/src/contracts.rs`)

## System Components

### 1. Data Ingestion

- Script: `scripts/fetch-top-games.mjs`
- Output: `public/data/top-games.json`
- Sources:
  - SteamCharts (HTML parse)
  - SteamDB (direct parse attempt)
  - Steam charts API fallback when SteamDB is blocked
  - TwitchMetrics (HTML parse)
- Contract:
  - Canonical schema: `contracts/top-games.schema.json`
  - TypeScript contract implementation: `src/contracts/topGamesContract.ts`
  - Rust contract implementation: `apps/desktop/src/contracts.rs`

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
- Online source loading strategy:
  - first attempt shared top-games contract feed
  - fallback to direct scraping + Steam API fallback when needed

### 4. UI Parity Strategy

- Current strategy: dual implementation (React web + Dioxus desktop) with shared behavior contracts.
- Strategy document: `docs/desktop-ui-strategy.md`

### 5. Web Component System

- Current strategy: Radix UI primitives with custom design tokens.
- Strategy document: `docs/component-system.md`

## Deployment Model

- Web deploy: GitHub Actions workflow builds and deploys static `dist/` to Pages
- Data refresh: scheduled workflow updates `public/data/top-games.json` every 6 hours
- Desktop artifact: Windows workflow builds release executable and uploads artifact

## Reliability Considerations

- Source parsing is resilient to transient failures:
  - per-source fallback to existing cached data where applicable
  - SteamDB fallback to Steam charts API
- Static serving avoids backend operational cost and availability risk
