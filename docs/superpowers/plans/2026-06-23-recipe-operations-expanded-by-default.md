# Recipe Operations Expanded By Default Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render argument-bearing operations expanded by default in the Recipe pane.

**Architecture:** The Recipe webview already owns presentation state for expanded rows. Change the embedded render logic so `open` is derived from `hasArgs`, not from a mutable expansion set, and update the provider unit test to cover the generated script.

**Tech Stack:** TypeScript, VS Code WebviewViewProvider, Jest.

## Global Constraints

- Modify only `src/providers/recipeViewProvider.ts` and `test/commands/recipeViewProvider.test.ts` for implementation.
- Do not change saved recipe data, pipeline execution, or operation argument definitions.
- Keep operations without arguments collapsed as plain rows with no argument editor.

---

### Task 1: Always Expand Recipe Operation Arguments

**Files:**
- Modify: `test/commands/recipeViewProvider.test.ts`
- Modify: `src/providers/recipeViewProvider.ts`

**Interfaces:**
- Consumes: `RecipeViewProvider.resolveWebviewView(view: vscode.WebviewView): void`
- Produces: Generated webview HTML where the script contains `const open = hasArgs;`

- [ ] **Step 1: Write the failing test**

Add this test inside `describe("RecipeViewProvider", () => { ... })` in `test/commands/recipeViewProvider.test.ts`:

```ts
  test("renders argument-bearing steps open by default", () => {
    const { v } = setup();
    expect(v.webview.html).toContain("const open = hasArgs;");
    expect(v.webview.html).not.toContain("const open = expanded.has(i);");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --runTestsByPath test/commands/recipeViewProvider.test.ts --runInBand`

Expected: FAIL because `const open = expanded.has(i);` still exists and `const open = hasArgs;` does not.

- [ ] **Step 3: Write minimal implementation**

In `src/providers/recipeViewProvider.ts`, change the webview script inside `render()` from:

```js
          const hasArgs = argDefs(s.opName).length > 0;
          const open = expanded.has(i);
```

to:

```js
          const hasArgs = argDefs(s.opName).length > 0;
          const open = hasArgs;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --runTestsByPath test/commands/recipeViewProvider.test.ts --runInBand`

Expected: PASS.

- [ ] **Step 5: Run broader verification**

Run: `npm test -- --runInBand`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/specs/2026-06-23-recipe-operations-expanded-by-default-design.md docs/superpowers/plans/2026-06-23-recipe-operations-expanded-by-default.md test/commands/recipeViewProvider.test.ts src/providers/recipeViewProvider.ts
git commit -m "feat: expand recipe operations by default"
```

## Self-Review

- Spec coverage: Task 1 covers the requested default expansion behavior and leaves persistence/execution unchanged.
- Placeholder scan: No placeholders remain.
- Type consistency: No public TypeScript interfaces change.
