# Releasing

## Web

Web deploy is automatic on push to `master` via `deploy-pages.yml`.

## Desktop

Desktop artifacts are produced for Windows, macOS, and Linux on push and pull
request to `master` by `build-desktop.yml`.

Each push to `master` also generates:

- `SHA256SUMS.txt` for artifact integrity checks.
- A GitHub artifact attestation (SLSA provenance) for the `.exe` and checksum file.

Native installer packaging is produced by `package-desktop.yml` on version tags
(`v*`) and manual runs:

- Windows: `.msi`
- Linux: `.deb`
- macOS: `.app.zip` (app bundle zipped for transport)

Signed Windows release publishing is handled by `release-desktop-signed.yml`
on version tags (`v*`). It requires:

- `WINDOWS_CERT_BASE64` secret
- `WINDOWS_CERT_PASSWORD` secret

The workflow will fail early if these secrets are missing to avoid unsigned
production releases.

For tagged releases:

1. Update `CHANGELOG.md`.
2. Create and push a version tag:

```bash
git tag v0.1.0
git push origin v0.1.0
```

3. Create a GitHub Release and attach workflow artifacts if needed.

4. Verify artifact integrity and provenance before distribution:

```bash
gh attestation verify <artifact-path-or-uri> --repo OptimumAF/WhatShouldIPlay
```
