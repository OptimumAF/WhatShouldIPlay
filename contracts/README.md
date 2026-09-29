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

The committed feed without `schemaVersion` remains a supported legacy input. New payloads use `schemaVersion: 1`; an explicit unsupported version is rejected by the TypeScript and Rust decoders. Version 1 adds optional source-native `providerId`, `price: { amount, currency }` with a three-letter uppercase currency code, `metadataObservedAt`, and `lengthEstimate: { value, method, confidence }`. Each source's existing `fetchedAt` is its source-observation time. Missing price, free status, or length stays unknown. Legacy `priceUsd` and `estimatedLength` fields remain readable but do not acquire new provenance. These fields are verified at the wire boundary with a shared synthetic fixture; producer output and client-pool propagation are still M02.03b work. No currency conversion or measured-playtime claim is implied by a low-confidence genre heuristic.

Portable source IDs use `steamcharts`, `steamdb`, `twitchmetrics`, `itchio`, `manual`, `scan`, and `steamImport`. Display labels such as “Steam Library” are UI text, not wire values. Portable spin history and source settings are validated against those IDs before a snapshot is applied. The feed's trend IDs report popularity observations; `steamImport` reports that a game appeared in a user's imported Steam library. Neither observation establishes a local installation. The web client represents installation as unknown. Desktop scan candidates now retain launcher and evidence kind in memory only; `scan` in local history means an unverified installation candidate. Launcher locations and scan evidence are not part of portable snapshots or saved history. The desktop UI journey for this contract remains unverified under M02.02b.
