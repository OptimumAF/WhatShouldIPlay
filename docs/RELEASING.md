# Releasing

## Web

Web deploy is automatic on push to `master` via `deploy-pages.yml`.

## Desktop

Desktop artifacts are produced for Windows, macOS, and Linux on push and pull
request to `master` by `build-desktop.yml`.

Each push to `master` also generates:

- `SHA256SUMS.txt` for artifact integrity checks.
- A GitHub artifact attestation (SLSA provenance) for the `.exe` and checksum file.

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
