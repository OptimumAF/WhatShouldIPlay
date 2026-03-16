# PickAGame Desktop (Dioxus)

This app can:

- Load online top games from SteamCharts, SteamDB/Steam API fallback, and TwitchMetrics.
- Import owned games from Steam account (Steam Web API key + SteamID64).
- Add manual game lists.
- Scan local machine game hints from:
  - Steam manifests
  - Epic Games Launcher manifests (`ProgramData\\Epic\\...\\Manifests`)
  - Common install folders (Epic, GOG, Ubisoft, Xbox app paths, and `C:\\Games`)
- Apply mode presets, weighted odds, and cooldown anti-repeat behavior.
- Track spin history and show richer winner details.
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

## Native Packaging (CI)

Version tags (`v*`) and manual workflow runs execute `.github/workflows/package-desktop.yml`
to produce native desktop packages:

- Windows portable `.exe`
- Linux `.deb`
- macOS `.app.zip`

## Optional: Enable CI Code Signing

From repo root, set GitHub Action secrets using your `.pfx` cert:

```powershell
.\scripts\set-windows-signing-secrets.ps1 -CertPath "C:\path\codesign.pfx" -CertPassword "your-password"
```
