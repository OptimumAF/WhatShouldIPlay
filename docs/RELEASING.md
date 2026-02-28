# Releasing

## Web

Web deploy is automatic on push to `master` via `deploy-pages.yml`.

## Desktop

Desktop `.exe` artifacts are produced on push and pull request to `master`
by `build-desktop.yml`.

For tagged releases:

1. Update `CHANGELOG.md`.
2. Create and push a version tag:

```bash
git tag v0.1.0
git push origin v0.1.0
```

3. Create a GitHub Release and attach workflow artifacts if needed.

