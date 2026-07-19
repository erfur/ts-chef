# Explicit Reselection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace automatic result retargeting with explicit Reselect actions and add the same explicit reselection control to bound recipe parameters.

**Architecture:** The Results webview sends `reselect` through its existing action protocol, and `ResultsController` validates the active editor before replacing a result's tracked offsets and scheduling recomputation. Recipe parameters reuse the existing `useSelection` message and authoritative binding replacement path, adding only a bound-state control and accessibility copy.

**Tech Stack:** TypeScript, VS Code Extension API, webview JavaScript, Jest, JSDOM, ESLint

## Global Constraints

- Changing the editor selection alone must never retarget a result or recipe reference.
- Result reselection requires a non-empty primary selection in the result's source document.
- Recipe reselection accepts a non-empty primary selection from any active text document, matching initial binding behavior.
- Failed results must keep Reselect enabled so new input can recover them.
- Bound recipe parameters must retain Reveal and Clear while gaining Reselect.
- Do not add an arming mode, a new recipe message type, or a new selection reference API.

---

## File Structure

- Modify `src/providers/resultsViewProvider.ts`: extend the Results action protocol and render/post the Reselect button.
- Modify `test/commands/resultsViewProvider.test.ts`: cover Reselect rendering, disabled-state rules, and posted messages.
- Modify `src/commands/resultsController.ts`: remove automatic selection tracking and implement explicit result reselection.
- Modify `test/commands/resultsController.test.ts`: replace automatic-retarget tests with explicit action and validation coverage.
- Modify `src/providers/recipeViewProvider.ts`: render Reselect beside bound recipe parameters while reusing `useSelection`.
- Modify `test/commands/recipeViewProvider.test.ts`: cover the bound-state controls and authoritative binding replacement.

---

### Task 1: Results View Reselect Action

**Files:**
- Modify: `src/providers/resultsViewProvider.ts:3-23,100-125`
- Test: `test/commands/resultsViewProvider.test.ts:67-115,154-175`

**Interfaces:**
- Consumes: existing `ResultsViewMessage` `{ type: "action"; action: ResultAction; id: number }`.
- Produces: `ResultAction` including `"reselect"`; webview posts `{ type: "action", action: "reselect", id }`.

- [ ] **Step 1: Write failing provider tests**

Update the message-forwarding test to include Reselect:

```ts
test("forwards filter, open, and action messages", () => {
  const { provider, onMessage } = setup();
  const received: unknown[] = [];
  provider.onDidMessage((message) => received.push(message));

  onMessage({ type: "filter", filter: "current" });
  onMessage({ type: "open", id: 4 });
  onMessage({ type: "action", action: "reselect", id: 4 });

  expect(received).toEqual([
    { type: "filter", filter: "current" },
    { type: "open", id: 4 },
    { type: "action", action: "reselect", id: 4 },
  ]);
});
```

Extend the failed-result assertions so Reselect exists and remains enabled:

```ts
expect(
  document.querySelector<HTMLButtonElement>(
    '[data-action="reselect"][data-id="2"]',
  )?.disabled,
).toBe(false);
```

Update the webview-posting test to click Reselect and expect its action message:

```ts
document
  .querySelector<HTMLElement>('[data-action="reselect"][data-id="4"]')
  ?.click();

expect(postMessage.mock.calls.map(([message]) => message)).toEqual([
  { type: "filter", filter: "current" },
  { type: "open", id: 4 },
  { type: "action", action: "reselect", id: 4 },
  { type: "action", action: "copy", id: 4 },
]);
```

- [ ] **Step 2: Run the provider tests and verify failure**

Run: `npm test -- --runInBand test/commands/resultsViewProvider.test.ts`

Expected: FAIL because no `[data-action="reselect"]` button is rendered.

- [ ] **Step 3: Implement the minimal Results view changes**

Extend the action type:

```ts
export type ResultAction =
  | "popup"
  | "copy"
  | "replace"
  | "reselect"
  | "delete";
```

Keep Reselect enabled for failed rows and render it before Replace:

```js
const action = (name, label) => '<button data-action="' + name + '" data-id="' + item.id + '"' +
  (name === "delete" || name === "reselect" ? "" : disabled) + ">" + label + "</button>";
return '<div class="result" data-id="' + item.id + '"><div class="meta"><strong>' +
  esc(item.label) + '</strong><span class="source">' + esc(item.source) + "</span></div>" + body +
  '<div class="actions">' + action("popup", "Popup") + action("copy", "Copy") +
  action("reselect", "Reselect") + action("replace", "Replace") +
  action("delete", "Delete") + "</div></div>";
```

- [ ] **Step 4: Run the provider tests and verify success**

Run: `npm test -- --runInBand test/commands/resultsViewProvider.test.ts`

Expected: PASS for all Results view provider tests.

- [ ] **Step 5: Commit the Results view protocol**

```bash
git add src/providers/resultsViewProvider.ts test/commands/resultsViewProvider.test.ts
git commit -m "feat: add result reselect action"
```

---

### Task 2: Explicit Result Reselection

**Files:**
- Modify: `src/commands/resultsController.ts:37-125,195-232,272-342`
- Test: `test/commands/resultsController.test.ts:133-192,564-649,1128-1168`

**Interfaces:**
- Consumes: Task 1's `{ type: "action"; action: "reselect"; id: number }` message.
- Produces: explicit `ResultsController.reselect(item: ResultRecord): void` behavior; no automatic selection listener or active-target state.

- [ ] **Step 1: Replace automatic-retarget tests with explicit reselection tests**

Replace the `select` setup helper with a helper that only changes the editor's selection and does not fire any VS Code event:

```ts
setSelection: (editor: TextEditor, start: number, end: number) => {
  const selection = {
    isEmpty: start === end,
    start: editor.document.positionAt(start),
    end: editor.document.positionAt(end),
  };
  (editor as unknown as { selection: typeof selection }).selection = selection;
},
```

Replace the dynamic retargeting tests with these cases:

```ts
test("does not retarget a result when the editor selection changes", async () => {
  jest.useFakeTimers();
  const document = makeDocument("source.txt", "abcdefghij");
  const { editor } = makeEditor(document);
  const recipe = source("Recipe");
  const { controller, lastState, setSelection } = setup(10);
  controller.show(editor, "initial", target(2, 5), recipe);

  setSelection(editor, 1, 7);
  await jest.advanceTimersByTimeAsync(10);

  expect(window.onDidChangeTextEditorSelection).not.toHaveBeenCalled();
  expect(recipe.evaluate).not.toHaveBeenCalled();
  expect(lastState().items[0].output).toBe("initial");
});

test("reselects a result from a non-empty selection in its source document", async () => {
  jest.useFakeTimers();
  const document = makeDocument("source.txt", "abcdefghij");
  const { editor, editBuilder } = makeEditor(document);
  const recipe = source("Recipe");
  const { controller, emit, lastState, setSelection } = setup(10);
  window.showTextDocument.mockResolvedValue(editor);
  controller.show(editor, "initial", target(2, 5), recipe);
  const id = lastState().items[0].id;
  setSelection(editor, 1, 7);
  (window as { activeTextEditor: unknown }).activeTextEditor = editor;

  await emit({ type: "action", action: "reselect", id });
  await jest.advanceTimersByTimeAsync(10);

  expect(recipe.evaluate).toHaveBeenLastCalledWith("bcdefg");
  await emit({ type: "open", id });
  expect(editor.selection).toEqual(
    expect.objectContaining({
      anchor: document.positionAt(1),
      active: document.positionAt(7),
    }),
  );
  await emit({ type: "action", action: "replace", id });
  expect(editBuilder.replace).toHaveBeenCalledWith(
    expect.objectContaining({
      start: document.positionAt(1),
      end: document.positionAt(7),
    }),
    "bcdefg",
  );
});

test.each(["no active editor", "empty selection", "different document"])(
  "keeps the result unchanged when reselection has %s",
  async (condition) => {
    jest.useFakeTimers();
    const document = makeDocument("source.txt", "abcdefghij");
    const otherDocument = makeDocument("other.txt", "klmnopqrst");
    const { editor } = makeEditor(document);
    const { editor: otherEditor } = makeEditor(otherDocument);
    const recipe = source("Recipe");
    const { controller, emit, lastState, setSelection } = setup(10);
    controller.show(editor, "initial", target(2, 5), recipe);
    const id = lastState().items[0].id;

    if (condition === "empty selection") {
      setSelection(editor, 4, 4);
      (window as { activeTextEditor: unknown }).activeTextEditor = editor;
    } else if (condition === "different document") {
      (window as { activeTextEditor: unknown }).activeTextEditor = otherEditor;
    }

    await emit({ type: "action", action: "reselect", id });
    await jest.advanceTimersByTimeAsync(10);

    expect(recipe.evaluate).not.toHaveBeenCalled();
    expect(lastState().items[0].output).toBe("initial");
    expect(window.showWarningMessage).toHaveBeenCalledWith(
      "ts-chef: Select non-empty text in this result's source document before reselecting.",
    );
  },
);

test("allows an errored result to recover through reselection", async () => {
  jest.useFakeTimers();
  const document = makeDocument("source.txt", "abcdefghij");
  const { editor } = makeEditor(document);
  const recipe = source("Recipe");
  recipe.evaluate = jest
    .fn()
    .mockRejectedValueOnce(new Error("bad input"))
    .mockResolvedValueOnce("recovered");
  const { controller, emit, lastState, setSelection } = setup(10);
  controller.show(editor, "initial", target(2, 5), recipe);

  setSelection(editor, 1, 4);
  (window as { activeTextEditor: unknown }).activeTextEditor = editor;
  await emit({ type: "action", action: "reselect", id: lastState().items[0].id });
  await jest.advanceTimersByTimeAsync(10);
  expect(lastState().items[0].error).toBe("bad input");

  setSelection(editor, 4, 7);
  await emit({ type: "action", action: "reselect", id: lastState().items[0].id });
  await jest.advanceTimersByTimeAsync(10);
  expect(lastState().items[0]).toEqual(
    expect.objectContaining({ output: "recovered", error: undefined }),
  );
});
```

Delete tests that only assert active-selection-target transfer or cleanup, because that state will no longer exist. Retain the out-of-order open request test because row navigation still needs its race guard.

- [ ] **Step 2: Run controller tests and verify failure**

Run: `npm test -- --runInBand test/commands/resultsController.test.ts`

Expected: FAIL because `reselect` is accepted by the type but ignored by `ResultsController`, and the automatic selection listener is still registered.

- [ ] **Step 3: Remove automatic tracking and implement explicit reselection**

Delete the `activeSelectionTarget` property, the complete `onDidChangeTextEditorSelection` registration callback, all active-target cleanup branches, and the assignment in `open`. Keep `open` selecting and revealing the stored range:

```ts
const range = this.range(item);
editor.selection = new vscode.Selection(range.start, range.end);
editor.revealRange(range);
this.dependencies.loadRecipe(structuredClone(item.source.recipe));
```

Add this method before `replace`:

```ts
private reselect(item: ResultRecord): void {
  const editor = vscode.window.activeTextEditor;
  if (
    !editor ||
    editor.document !== item.document ||
    editor.selection.isEmpty
  ) {
    vscode.window.showWarningMessage(
      "ts-chef: Select non-empty text in this result's source document before reselecting.",
    );
    return;
  }
  const startOffset = item.document.offsetAt(editor.selection.start);
  const endOffset = item.document.offsetAt(editor.selection.end);
  if (startOffset === item.startOffset && endOffset === item.endOffset) return;
  item.startOffset = startOffset;
  item.endOffset = endOffset;
  this.schedule(item);
}
```

Accept and dispatch the action before the output/error guard so failed rows can recover:

```ts
if (
  message.action !== "popup" &&
  message.action !== "copy" &&
  message.action !== "replace" &&
  message.action !== "reselect" &&
  message.action !== "delete"
) {
  return;
}

if (message.action === "delete") {
  this.remove(item.id);
  return;
}
if (message.action === "reselect") {
  this.reselect(item);
  return;
}
if (item.error || item.output === undefined) return;
```

- [ ] **Step 4: Run focused controller and provider tests**

Run: `npm test -- --runInBand test/commands/resultsController.test.ts test/commands/resultsViewProvider.test.ts`

Expected: PASS for both suites.

- [ ] **Step 5: Commit explicit result reselection**

```bash
git add src/commands/resultsController.ts test/commands/resultsController.test.ts
git commit -m "feat: reselect result input explicitly"
```

---

### Task 3: Recipe Reference Reselection

**Files:**
- Modify: `src/providers/recipeViewProvider.ts:523-560,823-850`
- Test: `test/commands/recipeViewProvider.test.ts:182-254,302-316,670-753`

**Interfaces:**
- Consumes: existing `useSelection` message `{ type: "useSelection"; stepId: string; arg: number }` and `getSelectionReference(): SelectionReference | undefined` callback.
- Produces: bound parameters expose Reveal, Reselect, and Clear; Reselect atomically replaces a valid binding through the existing handler.

- [ ] **Step 1: Write failing recipe control and replacement tests**

Extend the bound-field rendering test:

```ts
const input = dom.window.document.querySelector<HTMLInputElement>(
  'input[data-arg="1"][data-subfield="string"]',
);
const row = input?.closest(".arg-row");
const reselect = row?.querySelector<HTMLElement>("[data-use-selection]");
const clear = row?.querySelector<HTMLElement>("[data-clear-selection]");

expect(input?.readOnly).toBe(true);
expect(input?.getAttribute("aria-label")).toBe("Reveal selection for Alphabet");
expect(reselect?.getAttribute("title")).toBe(
  "Reselect current editor selection",
);
expect(reselect?.getAttribute("aria-label")).toBe(
  "Reselect current editor selection",
);
expect(clear?.getAttribute("aria-label")).toBe("Clear selection reference");
```

Add a webview posting assertion scoped to a bound row:

```ts
test("requests reselection for a bound argument", () => {
  const { v } = setup();
  const { dom, postMessage } = renderRecipeDom(v.webview.html, [
    { stepId: "step-1", arg: 0 },
  ]);
  postMessage.mockClear();

  dom.window.document
    .querySelector<HTMLElement>(
      '.arg-row [data-arg="0"][data-use-selection]',
    )
    ?.click();

  expect(postMessage).toHaveBeenCalledWith({
    type: "useSelection",
    stepId: "step-1",
    arg: 0,
  });
});
```

Add authoritative replacement tests:

```ts
test("replaces an existing binding with the current selection", async () => {
  const first = fakeReference("first");
  const second = fakeReference("second");
  const { p, v, onMessage, getSelectionReference } = setup(first.reference);
  const steps = [{ opName: "FromBase64", args: ["old", "Hex"] }];
  const [stepId] = loadRecipe(p, v, "decode", steps);
  await onMessage({ type: "useSelection", stepId, arg: 0 });
  getSelectionReference.mockReturnValueOnce(second.reference);

  await onMessage({ type: "useSelection", stepId, arg: 0 });

  expect(first.reference.dispose).toHaveBeenCalledTimes(1);
  expect(steps[0].args[0]).toBe("second");
  second.setText("updated second");
  second.fire();
  expect(steps[0].args[0]).toBe("updated second");
});

test("keeps an existing binding when reselection is unavailable", async () => {
  const first = fakeReference("first");
  const { p, v, onMessage, getSelectionReference } = setup(first.reference);
  const steps = [{ opName: "FromBase64", args: ["old", "Hex"] }];
  const [stepId] = loadRecipe(p, v, "decode", steps);
  await onMessage({ type: "useSelection", stepId, arg: 0 });
  getSelectionReference.mockReturnValueOnce(undefined);

  await onMessage({ type: "useSelection", stepId, arg: 0 });

  expect(first.reference.dispose).not.toHaveBeenCalled();
  first.setText("still tracked");
  first.fire();
  expect(steps[0].args[0]).toBe("still tracked");
});
```

- [ ] **Step 2: Run recipe tests and verify failure**

Run: `npm test -- --runInBand test/commands/recipeViewProvider.test.ts`

Expected: FAIL because bound rows only render Clear and have no Reselect control. The binding replacement tests should already pass, demonstrating that the existing authoritative handler is reusable and needs no behavioral rewrite.

- [ ] **Step 3: Render Reselect alongside Clear for bound parameters**

Replace the single `action` expression with an `actions` expression:

```js
const actions = bound
  ? selectionButton(
      "use-selection",
      ai,
      "Reselect current editor selection",
      LINK_ICON,
    ) +
    selectionButton(
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

In each eligible string and toggle-string row return path, append `actions`
where the existing code appends `action`. Do not change the `useSelection`
message handler: it already acquires a replacement before disposing the old
binding, preserving the old binding when acquisition returns `undefined`.

- [ ] **Step 4: Run recipe and selection-reference tests**

Run: `npm test -- --runInBand test/commands/recipeViewProvider.test.ts test/commands/selectionReference.test.ts`

Expected: PASS for both suites.

- [ ] **Step 5: Commit recipe reference reselection**

```bash
git add src/providers/recipeViewProvider.ts test/commands/recipeViewProvider.test.ts
git commit -m "feat: reselect recipe parameter references"
```

---

### Task 4: Full Verification

**Files:**
- Verify only; no planned source changes.

**Interfaces:**
- Consumes: all behavior produced by Tasks 1-3.
- Produces: evidence that explicit reselection integrates with the complete extension without regressions.

- [ ] **Step 1: Run type checking**

Run: `npm run typecheck`

Expected: exit code 0 with no TypeScript diagnostics.

- [ ] **Step 2: Run lint**

Run: `npm run lint`

Expected: exit code 0 with no ESLint errors.

- [ ] **Step 3: Run the complete test suite**

Run: `npm test -- --runInBand`

Expected: all Jest suites and tests pass.

- [ ] **Step 4: Inspect the final diff and worktree**

Run: `git status --short --branch`

Expected: no uncommitted implementation changes. The branch contains the design commit and three focused implementation commits.

Run: `git diff HEAD~3..HEAD -- src test`

Expected: only the explicit result and recipe reselection changes described by this plan; no unrelated source or test edits.
