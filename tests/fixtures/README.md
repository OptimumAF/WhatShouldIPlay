# Synthetic contract fixtures

All titles, IDs, URLs, and credential canaries here are invented. No fixture contains a user library or working credential.

- `top-games-identity.json` is a valid current top-games payload. Steam App ID 10101 appears in two sources under a casing alias; a different game with the same displayed title has App ID 20202. TwitchMetrics carries a retained observation with a synthetic fetch-failure note. Twitch and itch.io examples leave price/free metadata unknown.
- `selection-edge-cases.json` supplies future manual-entry IDs, expected provider keys, extreme but finite weights, and the exact four-sector nonzero-rotation case that exposed the M01.04 wheel error.
- `legacy-snapshot.json` represents a version-1 snapshot with synthetic credential fields at several levels. Its current tests verify migration strips those fields while retaining games.

The feed is parsed by TypeScript and Rust tests. The edge fixture drives a deterministic wheel test; the legacy fixture drives existing snapshot and Gist-boundary tests. M02.01 can reuse the duplicate-title and cross-source IDs as a red-to-green identity regression. The current application still stores manual games as names; fixture manual IDs are the intended contract case, not a claim that it already supports them.
