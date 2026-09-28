# Development Guide

## Prerequisites

- Node.js 22.23.3 from `.nvmrc` and npm 10.9.9
- Rust stable toolchain

## Install

```bash
npm ci
```

## Common Tasks

### Refresh source data (uses live providers and rewrites the dataset)

```bash
npm run fetch:data
```

### Run web app

```bash
npm run dev
```

### Web quality checks (use the committed dataset)

```bash
npm run ci:web
```

`ci:web` includes typecheck, unit tests, a build from committed data, and Chromium E2E. Run `npm run test:unit` alone for focused checks.

### Run desktop app

```bash
cd apps/desktop
cargo run --locked
```

## CI Expectations

Before opening a pull request:

- Run `npm run ci:web` against the committed dataset
- If desktop code changed, run `cargo fmt --check`, `cargo test --locked`, and `cargo build --locked` in `apps/desktop`

## Troubleshooting

- SteamDB fetch failures:
  - Expected occasionally due Cloudflare protections.
  - Script automatically falls back to Steam charts API.
- Stale data:
  - Re-run `npm run fetch:data` locally or trigger refresh workflow.
