# Recipe Selection Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make referenced recipe parameter fields reveal their tracked editor selection, provide explicit clearing, and replace the visible Use Selection label with an accessible icon.

**Architecture:** Keep selection ranges and bindings host-owned. Add an asynchronous reveal operation to `SelectionReference`, publish binding targets alongside recipe state, and let the webview render and message against stable step IDs without receiving document or range metadata.

**Tech Stack:** TypeScript, VS Code extension and webview APIs, Jest, jsdom

## Global Constraints

- Work only in `.worktrees/recipe-selection-controls` on `fix/recipe-selection-controls`.
- Selection references remain runtime-only and never enter `PipelineStep.args` or saved pipeline data.
- Only `string` and `toggleString` parameters support references.
- Bound text fields are read-only; clicking them reveals and selects the complete transformed source range.
- Clearing a reference keeps its latest materialized value and disposes only that binding.
- A bound `toggleString` keeps its encoding selector editable and changing the encoding does not unlink it.
- Use Selection and Clear controls contain inline SVG only, with no visible text, and provide both `title` and `aria-label`.
- Closed source documents, reveal failures, malformed messages, stale IDs, and invalid targets are silent no-ops.
- Do not modify generated files or the unrelated main-checkout change to `src/generated/opsRegistry.ts`.

---

### Task 1: Reveal Tracked Selection References

**Files:**
- Modify: `src/commands/selectionReference.ts:4-85`
- Test: `test/commands/selectionReference.test.ts`
- Test: `test/commands/recipeViewProvider.test.ts:29-39`
- Test: `test/commands/resultSource.test.ts:10-27`
- Test: `test/commands/resultsController.test.ts:91-102`

**Interfaces:**
- Consumes: tracked `TextDocument`, transformed start/end offsets, and `vscode.window.showTextDocument`.
- Produces: `SelectionReference.reveal(): Promise<void>`, which silently selects and reveals the current tracked range when its source document is open.

- [ ] **Step 1: Add failing reveal tests**

Import `Selection` and `window` from the VS Code mock, then add these tests:

```ts
import { Position, Range, Selection, window, workspace } from "../vscode-mock";

test("reveals and selects the transformed source range", async () => {
  const { tracker, document, change } = setup("0123456789", 2, 5);
  const editor = { selection: undefined, revealRange: jest.fn() };
  window.showTextDocument.mockResolvedValue(editor);
  change(document, [{ rangeOffset: 0, rangeLength: 1, text: "abc" }]);

  await tracker.reference.reveal();

  expect(window.showTextDocument).toHaveBeenCalledWith(document, {
    preserveFocus: false,
  });
  expect(editor.selection).toEqual(
    new Selection(new Position(0, 4), new Position(0, 7)),
  );
  expect(editor.revealRange).toHaveBeenCalledWith(
    expect.objectContaining({
      start: new Position(0, 4),
      end: new Position(0, 7),
    }),
  );
});

test("silently skips reveal after the source document closes", async () => {
  const { tracker, document, close } = setup("0123456789", 2, 5);
  close(document);

  await expect(tracker.reference.reveal()).resolves.toBeUndefined();

  expect(window.showTextDocument).not.toHaveBeenCalled();
});

test("silently ignores editor reveal failures", async () => {
  const { tracker } = setup("0123456789", 2, 5);
  window.showTextDocument.mockRejectedValue(new Error("closed while opening"));

  await expect(tracker.reference.reveal()).resolves.toBeUndefined();
});
```

`beforeEach(jest.clearAllMocks)` already resets `window.showTextDocument` between cases.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
npx jest test/commands/selectionReference.test.ts --runInBand
```

Expected: TypeScript compilation fails because `SelectionReference` has no `reveal` method.

- [ ] **Step 3: Add the reveal interface and implementation**

Add the method to the public interface:

```ts
export interface SelectionReference extends vscode.Disposable {
  readonly text: string;
  readonly onDidChange: vscode.Event<void>;
  clone(): SelectionReference;
  reveal(): Promise<void>;
}
```

Add this method to `TrackedSelection`, before `dispose()`:

```ts
async reveal(): Promise<void> {
  if (this.disposed || !this.document) return;
  const document = this.document;
  const range = new vscode.Range(
    document.positionAt(this.startOffset),
    document.positionAt(this.endOffset),
  );
  try {
    const editor = await vscode.window.showTextDocument(document, {
      preserveFocus: false,
    });
    editor.selection = new vscode.Selection(range.start, range.end);
    editor.revealRange(range);
  } catch {
    // The document may close while VS Code is opening it.
  }
}
```

Do not add warning messages. `freeze()` already removes the document when it closes.

- [ ] **Step 4: Update recipe-provider test doubles for the interface**

Add the method below to the `SelectionReference` object literals in
`test/commands/recipeViewProvider.test.ts` (`fakeReference`),
`test/commands/resultSource.test.ts` (`make`), and
`test/commands/resultsController.test.ts` (`sourceWithReference`):

```ts
reveal: jest.fn(async () => {}),
```

- [ ] **Step 5: Run focused tests and verify GREEN**

Run:

```bash
npx jest test/commands/selectionReference.test.ts test/commands/recipeViewProvider.test.ts test/commands/resultSource.test.ts test/commands/resultsController.test.ts --runInBand
```

Expected: both suites pass.

- [ ] **Step 6: Commit the reference capability**

```bash
git add src/commands/selectionReference.ts test/commands/selectionReference.test.ts test/commands/recipeViewProvider.test.ts test/commands/resultSource.test.ts test/commands/resultsController.test.ts
git commit -m "feat: reveal selection references"
```

---

### Task 2: Publish and Manage Recipe Binding State

**Files:**
- Modify: `src/providers/recipeViewProvider.ts:51-161,208-218`
- Test: `test/commands/recipeViewProvider.test.ts`

**Interfaces:**
- Consumes: `SelectionReference.reveal(): Promise<void>` from Task 1 and existing binding keys `[stepId, arg]`.
- Produces: state property `boundArgs: { stepId: string; arg: number }[]`; messages `{ type: "revealSelection" | "clearSelection"; stepId: string; arg: number }`; optional `editedArg.subfield` metadata.

- [ ] **Step 1: Add failing provider tests for published state, reveal, clear, and toggle encoding**

Update exact state expectations throughout `test/commands/recipeViewProvider.test.ts` to include `boundArgs: []` when no binding exists. For the existing plain and toggle assignment expectations, use:

```ts
boundArgs: [{ stepId, arg: 0 }],
```

and:

```ts
boundArgs: [{ stepId, arg: 1 }],
```

respectively. Then add:

```ts
test("reveals a bound target by stable ID", async () => {
  const { p, v, onMessage, reference } = setupReference("selected");
  const [stepId] = loadRecipe(p, v, "r", [
    { opName: "FromBase64", args: ["old"] },
  ]);
  await onMessage({ type: "useSelection", stepId, arg: 0 });

  await onMessage({ type: "revealSelection", stepId, arg: 0 });

  expect(reference.reveal).toHaveBeenCalledTimes(1);
});

test("clears one binding while retaining its latest materialized value", async () => {
  const first = fakeReference("first");
  const second = fakeReference("second");
  const { p, v, onMessage, getSelectionReference, onApply } = setup(
    first.reference,
  );
  const [firstId, secondId] = loadRecipe(p, v, "r", [
    { opName: "FromBase64", args: ["old-first"] },
    { opName: "FromBase64", args: ["old-second"] },
  ]);
  await onMessage({ type: "useSelection", stepId: firstId, arg: 0 });
  getSelectionReference.mockReturnValue(second.reference);
  await onMessage({ type: "useSelection", stepId: secondId, arg: 0 });
  first.setText("first-latest");

  await onMessage({ type: "clearSelection", stepId: firstId, arg: 0 });
  await onMessage({ type: "apply" });

  expect(first.reference.dispose).toHaveBeenCalledTimes(1);
  expect(second.reference.dispose).not.toHaveBeenCalled();
  expect(onApply.mock.calls[0][1][0].args[0]).toBe("first-latest");
  expect(lastPostedState(v).boundArgs).toEqual([
    { stepId: secondId, arg: 0 },
  ]);
});

test("changing a bound toggle encoding keeps the text reference", async () => {
  const { p, v, onMessage, reference, setText, fire } =
    setupReference("selected");
  const steps = [
    {
      opName: "FromBase64",
      args: ["", { string: "old", option: "Hex" }, ""],
    },
  ];
  const [stepId] = loadRecipe(p, v, "r", steps);
  await onMessage({ type: "useSelection", stepId, arg: 1 });

  await onMessage({
    type: "edit",
    name: "r",
    steps: [
      {
        opName: "FromBase64",
        args: ["", { string: "selected", option: "UTF8" }, ""],
      },
    ],
    stepIds: [stepId],
    editedArg: { stepId, arg: 1, subfield: "option" },
  });
  setText("latest");
  fire();

  expect(lastPostedState(v).recipe.steps[0].args[1]).toEqual({
    string: "latest",
    option: "UTF8",
  });
  expect(reference.dispose).not.toHaveBeenCalled();
});

test.each(["revealSelection", "clearSelection"])(
  "ignores %s for invalid or unbound targets",
  async (type) => {
    const { p, v, onMessage, reference } = setupReference("selected");
    const [stepId] = loadRecipe(p, v, "r", [
      { opName: "FromBase64", args: ["old"] },
    ]);
    await onMessage({ type, stepId, arg: 0 });
    await onMessage({ type, stepId: "missing", arg: 0 });
    await onMessage({ type, stepId, arg: 99 });

    expect(reference.reveal).not.toHaveBeenCalled();
    expect(reference.dispose).not.toHaveBeenCalled();
  },
);
```

- [ ] **Step 2: Run the provider suite and verify RED**

Run:

```bash
npx jest test/commands/recipeViewProvider.test.ts --runInBand
```

Expected: state lacks `boundArgs`, reveal does not call the reference, clear does not dispose it, and toggle option editing unlinks.

- [ ] **Step 3: Publish binding targets in every state message**

In `postState()`, derive targets from the host map and include them in the posted object:

```ts
const boundArgs = [...this.bindings.keys()].map((key) => {
  const [stepId, arg] = this.parseBindingKey(key);
  return { stepId, arg };
});
this.view?.webview.postMessage({
  type: "state",
  recipe: this.recipe,
  stepIds: this.stepIds,
  defs,
  boundArgs,
});
```

This keeps persisted steps ordinary and gives the webview only stable target IDs.

- [ ] **Step 4: Add reveal and clear message handling**

Extend the parsed message type:

```ts
editedArg?: { stepId?: unknown; arg?: unknown; subfield?: unknown };
```

Change manual-edit disposal so an encoding-only `toggleString` edit stays bound:

```ts
const key = this.bindingKey(editedArg.stepId, editedArg.arg as number);
const binding = this.bindings.get(key);
if (!(binding?.type === "toggleString" && editedArg.subfield === "option")) {
  this.disposeBinding(key);
}
```

Add these switch cases after `useSelection`:

```ts
case "revealSelection": {
  if (typeof msg.stepId !== "string" || !Number.isInteger(msg.arg)) break;
  const binding = this.bindings.get(
    this.bindingKey(msg.stepId, msg.arg as number),
  );
  if (binding) await binding.reference.reveal();
  break;
}
case "clearSelection": {
  if (typeof msg.stepId !== "string" || !Number.isInteger(msg.arg)) break;
  const key = this.bindingKey(msg.stepId, msg.arg as number);
  const binding = this.bindings.get(key);
  if (!binding) break;
  this.materializeBinding(msg.stepId, msg.arg as number, binding);
  this.disposeBinding(key);
  this.postState();
  break;
}
```

- [ ] **Step 5: Run the provider suite and verify GREEN**

Run:

```bash
npx jest test/commands/recipeViewProvider.test.ts --runInBand
```

Expected: all provider tests pass.

- [ ] **Step 6: Commit host-side binding controls**

```bash
git add src/providers/recipeViewProvider.ts test/commands/recipeViewProvider.test.ts
git commit -m "feat: manage recipe selection bindings"
```

---

### Task 3: Render Accessible Icon-Only Binding Controls

**Files:**
- Modify: `src/providers/recipeViewProvider.ts:364-403,435-778`
- Test: `test/commands/recipeViewProvider.test.ts`

**Interfaces:**
- Consumes: state `boundArgs: { stepId: string; arg: number }[]` and messages from Task 2.
- Produces: icon-only bind/clear buttons, read-only referenced text fields, click-to-reveal behavior, and `editedArg.subfield` from webview edits.

- [ ] **Step 1: Let the DOM test helper render explicit binding targets**

Change the helper signature:

```ts
function renderRecipeDom(
  html: string,
  boundArgs: { stepId: string; arg: number }[] = [],
) {
```

Then add `boundArgs` to the existing message event's `data` object immediately
after `defs`:

```ts
defs: { FromBase64: ARG_DEFS },
boundArgs,
```

- [ ] **Step 2: Add failing DOM tests**

Replace the existing render eligibility test's button assertions and add bound behavior coverage:

```ts
test("renders accessible icon-only use-selection controls", () => {
  const { v } = setup();
  const { dom } = renderRecipeDom(v.webview.html);
  const buttons = dom.window.document.querySelectorAll<HTMLElement>(
    "[data-use-selection]",
  );

  expect(buttons).toHaveLength(2);
  for (const button of buttons) {
    expect(button.textContent?.trim()).toBe("");
    expect(button.querySelector("svg")).not.toBeNull();
    expect(button.getAttribute("title")).toBe("Use current editor selection");
    expect(button.getAttribute("aria-label")).toBe(
      "Use current editor selection",
    );
  }
});

test("renders a bound field read-only with an accessible clear icon", () => {
  const { v } = setup();
  const { dom } = renderRecipeDom(v.webview.html, [
    { stepId: "step-1", arg: 1 },
  ]);
  const input = dom.window.document.querySelector<HTMLInputElement>(
    'input[data-arg="1"][data-subfield="string"]',
  );
  const clear = dom.window.document.querySelector<HTMLElement>(
    "[data-clear-selection]",
  );

  expect(input?.readOnly).toBe(true);
  expect(input?.hasAttribute("data-selection-reference")).toBe(true);
  expect(clear?.textContent?.trim()).toBe("");
  expect(clear?.querySelector("svg")).not.toBeNull();
  expect(clear?.getAttribute("title")).toBe("Clear selection reference");
  expect(clear?.getAttribute("aria-label")).toBe(
    "Clear selection reference",
  );
});

test.each([
  ["input[data-selection-reference]", "revealSelection"],
  ["[data-clear-selection]", "clearSelection"],
])("clicking %s posts %s for its stable target", (selector, type) => {
  const { v } = setup();
  const { dom, postMessage } = renderRecipeDom(v.webview.html, [
    { stepId: "step-1", arg: 0 },
  ]);
  postMessage.mockClear();

  dom.window.document
    .querySelector<HTMLElement>(selector)
    ?.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));

  expect(postMessage).toHaveBeenCalledWith({
    type,
    stepId: "step-1",
    arg: 0,
  });
});
```

Keep assertions that the unsupported Separator row has no bind action and that the `toggleString` action sits between its text input and selector.

- [ ] **Step 3: Run the provider suite and verify RED**

Run:

```bash
npx jest test/commands/recipeViewProvider.test.ts --runInBand
```

Expected: controls still contain visible text, bound inputs are editable, and reveal/clear click selectors are absent.

- [ ] **Step 4: Add compact icon button rendering and referenced styling**

Replace `.use-selection` CSS selectors with `.selection-action`, add SVG sizing, and style referenced inputs:

```css
.selection-action {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--vscode-button-secondaryForeground);
  background: var(--vscode-button-secondaryBackground);
  border: none;
  padding: 3px;
  cursor: pointer;
  border-radius: 2px;
}
.selection-action:hover {
  background: var(--vscode-button-secondaryHoverBackground);
}
.selection-action svg {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
}
.arg-row input[data-selection-reference] {
  cursor: pointer;
  opacity: 0.85;
}
```

Inside the script, add SVG constants and a renderer. The path content is visible icon geometry, not text:

```js
const LINK_ICON =
  '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6.5 9.5l3-3M5.25 11.75l-1 .99a2.12 2.12 0 01-3-3l2.5-2.49a2.12 2.12 0 013 0M10.75 4.25l1-.99a2.12 2.12 0 013 3l-2.5 2.49a2.12 2.12 0 01-3 0"/></svg>';
const CLEAR_ICON =
  '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>';

function selectionButton(action, ai, title, icon) {
  return (
    '<button type="button" class="selection-action" data-' +
    action +
    ' data-arg="' +
    ai +
    '" title="' +
    title +
    '" aria-label="' +
    title +
    '">' +
    icon +
    "</button>"
  );
}
```

- [ ] **Step 5: Render controls from stable binding targets**

Add webview state and key handling:

```js
let boundArgs = new Set();

function bindingKey(stepId, arg) {
  return JSON.stringify([stepId, arg]);
}
```

Change `renderArgRow` to accept `stepId`, calculate `const bound = boundArgs.has(bindingKey(stepId, ai));`, and use these fragments for both eligible text inputs:

```js
const referenceAttrs = bound ? " readonly data-selection-reference" : "";
const action = bound
  ? selectionButton(
      "clear-selection",
      ai,
      "Clear selection reference",
      CLEAR_ICON,
    )
  : selectionButton(
      "use-selection",
      ai,
      "Use current editor selection",
      LINK_ICON,
    );
```

Append `referenceAttrs` inside the `string` and `toggleString` text-input opening tags and append `action` immediately after each input. Keep the `toggleString` selector after `action`. Update `renderArgs` to call:

```js
renderArgRow(a, (s.args || [])[ai], ai, stepIds[i])
```

When state arrives, populate targets before rendering:

```js
boundArgs = new Set(
  (Array.isArray(msg.boundArgs) ? msg.boundArgs : []).map((target) =>
    bindingKey(target.stepId, target.arg),
  ),
);
```

- [ ] **Step 6: Route reveal, clear, and edit-subfield events**

At the start of the delegated click handler, before Use Selection, add:

```js
const referencedInput = e.target.closest("[data-selection-reference]");
if (referencedInput) {
  const argsDiv = referencedInput.closest(".step-args");
  if (!argsDiv) return;
  vscode.postMessage({
    type: "revealSelection",
    stepId: stepIds[Number(argsDiv.dataset.step)],
    arg: Number(referencedInput.dataset.arg),
  });
  return;
}
const clearSelection = e.target.closest("[data-clear-selection]");
if (clearSelection) {
  const argsDiv = clearSelection.closest(".step-args");
  if (!argsDiv) return;
  vscode.postMessage({
    type: "clearSelection",
    stepId: stepIds[Number(argsDiv.dataset.step)],
    arg: Number(clearSelection.dataset.arg),
  });
  return;
}
```

SVG children are handled because `closest()` walks up to the button/input. In `handleArgUpdate`, preserve subfield information:

```js
emitEdit({
  stepId: stepIds[si],
  arg: ai,
  subfield: t.dataset.subfield,
});
```

- [ ] **Step 7: Run focused tests and verify GREEN**

Run:

```bash
npx jest test/commands/recipeViewProvider.test.ts test/commands/selectionReference.test.ts --runInBand
```

Expected: both suites pass, including icon-only accessibility, click routing, clear retention, reveal, and toggle encoding behavior.

- [ ] **Step 8: Commit webview controls**

```bash
git add src/providers/recipeViewProvider.ts test/commands/recipeViewProvider.test.ts
git commit -m "feat: add recipe reference controls"
```

---

### Task 4: Full Verification and Final Review

**Files:**
- Verify: `src/commands/selectionReference.ts`
- Verify: `src/providers/recipeViewProvider.ts`
- Verify: `test/commands/selectionReference.test.ts`
- Verify: `test/commands/recipeViewProvider.test.ts`

**Interfaces:**
- Consumes: completed Tasks 1-3.
- Produces: a verified feature branch with no generated or unrelated changes.

- [ ] **Step 1: Run type checking**

```bash
npm run typecheck
```

Expected: exit 0 with no TypeScript errors.

- [ ] **Step 2: Run scoped lint**

```bash
npx eslint src/commands/selectionReference.ts src/providers/recipeViewProvider.ts test/commands/selectionReference.test.ts test/commands/recipeViewProvider.test.ts
```

Expected: exit 0 with no lint errors.

- [ ] **Step 3: Run the complete test suite**

```bash
npm test -- --runInBand
```

Expected: 81 suites pass with at least 557 tests and no failures.

- [ ] **Step 4: Inspect branch scope**

Run each command:

```bash
git status --short --branch
git diff master...HEAD --stat
git diff master...HEAD
git log --oneline --decorate -10
```

Expected: only the design, plan, selection-reference implementation/test, and recipe-provider implementation/test differ from `master`; `src/generated/opsRegistry.ts` is absent.

- [ ] **Step 5: Request code review**

Invoke `superpowers:requesting-code-review` against `master...HEAD`. Resolve any correctness, regression, accessibility, or missing-test findings before declaring completion. If fixes are needed, rerun Steps 1-4 and commit them in a new commit without amending existing commits.
