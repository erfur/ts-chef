# Recipe Toggle String Use Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show and support the existing **Use selection** action for recipe `toggleString` arguments while preserving their selected encoding.

**Architecture:** Keep the existing `useSelection` webview message and click-time host callback. Extend only the recipe renderer and provider validation/update logic: `string` remains a direct value, while `toggleString` updates `{ string, option }` without changing `option`.

**Tech Stack:** TypeScript, VS Code webview APIs, Jest, jsdom

## Global Constraints

- Render **Use selection** only for plain `string` and `toggleString` arguments.
- Place the `toggleString` button immediately after its text input and before its encoding selector.
- Preserve the current `toggleString.option` when assigning selected text.
- Missing editors, empty selections, stale indexes, and all other argument types remain silent no-ops.
- Do not change the webview message shape, editor selection callback, Pipeline Editor, or generated files.
- Preserve the unrelated existing modification to `src/generated/opsRegistry.ts` and do not stage it.

---

### Task 1: Support Selection Assignment for Toggle Strings

**Files:**
- Modify: `test/commands/recipeViewProvider.test.ts`
- Modify: `src/providers/recipeViewProvider.ts`

**Interfaces:**
- Consumes: existing webview message `{ type: "useSelection", step: number, arg: number }` and `RecipeCallbacks.getSelection: () => string | undefined`.
- Produces: `toggleString` recipe argument values shaped as `{ string: string; option: unknown }`, preserving the prior `option`.

- [ ] **Step 1: Write failing rendering and assignment tests**

In `test/commands/recipeViewProvider.test.ts`, replace the rendering eligibility test with:

```ts
test("renders use-selection beside string and toggleString arguments", () => {
  const { v } = setup();
  const { dom } = renderRecipeDom(v.webview.html);

  const buttons = dom.window.document.querySelectorAll("[data-use-selection]");
  expect(buttons).toHaveLength(2);
  expect(buttons[0].closest(".arg-row")?.textContent).toContain("Value");
  expect(buttons[1].closest(".arg-row")?.textContent).toContain("Alphabet");

  const alphabetRow = buttons[1].closest(".arg-row");
  expect(alphabetRow?.querySelector('input[type="text"] + button + select')).not.toBeNull();

  const separatorRow = Array.from(
    dom.window.document.querySelectorAll(".arg-row"),
  ).find((row) => row.textContent?.includes("Separator"));
  expect(separatorRow?.querySelector('input[type="text"]')).not.toBeNull();
  expect(separatorRow?.querySelector("[data-use-selection]")).toBeNull();
});
```

Add this provider test after the existing plain-string assignment test:

```ts
test("assigns selection to toggleString while preserving its encoding", async () => {
  const { v, onMessage, getSelection } = setup("selected key");
  const steps = [
    {
      opName: "FromBase64",
      args: ["old", { string: "old key", option: "UTF8" }, ""],
    },
  ];
  await onMessage({ type: "edit", name: "decode", steps });
  v.webview.postMessage.mockClear();

  await onMessage({ type: "useSelection", step: 0, arg: 1 });

  expect(getSelection).toHaveBeenCalledTimes(1);
  expect(steps[0].args[1]).toEqual({
    string: "selected key",
    option: "UTF8",
  });
  expect(v.webview.postMessage).toHaveBeenCalledWith({
    type: "state",
    recipe: { name: "decode", steps },
    defs: { FromBase64: ARG_DEFS },
  });
});
```

Update the invalid-target table so `toggleString` is no longer considered invalid:

```ts
test.each([
  { step: 2, arg: 0 },
  { step: 0, arg: 2 },
])("ignores invalid or ineligible target $step:$arg", async (target) => {
```

- [ ] **Step 2: Run the focused test and verify the new cases fail**

Run:

```bash
npx jest test/commands/recipeViewProvider.test.ts --runInBand
```

Expected: FAIL because only one selection button renders and `useSelection` rejects the `toggleString` target.

- [ ] **Step 3: Render the button between the toggle text input and encoding selector**

In the `case "toggleString"` markup in `src/providers/recipeViewProvider.ts`, replace the `input` construction with:

```js
input =
  '<input type="text" value="' +
  escAttr(strVal) +
  '" data-arg="' +
  ai +
  '" data-type="toggleString" data-subfield="string">' +
  '<button type="button" class="use-selection" data-use-selection data-arg="' +
  ai +
  '" title="Use current editor selection">Use selection</button>' +
  '<select data-arg="' +
  ai +
  '" data-type="toggleString" data-subfield="option">' +
  encOpts +
  "</select>";
```

- [ ] **Step 4: Accept toggle strings and preserve their encoding**

In the `useSelection` message case in `src/providers/recipeViewProvider.ts`, replace its type guard and assignment with:

```ts
if (
  !step ||
  (argDef?.type !== "string" && argDef?.type !== "toggleString")
)
  break;
const selection = this.callbacks.getSelection();
if (!selection) break;
if (!Array.isArray(step.args)) step.args = [];
if (argDef.type === "toggleString") {
  const current = step.args[msg.arg!] as
    | { option?: unknown }
    | string
    | undefined;
  step.args[msg.arg!] = {
    string: selection,
    option:
      current && typeof current === "object"
        ? current.option
        : (argDef.toggleValues?.[0] ?? "Hex"),
  };
} else {
  step.args[msg.arg!] = selection;
}
this.postState();
```

This fallback matches the existing `toggleString` input-update behavior when a legacy scalar value has no encoding object. Existing object values keep their current `option` unchanged.

- [ ] **Step 5: Run the focused test and verify it passes**

Run:

```bash
npx jest test/commands/recipeViewProvider.test.ts --runInBand
```

Expected: PASS for all tests in `recipeViewProvider.test.ts`.

- [ ] **Step 6: Run full verification**

Run:

```bash
npm run typecheck
npx eslint src/providers/recipeViewProvider.ts test/commands/recipeViewProvider.test.ts
npm test -- --runInBand
```

Expected: typecheck and scoped lint exit 0; Jest reports 79 passing suites and 0 failures. Repository-wide lint is excluded because its existing baseline contains unrelated errors.

- [ ] **Step 7: Review and commit the implementation**

Inspect `git status`, `git diff`, and `git log --oneline -10`. Confirm that only the provider and its test are staged and that `src/generated/opsRegistry.ts` remains unstaged. Then commit:

```bash
git add src/providers/recipeViewProvider.ts test/commands/recipeViewProvider.test.ts
git commit -m "fix: support selection for toggle strings"
```
