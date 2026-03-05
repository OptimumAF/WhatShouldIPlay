# Shared Data Contracts

This directory contains language-neutral schemas for payloads used across the web and desktop apps.

## Contracts

- `top-games.schema.json`: canonical shape for the `top-games.json` payload.

## Implementations

- Web TypeScript/Zod implementation:
  - `src/contracts/topGamesContract.ts`
- Desktop Rust implementation:
  - `apps/desktop/src/contracts.rs`

Both implementations intentionally mirror this schema so the payload format is unified across targets.
