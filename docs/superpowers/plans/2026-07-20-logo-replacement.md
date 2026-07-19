# Logo Replacement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package the supplied blue logo as the extension icon and the supplied monochrome logo as the activity-bar icon.

**Architecture:** Keep the original PNG files unchanged while moving them from the repository root into their runtime package locations. Update manifest references and packaging exclusions, then protect both paths with manifest tests and inspect the resulting VSIX.

**Tech Stack:** VS Code extension manifest, PNG assets, Jest, VSCE

## Global Constraints

- Preserve both supplied images as PNG files without redrawing or changing their texture.
- Do not alter sidebar views, extension behavior, or unrelated product imagery.
- Package the blue image as `assets/logo.png` and the monochrome image as `media/icon.png`.

---

### Task 1: Replace Packaged Branding Assets

**Files:**
- Move: `logo_256.png` to `assets/logo.png`
- Move: `logo_mono_256.png` to `media/icon.png`
- Delete: `media/icon.svg`
- Modify: `package.json:1-6,51-57`
- Modify: `.vscodeignore:45-46`
- Test: `test/packageContributions.test.ts`

**Interfaces:**
- Consumes: the supplied root-level `logo_256.png` and `logo_mono_256.png` files
- Produces: package manifest icon paths `assets/logo.png` and `media/icon.png`

- [ ] **Step 1: Extend the manifest test to require both PNG assets**

Replace the existing activity-bar icon test with:

```ts
test("contributes packaged extension and activity-bar icons", () => {
  const [sidebar] = pkg.contributes.viewsContainers.activitybar;

  expect(pkg.icon).toBe("assets/logo.png");
  expect(sidebar).toMatchObject({
    id: "vschef-sidebar",
    icon: "media/icon.png",
  });
  expect(fs.existsSync(path.resolve(__dirname, "..", pkg.icon))).toBe(true);
  expect(fs.existsSync(path.resolve(__dirname, "..", "media/icon.png"))).toBe(
    true,
  );
});
```

- [ ] **Step 2: Run the focused test and verify the new requirements fail**

Run: `npm test -- --runInBand test/packageContributions.test.ts`

Expected: FAIL because `pkg.icon` is absent and the PNG files are not yet at their package paths.

- [ ] **Step 3: Move the supplied assets into their package paths**

Move `logo_256.png` unchanged to `assets/logo.png`, move `logo_mono_256.png` unchanged to `media/icon.png`, and delete the temporary `media/icon.svg`. Use filesystem moves rather than re-encoding either image.

- [ ] **Step 4: Update manifest icon paths**

Add the top-level field after `version` in `package.json`:

```json
"icon": "assets/logo.png",
```

Change the activity-bar container icon to:

```json
"icon": "media/icon.png"
```

- [ ] **Step 5: Include only the extension logo from assets**

Change the asset section of `.vscodeignore` to:

```gitignore
# Assets: ship only the extension logo
assets/**
!assets/logo.png
```

- [ ] **Step 6: Run the focused test and verify it passes**

Run: `npm test -- --runInBand test/packageContributions.test.ts`

Expected: PASS with five tests.

- [ ] **Step 7: Verify project quality gates**

Run: `npm test -- --runInBand`

Expected: PASS with all test suites and tests passing.

Run: `npm run typecheck`

Expected: exit 0 with no TypeScript errors.

Run: `npm run lint`

Expected: exit 0 with no ESLint errors; existing warnings are permitted.

- [ ] **Step 8: Build and inspect the VSIX**

Run: `npm run package -- --no-yarn && unzip -l vschef-0.2.0.vsix`

Expected: package succeeds and the archive lists both `extension/assets/logo.png` and `extension/media/icon.png`.

- [ ] **Step 9: Commit the implementation**

```bash
git add .vscodeignore package.json test/packageContributions.test.ts assets/logo.png media/icon.png media/icon.svg docs/superpowers/specs/2026-07-20-logo-replacement-design.md docs/superpowers/plans/2026-07-20-logo-replacement.md
git commit -m "fix: restore extension branding icons"
```
