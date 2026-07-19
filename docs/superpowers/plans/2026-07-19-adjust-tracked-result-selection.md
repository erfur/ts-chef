# Adjust Tracked Result Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users extend or shrink an opened Results sidebar item's tracked input with VS Code's normal mouse selection controls.

**Architecture:** `ResultsController` remembers the most recently opened result and listens for primary editor selection changes. A changed non-empty selection in that result's document replaces its stored offsets and enters the existing debounced recomputation path; existing removal and disposal paths clear the active target.

**Tech Stack:** TypeScript, VS Code extension API, Jest

## Global Constraints

- Opening a Results row activates it only after its document is successfully revealed.
- Only non-empty primary selections in the active result's document may retarget it.
- The active result remains linked until another row opens or the result is removed.
- Re-selecting the stored range must not recompute.
- Reuse the existing debounce, generation guard, evaluator, and tracked-range transform.
- Do not add a Results view button or change webview messages.
- Do not change recipe argument selection references or non-sidebar result modes.
- Preserve the unrelated modification to `src/generated/opsRegistry.ts` and do not stage it.

---

### Task 1: Retarget An Opened Result From Editor Selection

**Files:**

- Modify: `test/vscode-mock.ts:10-22`
- Modify: `test/commands/resultsController.test.ts:1-21,124-171,506-541,585-627,676-715,936-952`
- Modify: `src/commands/resultsController.ts:37-101,171-201,241-248`

**Interfaces:**

- Consumes: `vscode.window.onDidChangeTextEditorSelection(listener)` and the existing `ResultsController.schedule(item)` debounce path.
- Produces: an internal `activeSelectionTarget: ResultRecord | undefined`; no public API changes.

- [ ] **Step 1: Add selection-event support to the VS Code test mock**

Add this property beside `onDidChangeActiveTextEditor` in `test/vscode-mock.ts`:

```ts
  onDidChangeTextEditorSelection: jest.fn<
    { dispose: () => void },
    [listener: (event: unknown) => void]
  >(() => ({ dispose: jest.fn() })),
```

This is test infrastructure only. It records the controller's listener so tests can emit realistic editor-selection events.

- [ ] **Step 2: Add a test helper that changes the primary selection**

Extend the object returned by `setup` in `test/commands/resultsController.test.ts` with:

```ts
    select: (editor: TextEditor, start: number, end: number) => {
      const selection = {
        isEmpty: start === end,
        start: editor.document.positionAt(start),
        end: editor.document.positionAt(end),
      };
      (editor as unknown as { selection: typeof selection }).selection =
        selection;
      const selectionHandler =
        window.onDidChangeTextEditorSelection.mock.calls[0][0];
      selectionHandler({ textEditor: editor, selections: [selection] });
    },
```

The helper updates `editor.selection` before emitting because the implementation reads VS Code's primary `TextEditor.selection`.

- [ ] **Step 3: Write failing tests for extending, shrinking, and action ranges**

Add this test after the existing open test in `test/commands/resultsController.test.ts`:

```ts
test("retargets an opened result when its selection is extended or shrunk", async () => {
  jest.useFakeTimers();
  const document = makeDocument("source.txt", "abcdefghij");
  const { editor } = makeEditor(document);
  const { editor: shown, editBuilder } = makeEditor(document);
  window.showTextDocument.mockResolvedValue(shown);
  const recipe = source("Recipe");
  const { controller, emit, lastState, select } = setup(10);
  controller.show(editor, "initial", target(2, 5), recipe);
  const id = lastState().items[0].id;
  await emit({ type: "open", id });

  select(shown, 1, 7);
  await jest.advanceTimersByTimeAsync(10);
  expect(recipe.evaluate).toHaveBeenLastCalledWith("bcdefg");

  select(shown, 3, 6);
  await jest.advanceTimersByTimeAsync(10);
  expect(recipe.evaluate).toHaveBeenLastCalledWith("def");

  await emit({ type: "open", id });
  expect(shown.selection).toEqual(
    expect.objectContaining({
      anchor: document.positionAt(3),
      active: document.positionAt(6),
    }),
  );
  await emit({ type: "action", action: "replace", id });
  expect(editBuilder.replace).toHaveBeenCalledWith(
    expect.objectContaining({
      start: document.positionAt(3),
      end: document.positionAt(6),
    }),
    "def",
  );
});
```

This proves both directions use current document text and that subsequent Open and Replace actions consume the adjusted range.

- [ ] **Step 4: Write failing tests for ignored selections and target transfer**

Add:

```ts
test("ignores empty, unchanged, and unrelated selections", async () => {
  jest.useFakeTimers();
  const document = makeDocument("source.txt", "abcdefghij");
  const otherDocument = makeDocument("other.txt", "klmnopqrst");
  const { editor } = makeEditor(document);
  const { editor: shown } = makeEditor(document);
  const { editor: otherEditor } = makeEditor(otherDocument);
  window.showTextDocument.mockResolvedValue(shown);
  const recipe = source("Recipe");
  const { controller, emit, lastState, select } = setup(10);
  controller.show(editor, "initial", target(2, 5), recipe);
  await emit({ type: "open", id: lastState().items[0].id });

  select(shown, 2, 5);
  select(shown, 4, 4);
  select(otherEditor, 1, 6);
  await jest.advanceTimersByTimeAsync(10);

  expect(recipe.evaluate).not.toHaveBeenCalled();
});

test("opening another row transfers selection tracking", async () => {
  jest.useFakeTimers();
  const documentA = makeDocument("a.txt", "abcdefghij");
  const documentB = makeDocument("b.txt", "klmnopqrst");
  const { editor: editorA } = makeEditor(documentA);
  const { editor: editorB } = makeEditor(documentB);
  const { editor: shownA } = makeEditor(documentA);
  const { editor: shownB } = makeEditor(documentB);
  const sourceA = source("A");
  const sourceB = source("B");
  window.showTextDocument
    .mockResolvedValueOnce(shownA)
    .mockResolvedValueOnce(shownB);
  const { controller, emit, lastState, select } = setup(10);
  controller.show(editorA, "a", target(1, 4), sourceA);
  const idA = lastState().items[0].id;
  controller.show(editorB, "b", target(2, 5), sourceB);
  const idB = lastState().items[0].id;

  await emit({ type: "open", id: idA });
  await emit({ type: "open", id: idB });
  select(shownA, 0, 6);
  select(shownB, 3, 7);
  await jest.advanceTimersByTimeAsync(10);

  expect(sourceA.evaluate).not.toHaveBeenCalled();
  expect(sourceB.evaluate).toHaveBeenCalledWith("mnop");
});
```

- [ ] **Step 5: Write failing tests for unsuccessful open and lifecycle cleanup**

Replace the existing rejected-open test with:

```ts
test("a failed open warns without loading or activating the result", async () => {
  jest.useFakeTimers();
  const document = makeDocument("source.txt");
  const { editor } = makeEditor(document);
  window.showTextDocument.mockRejectedValue(new Error("reveal failed"));
  const recipe = source("Recipe");
  const { controller, emit, lastState, loadRecipe, select } = setup(10);
  controller.show(editor, "result", target(2, 6), recipe);
  const id = lastState().items[0].id;

  await emit({ type: "open", id });
  select(editor, 1, 7);
  await jest.advanceTimersByTimeAsync(10);

  expect(window.showWarningMessage).toHaveBeenCalledTimes(1);
  expect(loadRecipe).not.toHaveBeenCalled();
  expect(recipe.evaluate).not.toHaveBeenCalled();
  expect(lastState().items).toHaveLength(1);
});
```

Add a lifecycle test near the existing deletion, close, and disposal tests:

```ts
test.each(["delete", "close", "dispose"] as const)(
  "%s clears the active selection target",
  async (cleanup) => {
    jest.useFakeTimers();
    const document = makeDocument("source.txt", "abcdefghij");
    const { editor } = makeEditor(document);
    const { editor: shown } = makeEditor(document);
    window.showTextDocument.mockResolvedValue(shown);
    const recipe = source("Recipe");
    const { controller, close, emit, lastState, select } = setup(10);
    controller.show(editor, "initial", target(2, 5), recipe);
    const id = lastState().items[0].id;
    await emit({ type: "open", id });

    if (cleanup === "delete")
      await emit({ type: "action", action: "delete", id });
    else if (cleanup === "close") close(document);
    else controller.dispose();
    select(shown, 1, 7);
    await jest.advanceTimersByTimeAsync(10);

    expect(recipe.evaluate).not.toHaveBeenCalled();
  },
);
```

- [ ] **Step 6: Run the focused suite and verify RED**

Run:

```bash
npx jest test/commands/resultsController.test.ts --runInBand
```

Expected: FAIL because the controller has registered no selection-change listener, so `window.onDidChangeTextEditorSelection.mock.calls[0]` is undefined.

- [ ] **Step 7: Track selection changes in `ResultsController`**

Add the active target beside the controller's existing fields:

```ts
  private activeSelectionTarget: ResultRecord | undefined;
```

Add this subscription in `register`, beside the active-editor listener:

```ts
      vscode.window.onDidChangeTextEditorSelection((event) => {
        const item = this.activeSelectionTarget;
        if (
          !item ||
          !this.results.includes(item) ||
          event.textEditor.document !== item.document
        )
          return;
        const selection = event.textEditor.selection;
        if (selection.isEmpty) return;
        const startOffset = item.document.offsetAt(selection.start);
        const endOffset = item.document.offsetAt(selection.end);
        if (
          startOffset === item.startOffset &&
          endOffset === item.endOffset
        )
          return;
        item.startOffset = startOffset;
        item.endOffset = endOffset;
        this.schedule(item);
      }),
```

VS Code normalizes `Selection.start` and `Selection.end`, so reverse mouse selections still produce ordered offsets.

- [ ] **Step 8: Activate only successfully opened results**

Update `open` so activation occurs after `reveal` succeeds and immediately before assigning the programmatic selection:

```ts
  private async open(item: ResultRecord): Promise<void> {
    const editor = await this.reveal(item);
    if (!editor) return;
    const range = this.range(item);
    this.activeSelectionTarget = item;
    editor.selection = new vscode.Selection(range.start, range.end);
    editor.revealRange(range);
    this.dependencies.loadRecipe(structuredClone(item.source.recipe));
  }
```

- [ ] **Step 9: Clear the active target through existing cleanup paths**

In `remove`, clear the target after locating the record and before disposing it:

```ts
if (this.activeSelectionTarget === item) this.activeSelectionTarget = undefined;
```

In `removeDocument`, clear it when it belongs to the removed set:

```ts
if (this.activeSelectionTarget && removed.includes(this.activeSelectionTarget))
  this.activeSelectionTarget = undefined;
```

In `dispose`, clear it after invalidating records and before clearing `results`:

```ts
this.activeSelectionTarget = undefined;
```

- [ ] **Step 10: Run the focused suite and verify GREEN**

Run:

```bash
npx jest test/commands/resultsController.test.ts --runInBand
```

Expected: PASS with all controller tests passing.

- [ ] **Step 11: Run static verification**

Run:

```bash
npm run typecheck
npx eslint src/commands/resultsController.ts test/commands/resultsController.test.ts test/vscode-mock.ts
```

Expected: both commands exit successfully with no TypeScript or ESLint errors.

- [ ] **Step 12: Run the complete test suite**

Run:

```bash
npm test -- --runInBand
```

Expected: all Jest suites pass.

- [ ] **Step 13: Review and commit the implementation**

Inspect `git status`, `git diff`, and `git log --oneline -10`. Confirm `src/generated/opsRegistry.ts` remains unstaged. Stage only the implementation, tests, mock, and this plan:

```bash
git add src/commands/resultsController.ts test/commands/resultsController.test.ts test/vscode-mock.ts docs/superpowers/plans/2026-07-19-adjust-tracked-result-selection.md
git commit -m "feat: adjust tracked result selections"
```
