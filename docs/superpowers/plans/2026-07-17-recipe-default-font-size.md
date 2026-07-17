# Recipe Default Font Size Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every field in the Recipe webview use VS Code's configured default font family and size.

**Architecture:** Keep typography in `RecipeViewProvider`'s existing embedded stylesheet. Establish the VS Code font size on `body`, explicitly inherit body typography in native form controls, and remove argument-specific hard-coded sizes.

**Tech Stack:** TypeScript, VS Code WebviewView HTML/CSS, Jest, ts-jest.

## Global Constraints

- Apply the configured default typography to the recipe name, step text, argument labels, argument inputs and selects, and action buttons.
- Do not change colors, spacing, layout, interactions, or webview message flow.
- Do not add dependencies or compatibility code.

---

### Task 1: Inherit VS Code Typography Throughout the Recipe View

**Files:**
- Modify: `test/commands/recipeViewProvider.test.ts:65-73`
- Modify: `src/providers/recipeViewProvider.ts:89-163`

**Interfaces:**
- Consumes: VS Code webview CSS custom properties `--vscode-font-family` and `--vscode-font-size`.
- Produces: Generated Recipe webview HTML whose body uses VS Code's default typography and whose `input`, `select`, and `button` controls inherit it.

- [ ] **Step 1: Write the failing stylesheet regression test**

Add this test after the existing `resolveWebviewView` rendering test in `test/commands/recipeViewProvider.test.ts`:

```ts
  test("uses VS Code default typography for all recipe fields", () => {
    const { v } = setup();

    expect(v.webview.html).toContain(
      "font-size: var(--vscode-font-size);",
    );
    expect(v.webview.html).toMatch(
      /input,\s*select,\s*button\s*{\s*font: inherit;/,
    );
    expect(v.webview.html).not.toContain("font-size: 11px;");
  });
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run:

```bash
npx jest test/commands/recipeViewProvider.test.ts --runInBand
```

Expected: FAIL in `uses VS Code default typography for all recipe fields` because the HTML lacks `var(--vscode-font-size)` and `font: inherit`, and still contains `font-size: 11px`.

- [ ] **Step 3: Implement inherited default typography**

In `src/providers/recipeViewProvider.ts`, update the start of the embedded stylesheet to include the default size and a shared form-control inheritance rule:

```css
      body {
        color: var(--vscode-foreground);
        font-family: var(--vscode-font-family);
        font-size: var(--vscode-font-size);
        padding: 0;
        margin: 0;
      }
      input,
      select,
      button {
        font: inherit;
      }
```

Remove `font-size: 11px;` from both `.arg-label` and the shared `.arg-row` text/number/select rule. Leave all other declarations unchanged.

- [ ] **Step 4: Run the focused test to verify it passes**

Run:

```bash
npx jest test/commands/recipeViewProvider.test.ts --runInBand
```

Expected: PASS with all tests in `recipeViewProvider.test.ts` passing.

- [ ] **Step 5: Run static verification**

Run:

```bash
npm run typecheck
npx prettier --check src/providers/recipeViewProvider.ts test/commands/recipeViewProvider.test.ts
npx eslint src/providers/recipeViewProvider.ts test/commands/recipeViewProvider.test.ts
```

Expected: all three commands exit successfully with no type, formatting, or lint errors.

- [ ] **Step 6: Commit the implementation**

Stage only the two implementation files, leaving unrelated worktree changes untouched:

```bash
git add src/providers/recipeViewProvider.ts test/commands/recipeViewProvider.test.ts
git commit -m "fix: use default font size in recipe view"
```
