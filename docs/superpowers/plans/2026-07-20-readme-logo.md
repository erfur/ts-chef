# README Logo Restoration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the blue product logo above the centered `vschef` README heading.

**Architecture:** Add the prior centered HTML image block back to the top of `README.md`, referencing the packaged `assets/logo.png`. Protect the reference with the existing package contribution test suite.

**Tech Stack:** Markdown, HTML, Jest, Node.js filesystem APIs

## Global Constraints

- Use `assets/logo.png` with alternative text `vschef logo` and width `120`.
- Do not change other README content or branding assets.

---

### Task 1: Restore README Logo

**Files:**
- Modify: `README.md:1`
- Modify: `test/packageContributions.test.ts`

**Interfaces:**
- Consumes: existing `assets/logo.png`
- Produces: a centered README image referencing `assets/logo.png`

- [ ] **Step 1: Add a failing README branding test**

Add imports and this test to `test/packageContributions.test.ts`:

```ts
const readme = fs.readFileSync(path.resolve(__dirname, "..", "README.md"), "utf8");

test("shows the packaged logo in the README", () => {
  expect(readme).toContain(
    '<img src="assets/logo.png" alt="vschef logo" width="120" />',
  );
});
```

- [ ] **Step 2: Verify the test fails**

Run: `npm test -- --runInBand test/packageContributions.test.ts`

Expected: FAIL because the README does not contain the logo image.

- [ ] **Step 3: Restore the centered image block**

Insert this block before the heading in `README.md`:

```html
<p align="center">
  <img src="assets/logo.png" alt="vschef logo" width="120" />
</p>

```

- [ ] **Step 4: Verify focused and full tests**

Run: `npm test -- --runInBand test/packageContributions.test.ts`

Expected: PASS with six tests.

Run: `npm test -- --runInBand`

Expected: PASS with all tests.

- [ ] **Step 5: Check the diff**

Run: `git diff --check`

Expected: exit 0 with no whitespace errors.
