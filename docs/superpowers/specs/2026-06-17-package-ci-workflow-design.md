# Design: Package CI workflow

**Date:** 2026-06-17
**Status:** Approved

## Problem

There is no CI that builds the distributable `.vsix` on regular pushes/PRs.
`release.yml` only builds it on version tags (attaching it to a GitHub
Release); `ci.yml` only lints/tests. We want a workflow that builds the package
on normal CI and uploads it as a downloadable workflow artifact.

## Design

A new workflow file `.github/workflows/package.yml` (a dedicated "Package"
workflow, matching the project's per-concern split: `ci`, `docs`, `release`).

### Triggers (mirroring `ci.yml`)

```yaml
on:
  push:
    branches: [master]
  pull_request:
    branches: [master]
  workflow_dispatch:
```

### Job `package` (ubuntu-latest)

1. `actions/checkout@v4`.
2. `actions/setup-node@v4` with `node-version: "20"` and `cache: "npm"`.
3. `npm ci`.
4. Derive the version from `package.json` into a step output, e.g.
   `VERSION=$(node -p "require('./package.json').version")` and
   `VSIX=vscode-ts-chef-${VERSION}.vsix` (same naming as `release.yml`).
5. Package: `npx --yes @vscode/vsce package --no-dependencies --out "$VSIX"`
   (identical to `release.yml`; `vsce` runs `vscode:prepublish` → `npm run build`
   first, so the bundle is produced).
6. `actions/upload-artifact@v4` with `name: vsix`, `path: <VSIX>`,
   `retention-days: 14` (matching `ci.yml`'s artifact retention).
7. A short `$GITHUB_STEP_SUMMARY` line noting the artifact name and size
   (`ls -lh`).

### Out of scope

- No GitHub Release creation (stays in `release.yml`).
- No separate lint/test gate (stays in `ci.yml`).
- No publish to the Marketplace.

## Verification

- The workflow YAML parses with a YAML parser (e.g. `node -e` + `js-yaml`,
  which is a dev dependency).
- The `vsce package` step mirrors the proven `release.yml` step and the local
  `npm run package` flow.
- (A GitHub Actions workflow cannot be unit-tested; correctness is validated by
  parse + parity with the existing working steps.)

## Non-goals

- Triggering on every branch (kept to master + PRs-to-master + manual, per
  `ci.yml`).
- Caching the built `dist/` between workflows.
