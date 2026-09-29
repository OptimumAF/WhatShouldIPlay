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

The committed feed without `schemaVersion` remains a supported legacy input. New payloads use `schemaVersion: 1`; an explicit unsupported version is rejected by the TypeScript and Rust decoders. Version 1 adds optional source-native `providerId`, `price: { amount, currency }` with a three-letter uppercase currency code, `metadataObservedAt`, and `lengthEstimate: { value, method, confidence }`. Each source's existing `fetchedAt` is its source-observation time. Missing price, free status, or length stays unknown. Legacy `priceUsd` and `estimatedLength` fields remain readable but do not acquire new provenance. A shared fixture verifies the wire fields and separate source observations in both in-memory client pools. The web price filter leaves a non-USD or conflicting-currency price unknown; it does not convert it. No measured-playtime claim is implied by a low-confidence genre heuristic.

The producer now writes version 1 when run. It interprets only supported USD/EUR Steam minor-unit prices, cross-checks a formatted total when provided, and leaves other or inconsistent currency amounts unknown. For itch.io, an unambiguous `$`/`€` listing is treated as the observed minimum price, a literal `Free` label supports free status, and missing or pay-what-you-want text stays unknown. Itch.io [documents prices as minimums](https://itch.io/docs/creators/pricing), even when buyers may pay more. Recognized genre signals produce only a low-confidence heuristic length; other genres leave length unknown. Fresh source fetches and metadata observations receive separate timestamps. A cached version-1 source keeps its original observation time; a legacy fallback loses old unsupported `priceUsd`, `isFree`, and `estimatedLength` assertions. The producer's offline entrypoint test validates a temporary emitted file with stubbed provider responses and never refreshes the committed feed. Publication quality checks remain M04.05, while filter/override policy remains M04.04. The Rust adapter retains decoded itch.io metadata; the desktop wheel's itch.io source support remains M06.05.

Portable source IDs use `steamcharts`, `steamdb`, `twitchmetrics`, `itchio`, `manual`, `scan`, and `steamImport`. Display labels such as “Steam Library” are UI text, not wire values. Portable spin history and source settings are validated against those IDs before a snapshot is applied. The feed's trend IDs report popularity observations; `steamImport` reports that a game appeared in a user's imported Steam library. Neither observation establishes a local installation. The web client represents installation as unknown. Desktop scan candidates now retain launcher and evidence kind in memory only; `scan` in local history means an unverified installation candidate. Launcher locations and scan evidence are not part of portable snapshots or saved history. The desktop UI journey for this contract remains unverified under M02.02b.
