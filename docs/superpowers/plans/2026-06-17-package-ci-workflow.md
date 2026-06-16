# Package CI Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a GitHub Actions workflow that builds the extension `.vsix` on push/PR to master (and on demand) and uploads it as a downloadable workflow artifact.

**Architecture:** A new `.github/workflows/package.yml` ("Package" workflow) mirroring the conventions in `ci.yml` (Node 20, npm cache, master + PR + `workflow_dispatch`) and the VSIX build in `release.yml` (`npx @vscode/vsce package --no-dependencies`), but uploading via `actions/upload-artifact@v4` instead of creating a Release.

**Tech Stack:** GitHub Actions, `@vscode/vsce`, Node 20.

---

## File Structure

- **Create** `.github/workflows/package.yml` — the Package workflow.

(No source/test changes; a workflow can't be unit-tested — it's validated by YAML parse + parity with the existing `ci.yml`/`release.yml` steps.)

---

## Task 1: Add the Package workflow

**Files:**
- Create: `.github/workflows/package.yml`

- [ ] **Step 1: Create the workflow**

Create `.github/workflows/package.yml` with exactly:
```yaml
name: Package

on:
  push:
    branches:
      - master
  pull_request:
    branches:
      - master
  workflow_dispatch:

jobs:
  package:
    name: Build & upload VSIX
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Resolve VSIX name
        id: vsix
        run: |
          VERSION=$(node -p "require('./package.json').version")
          echo "name=vscode-ts-chef-${VERSION}.vsix" >> "$GITHUB_OUTPUT"

      - name: Package VSIX
        run: |
          npx --yes @vscode/vsce package \
            --no-dependencies \
            --out "${{ steps.vsix.outputs.name }}"

      - name: Upload VSIX artifact
        uses: actions/upload-artifact@v4
        with:
          name: vsix
          path: ${{ steps.vsix.outputs.name }}
          retention-days: 14

      - name: Job Summary
        run: |
          echo "## Package" >> "$GITHUB_STEP_SUMMARY"
          echo "Built and uploaded \`${{ steps.vsix.outputs.name }}\` as artifact **vsix**." >> "$GITHUB_STEP_SUMMARY"
          echo '```' >> "$GITHUB_STEP_SUMMARY"
          ls -lh "${{ steps.vsix.outputs.name }}" >> "$GITHUB_STEP_SUMMARY" || true
          echo '```' >> "$GITHUB_STEP_SUMMARY"
```

- [ ] **Step 2: Verify the YAML parses and has the expected shape**

Run (uses the `js-yaml` dev dependency):
```
node -e "const y=require('js-yaml').load(require('fs').readFileSync('.github/workflows/package.yml','utf8')); const j=y.jobs.package; const steps=j.steps.map(s=>s.uses||s.name); console.log('name:', y.name); console.log('triggers:', Object.keys(y.on).join(',')); console.log('runs-on:', j['runs-on']); console.log('has upload-artifact:', steps.some(s=>String(s).includes('upload-artifact'))); console.log('has vsce package step:', j.steps.some(s=>String(s.run||'').includes('vsce package')));"
```
Expected:
- `name: Package`
- `triggers: push,pull_request,workflow_dispatch`
- `runs-on: ubuntu-latest`
- `has upload-artifact: true`
- `has vsce package step: true`

- [ ] **Step 3: Confirm the other workflows are untouched**

Run: `git status --short .github/workflows/`
Expected: only `?? .github/workflows/package.yml` (ci.yml / docs.yml / release.yml unchanged).

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/package.yml
git commit -m "ci: add workflow to build and upload the VSIX artifact"
```

---

## Task 2: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Re-confirm parse + tree**

Run:
```
node -e "require('js-yaml').load(require('fs').readFileSync('.github/workflows/package.yml','utf8')); console.log('package.yml parses')"
ls .github/workflows/
git status --short
```
Expected: `package.yml parses`; the workflows dir lists `ci.yml docs.yml package.yml release.yml`; working tree clean (no uncommitted changes; if `src/generated/opsRegistry.ts` is dirty from an unrelated build, restore it: `git restore src/generated/opsRegistry.ts`).

- [ ] **Step 2: Sanity-check the package command matches what works locally**

Confirm the workflow's package invocation matches the proven `release.yml` step and the local `npm run package` flow:
```
grep -n "vsce package" .github/workflows/package.yml .github/workflows/release.yml
```
Expected: both files invoke `@vscode/vsce package --no-dependencies`.

---

## Self-Review

**Spec coverage:**
- New `.github/workflows/package.yml`, triggers = master push + PR + workflow_dispatch → Task 1 ✓
- Node 20 + npm cache; `npm ci`; version-derived VSIX name; `vsce package --no-dependencies --out`; `upload-artifact@v4` (name `vsix`, retention 14); job summary → Task 1 ✓
- No Release, no test/lint gate (out of scope) → not included ✓
- Verification by YAML parse + parity with existing steps → Tasks 1 & 2 ✓

**Placeholder scan:** No TBD/TODO; the complete workflow YAML is given.

**Consistency:** Triggers and Node setup mirror `ci.yml`; the `vsce package --no-dependencies --out "<VSIX>"` step and the `vscode-ts-chef-<version>.vsix` naming mirror `release.yml`. `js-yaml` (used by the parse check) is an existing dependency.
