# Development Guide

## Prerequisites

- Node.js 20+
- npm 10+
- Rust stable toolchain

## Install

```bash
npm install
```

## Common Tasks

### Refresh source data

```bash
npm run fetch:data
```

### Run web app

```bash
npm run dev
```

### Web quality checks

```bash
npm run ci:web
```

### Run desktop app

```bash
cd apps/desktop
cargo run
```

## CI Expectations

Before opening a pull request:

- Run `npm run ci:web`
- If desktop code changed, run `cargo build` in `apps/desktop`

## Troubleshooting

- SteamDB fetch failures:
  - Expected occasionally due Cloudflare protections.
  - Script automatically falls back to Steam charts API.
- Stale data:
  - Re-run `npm run fetch:data` locally or trigger refresh workflow.

