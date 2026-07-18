# Recipe Use Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a button beside each plain string recipe argument that assigns the active editor's non-empty selection to that argument.

**Architecture:** The recipe webview sends a click-time request with the target step and argument indexes. `RecipeViewProvider` validates the target, obtains selection text through an injected host callback, updates its canonical recipe, and posts refreshed state; `extension.ts` is solely responsible for reading VS Code editor state.

**Tech Stack:** TypeScript, VS Code extension/webview APIs, Jest, jsdom

## Global Constraints

- Add the button only to plain `string` arguments, not `toggleString` or other specialized controls.
- Missing active editors and empty selections must leave the argument unchanged without showing a warning.
- Read selection text only when the user clicks the button; do not subscribe to editor selection changes.
- Do not change the Pipeline Editor.
- Preserve the unrelated existing modification to `src/generated/opsRegistry.ts` and do not stage it.

---

### Task 1: Assign Current Selection to a Plain String Argument

**Files:**
- Modify: `test/commands/recipeViewProvider.test.ts`
- Modify: `src/providers/recipeViewProvider.ts`
- Modify: `src/extension.ts:104-155`

**Interfaces:**
- Consumes: `vscode.window.activeTextEditor`, `TextEditor.selection`, and `TextDocument.getText(range)`.
- Produces: `RecipeCallbacks.getSelection: () => string | undefined` and webview message `{ type: "useSelection", step: number, arg: number }`.

- [ ] **Step 1: Extend the test fixture and add failing rendering and click tests**

In `test/commands/recipeViewProvider.test.ts`, replace `ARG_DEFS` with definitions containing one plain string and one specialized string:

```ts
const ARG_DEFS = [
  { name: "Value", type: "string", value: "" },
  { name: "Alphabet", type: "toggleString", value: "" },
] as ArgConfig[];
```

Update `setup` to inject and return the new callback:

```ts
function setup(selection?: string) {
  const onApply = jest.fn();
  const onSave = jest.fn();
  const getSelection = jest.fn(() => selection);
  const argDefsFor = jest.fn((op: string): ArgConfig[] =>
    op === "FromBase64" ? ARG_DEFS : [],
  );
  const p = new RecipeViewProvider(
    ITEMS,
    { onApply, onSave, getSelection },
    argDefsFor,
  );
  const v = makeView();
  p.resolveWebviewView(v.view);
  const onMessage = v.webview.onDidReceiveMessage.mock.calls[0][0] as (
    m: unknown,
  ) => Promise<void>;
  return {
    p,
    v,
    onApply,
    onSave,
    getSelection,
    argDefsFor,
    onMessage,
  };
}
```

Replace `renderRecipeDom` so tests can inspect webview messages and both controls:

```ts
function renderRecipeDom(html: string) {
  const postMessage = jest.fn();
  const dom = new JSDOM(html, {
    runScripts: "dangerously",
    beforeParse(window) {
      Object.defineProperty(window, "acquireVsCodeApi", {
        value: () => ({ postMessage }),
      });
    },
  });

  dom.window.dispatchEvent(
    new dom.window.MessageEvent("message", {
      data: {
        type: "state",
        recipe: {
          name: "r1",
          steps: [{ opName: "FromBase64", args: ["", ""] }],
        },
        defs: { FromBase64: ARG_DEFS },
      },
    }),
  );

  return { dom, postMessage };
}
```

Update the two existing callers to use `const { dom } = renderRecipeDom(...)`. Then add:

```ts
test("renders use-selection only beside plain string arguments", () => {
  const { v } = setup();
  const { dom } = renderRecipeDom(v.webview.html);

  const buttons = dom.window.document.querySelectorAll("[data-use-selection]");
  expect(buttons).toHaveLength(1);
  expect(buttons[0].closest(".arg-row")?.textContent).toContain("Value");
  expect(buttons[0].closest(".arg-row")?.textContent).not.toContain("Alphabet");
});

test("requests the current selection for the clicked argument", () => {
  const { v } = setup();
  const { dom, postMessage } = renderRecipeDom(v.webview.html);
  postMessage.mockClear();

  dom.window.document
    .querySelector<HTMLElement>("[data-use-selection]")
    ?.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));

  expect(postMessage).toHaveBeenCalledWith({
    type: "useSelection",
    step: 0,
    arg: 0,
  });
});
```

- [ ] **Step 2: Run the focused rendering tests to verify they fail**

Run:

```bash
npx jest test/commands/recipeViewProvider.test.ts --runInBand
```

Expected: FAIL because `RecipeCallbacks` has no `getSelection` property and the webview renders no `[data-use-selection]` button.

- [ ] **Step 3: Add failing provider state-update and no-op tests**

Add these tests to `test/commands/recipeViewProvider.test.ts`:

```ts
test("assigns a non-empty selection to a plain string argument", async () => {
  const { v, onMessage, getSelection } = setup("selected text");
  const steps = [{ opName: "FromBase64", args: ["old", "Hex"] }];
  await onMessage({ type: "edit", name: "decode", steps });
  v.webview.postMessage.mockClear();

  await onMessage({ type: "useSelection", step: 0, arg: 0 });

  expect(getSelection).toHaveBeenCalledTimes(1);
  expect(steps[0].args[0]).toBe("selected text");
  expect(v.webview.postMessage).toHaveBeenCalledWith({
    type: "state",
    recipe: { name: "decode", steps },
    defs: { FromBase64: ARG_DEFS },
  });
});

test.each([undefined, ""])(
  "leaves the argument unchanged when selection is %p",
  async (selection) => {
    const { v, onMessage } = setup(selection);
    const steps = [{ opName: "FromBase64", args: ["old", "Hex"] }];
    await onMessage({ type: "edit", name: "decode", steps });
    v.webview.postMessage.mockClear();

    await onMessage({ type: "useSelection", step: 0, arg: 0 });

    expect(steps[0].args[0]).toBe("old");
    expect(v.webview.postMessage).not.toHaveBeenCalled();
  },
);

test.each([
  { step: 2, arg: 0 },
  { step: 0, arg: 1 },
])("ignores invalid or specialized target $step:$arg", async (target) => {
  const { v, onMessage, getSelection } = setup("selected text");
  const steps = [{ opName: "FromBase64", args: ["old", "Hex"] }];
  await onMessage({ type: "edit", name: "decode", steps });
  v.webview.postMessage.mockClear();

  await onMessage({ type: "useSelection", ...target });

  expect(getSelection).not.toHaveBeenCalled();
  expect(steps[0].args).toEqual(["old", "Hex"]);
  expect(v.webview.postMessage).not.toHaveBeenCalled();
});
```

- [ ] **Step 4: Run the focused provider tests to verify they fail**

Run:

```bash
npx jest test/commands/recipeViewProvider.test.ts --runInBand
```

Expected: FAIL because `useSelection` messages are not handled.

- [ ] **Step 5: Implement provider validation and canonical recipe updates**

In `src/providers/recipeViewProvider.ts`, add the callback:

```ts
export type RecipeCallbacks = {
  onApply: (name: string, steps: PipelineStep[]) => void | Promise<void>;
  onSave: (name: string, steps: PipelineStep[]) => void | Promise<void>;
  getSelection: () => string | undefined;
};
```

Expand the received message shape with numeric indexes:

```ts
async (msg: {
  type?: string;
  name?: string;
  steps?: PipelineStep[];
  step?: number;
  arg?: number;
}) => {
```

Add this switch case after `edit` and before `apply`:

```ts
case "useSelection": {
  if (!Number.isInteger(msg.step) || !Number.isInteger(msg.arg)) break;
  const step = this.recipe.steps[msg.step!];
  const argDef = step && this.argDefsFor(step.opName)[msg.arg!];
  if (!step || argDef?.type !== "string") break;
  const selection = this.callbacks.getSelection();
  if (!selection) break;
  if (!Array.isArray(step.args)) step.args = [];
  step.args[msg.arg!] = selection;
  this.postState();
  break;
}
```

- [ ] **Step 6: Render and wire the webview button**

In `src/providers/recipeViewProvider.ts`, add focused button styling after the `.arg-row input[type="checkbox"]` rule:

```css
.use-selection {
  flex: none;
  color: var(--vscode-button-secondaryForeground);
  background: var(--vscode-button-secondaryBackground);
  border: none;
  padding: 3px 6px;
  cursor: pointer;
  border-radius: 2px;
}
.use-selection:hover {
  background: var(--vscode-button-secondaryHoverBackground);
}
```

In the `renderArgRow` default case, append the button only to its plain text input:

```js
input =
  '<input type="text" value="' +
  escAttr(strVal) +
  '" data-arg="' +
  ai +
  '" data-type="string">' +
  '<button type="button" class="use-selection" data-use-selection data-arg="' +
  ai +
  '" title="Use current editor selection">Use selection</button>';
```

At the start of the delegated `stepsEl` click listener, before handling toggles, add:

```js
const useSelection = e.target.closest("[data-use-selection]");
if (useSelection) {
  const argsDiv = useSelection.closest(".step-args");
  if (!argsDiv) return;
  vscode.postMessage({
    type: "useSelection",
    step: Number(argsDiv.dataset.step),
    arg: Number(useSelection.dataset.arg),
  });
  return;
}
```

- [ ] **Step 7: Wire current editor selection into the provider**

In the callback object passed to `new RecipeViewProvider` in `src/extension.ts`, add this property after `onSave`:

```ts
getSelection: () => {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.selection.isEmpty) return undefined;
  return editor.document.getText(editor.selection);
},
```

- [ ] **Step 8: Run the focused test suite**

Run:

```bash
npx jest test/commands/recipeViewProvider.test.ts --runInBand
```

Expected: PASS for all tests in `recipeViewProvider.test.ts`.

- [ ] **Step 9: Run full verification**

Run:

```bash
npm run typecheck
npm run lint
npm test -- --runInBand
```

Expected: all commands exit with status 0. Jest reports all test suites passing.

- [ ] **Step 10: Review and commit the implementation**

Inspect `git status`, `git diff`, and `git log --oneline -10`. Confirm that the diff matches this plan and that `src/generated/opsRegistry.ts` remains unstaged. Then commit only the implementation files:

```bash
git add src/providers/recipeViewProvider.ts src/extension.ts test/commands/recipeViewProvider.test.ts
git commit -m "feat: assign selection to recipe arguments"
```
