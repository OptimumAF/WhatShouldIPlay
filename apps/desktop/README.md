# PickAGame Desktop (Dioxus)

This app can:

- Load online top games from SteamCharts, SteamDB/Steam API fallback, and TwitchMetrics.
- Add manual game lists.
- Scan local machine game hints from:
  - Steam manifests
  - Common install folders (Epic/GOG/XboxGames/Games)
- Spin a wheel and pick what game to play.

By default, shortcut crawling is disabled to reduce antivirus false-positive risk.
If you explicitly want shortcut scanning, build with:

```bash
cargo run --features deep-shortcut-scan
```

## Run

```bash
cargo run
```

## Build

```bash
cargo build --release
```

## Optional: Enable CI Code Signing

From repo root, set GitHub Action secrets using your `.pfx` cert:

```powershell
.\scripts\set-windows-signing-secrets.ps1 -CertPath "C:\path\codesign.pfx" -CertPassword "your-password"
```
