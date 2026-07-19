# Dynamic Selection Reference Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bind recipe string arguments to an editor range so edits inside that range update the field and recompute live Results sidebar output.

**Architecture:** A shared tracker owns ephemeral document/range references and emits only referenced-text changes. Recipe steps retain ordinary values while bindings are keyed by client-only stable step IDs; result sources clone those bindings and materialize current text before each evaluation. Results sidebar records subscribe to cloned bindings and reuse their existing debounce and generation guards.

**Tech Stack:** TypeScript, VS Code extension/webview APIs, Jest, jsdom

## Global Constraints

- Bind to the original selected range; changing the editor's active selection must not move a binding.
- Support only `string` and `toggleString`; preserve `toggleString.option`.
- Saved pipelines and operation calls must receive ordinary values with no reference metadata.
- Manual parameter edits unlink that parameter; reorder follows stable step identity; remove/load disposes affected bindings.
- Only Results sidebar items dynamically recompute from reference changes.
- Closing a reference-only document freezes its last text; closing a result input document keeps existing result-removal behavior.
- Missing editors, empty selections, invalid targets, and stale bindings are silent no-ops.
- Preserve the unrelated existing modification to `src/generated/opsRegistry.ts` and do not stage it.

---

### Task 1: Shared Tracked Selection Abstraction

**Files:**
- Create: `src/commands/trackedRange.ts`
- Create: `src/commands/selectionReference.ts`
- Create: `test/commands/selectionReference.test.ts`
- Modify: `src/commands/resultsController.ts:35-82`
- Modify: `test/commands/resultsController.test.ts:7-10`

**Interfaces:**
- Produces: `transformTrackedRange(start, end, changes): { start; end; changed }` from `src/commands/trackedRange.ts`.
- Produces: `SelectionReference` with `text`, `onDidChange`, `clone()`, and `dispose()`.
- Produces: `SelectionReferenceTracker.create(document, range)` and `dispose()`.

- [ ] **Step 1: Move range tests to the shared import and add failing reference tests**

Update `test/commands/resultsController.test.ts` to import `ResultsController` alone from `resultsController` and `transformTrackedRange` from `../../src/commands/trackedRange`.

Create `test/commands/selectionReference.test.ts` with a mutable fake document, then cover these cases:

```ts
test("updates text and emits for an edit inside the tracked range", () => {
  const { tracker, document, change } = setup("0123456789", 2, 5);
  const reference = tracker.reference;
  const listener = jest.fn();
  reference.onDidChange(listener);

  change(document, [{ rangeOffset: 3, rangeLength: 1, text: "XYZ" }]);

  expect(reference.text).toBe("2XYZ4");
  expect(listener).toHaveBeenCalledTimes(1);
});

test("shifts for an edit before the range without emitting", () => {
  const { tracker, document, change } = setup("0123456789", 2, 5);
  const listener = jest.fn();
  tracker.reference.onDidChange(listener);

  change(document, [{ rangeOffset: 0, rangeLength: 1, text: "abc" }]);

  expect(tracker.reference.text).toBe("234");
  expect(listener).not.toHaveBeenCalled();
});

test("ignores unrelated document changes", () => {
  const { tracker, otherDocument, change } = setup("0123456789", 2, 5);
  const listener = jest.fn();
  tracker.reference.onDidChange(listener);
  change(otherDocument, [{ rangeOffset: 0, rangeLength: 1, text: "x" }]);
  expect(tracker.reference.text).toBe("234");
  expect(listener).not.toHaveBeenCalled();
});

test("freezes the final text when its document closes", () => {
  const { tracker, document, close, change } = setup("0123456789", 2, 5);
  close(document);
  change(document, [{ rangeOffset: 2, rangeLength: 3, text: "new" }]);
  expect(tracker.reference.text).toBe("234");
});

test("clone tracks independently and disposal stops updates", () => {
  const { tracker, document, change } = setup("0123456789", 2, 5);
  const clone = tracker.reference.clone();
  tracker.reference.dispose();
  change(document, [{ rangeOffset: 3, rangeLength: 1, text: "X" }]);
  expect(tracker.reference.text).toBe("234");
  expect(clone.text).toBe("2X4");
});
```

The test helper must apply content changes before invoking the listener captured from `workspace.onDidChangeTextDocument`, matching VS Code event ordering.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
npx jest test/commands/selectionReference.test.ts test/commands/resultsController.test.ts --runInBand
```

Expected: FAIL because `trackedRange.ts` and `selectionReference.ts` do not exist.

- [ ] **Step 3: Extract the existing range transform unchanged**

Move `OffsetChange` and `transformTrackedRange` from `resultsController.ts` into `src/commands/trackedRange.ts`, exporting both:

```ts
export type OffsetChange = {
  rangeOffset: number;
  rangeLength: number;
  text: string;
};

export function transformTrackedRange(
  start: number,
  end: number,
  changes: readonly OffsetChange[],
): { start: number; end: number; changed: boolean } {
  const sorted = [...changes].sort((a, b) => a.rangeOffset - b.rangeOffset);
  const empty = start === end;
  const mapBoundary = (offset: number, includeInsertion: boolean): number => {
    let delta = 0;
    for (const change of sorted) {
      const changeStart = change.rangeOffset;
      const changeEnd = changeStart + change.rangeLength;
      if (change.rangeLength === 0 && changeStart === offset) {
        if (includeInsertion && empty) delta += change.text.length;
        continue;
      }
      if (changeEnd <= offset) {
        delta += change.text.length - change.rangeLength;
        continue;
      }
      if (changeStart >= offset) break;
      return changeStart + delta + (includeInsertion ? change.text.length : 0);
    }
    return offset + delta;
  };
  const changed = sorted.some((change) => {
    const changeEnd = change.rangeOffset + change.rangeLength;
    return change.rangeLength === 0
      ? empty
        ? change.rangeOffset === start
        : change.rangeOffset >= start && change.rangeOffset < end
      : change.rangeOffset < end && changeEnd > start;
  });
  return {
    start: mapBoundary(start, false),
    end: mapBoundary(end, true),
    changed,
  };
}
```

Import `transformTrackedRange` back into `resultsController.ts`. Do not alter its existing boundary behavior.

- [ ] **Step 4: Implement the tracker and reference lifecycle**

Create `src/commands/selectionReference.ts`:

```ts
import * as vscode from "vscode";
import { transformTrackedRange } from "./trackedRange";

export interface SelectionReference extends vscode.Disposable {
  readonly text: string;
  readonly onDidChange: vscode.Event<void>;
  clone(): SelectionReference;
}

class TrackedSelection implements SelectionReference {
  private emitter = new vscode.EventEmitter<void>();
  private lastText: string;
  private disposed = false;
  readonly onDidChange = this.emitter.event;

  constructor(
    private readonly owner: SelectionReferenceTracker,
    private document: vscode.TextDocument | undefined,
    private startOffset: number,
    private endOffset: number,
    text?: string,
  ) {
    this.lastText = text ?? this.read();
  }

  get text(): string {
    return this.lastText;
  }

  clone(): SelectionReference {
    return this.owner.copy(this.snapshot());
  }

  snapshot(): {
    document: vscode.TextDocument | undefined;
    startOffset: number;
    endOffset: number;
    text: string;
  } {
    return {
      document: this.document,
      startOffset: this.startOffset,
      endOffset: this.endOffset,
      text: this.lastText,
    };
  }

  update(event: vscode.TextDocumentChangeEvent): void {
    if (this.disposed || event.document !== this.document) return;
    const tracked = transformTrackedRange(
      this.startOffset,
      this.endOffset,
      event.contentChanges,
    );
    this.startOffset = tracked.start;
    this.endOffset = tracked.end;
    const next = this.read();
    const textChanged = tracked.changed && next !== this.lastText;
    this.lastText = next;
    if (textChanged) this.emitter.fire();
  }

  freeze(document: vscode.TextDocument): void {
    if (this.disposed || document !== this.document) return;
    this.lastText = this.read();
    this.document = undefined;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.owner.release(this);
    this.emitter.dispose();
  }

  private read(): string {
    if (!this.document) return this.lastText ?? "";
    return this.document.getText(
      new vscode.Range(
        this.document.positionAt(this.startOffset),
        this.document.positionAt(this.endOffset),
      ),
    );
  }
}

export class SelectionReferenceTracker implements vscode.Disposable {
  private readonly references = new Set<TrackedSelection>();
  private readonly subscriptions: vscode.Disposable[];

  constructor() {
    this.subscriptions = [
      vscode.workspace.onDidChangeTextDocument((event) => {
        for (const reference of [...this.references]) reference.update(event);
      }),
      vscode.workspace.onDidCloseTextDocument((document) => {
        for (const reference of [...this.references]) reference.freeze(document);
      }),
    ];
  }

  create(
    document: vscode.TextDocument,
    range: vscode.Range,
  ): SelectionReference {
    return this.add(
      new TrackedSelection(
        this,
        document,
        document.offsetAt(range.start),
        document.offsetAt(range.end),
      ),
    );
  }

  copy(snapshot: {
    document: vscode.TextDocument | undefined;
    startOffset: number;
    endOffset: number;
    text: string;
  }): SelectionReference {
    return this.add(
      new TrackedSelection(
        this,
        snapshot.document,
        snapshot.startOffset,
        snapshot.endOffset,
        snapshot.text,
      ),
    );
  }

  release(reference: SelectionReference): void {
    this.references.delete(reference as TrackedSelection);
  }

  dispose(): void {
    for (const subscription of this.subscriptions) subscription.dispose();
    for (const reference of [...this.references]) reference.dispose();
  }

  private add(reference: TrackedSelection): SelectionReference {
    this.references.add(reference);
    return reference;
  }
}
```

- [ ] **Step 5: Run tests, typecheck, and commit**

Run:

```bash
npx jest test/commands/selectionReference.test.ts test/commands/resultsController.test.ts --runInBand
npm run typecheck
```

Expected: both suites and typecheck pass. Then commit:

```bash
git add src/commands/trackedRange.ts src/commands/selectionReference.ts src/commands/resultsController.ts test/commands/selectionReference.test.ts test/commands/resultsController.test.ts
git commit -m "feat: track editor selection references"
```

---

### Task 2: Materialize References in Pipeline Result Sources

**Files:**
- Modify: `src/commands/pipelineResult.ts:12-17`
- Modify: `src/commands/resultSource.ts`
- Modify: `test/commands/resultSource.test.ts`

**Interfaces:**
- Consumes: `SelectionReference` from Task 1.
- Produces: `PipelineArgReference = { stepIndex; argIndex; type; reference }`.
- Produces: `PipelineResultSource.references?` and optional `dispose()`.
- Produces: `createPipelineResultSource(name, steps, references?)` that owns cloned references.

- [ ] **Step 1: Add failing source materialization tests**

Extend `test/commands/resultSource.test.ts` with this fake, whose clones share text state but own separate disposal mocks:

```ts
function fakeReference(initial: string) {
  const state = { text: initial };
  const clones: SelectionReference[] = [];
  const make = (): SelectionReference => {
    const emitter = new EventEmitter<void>();
    const reference: SelectionReference = {
      get text() {
        return state.text;
      },
      onDidChange: emitter.event,
      clone: () => {
        const clone = make();
        clones.push(clone);
        return clone;
      },
      dispose: jest.fn(() => emitter.dispose()),
    };
    return reference;
  };
  return {
    reference: make(),
    clones,
    setText: (text: string) => {
      state.text = text;
    },
  };
}
```

Import `EventEmitter` from the VS Code mock and `SelectionReference` from Task 1. Add:

```ts
test("materializes current string and toggleString references for every evaluation", () => {
  const stringRef = fakeReference("first");
  const toggleRef = fakeReference("key-one");
  const source = createPipelineResultSource(
    "decode",
    [
      {
        opName: "Test",
        args: ["old", { string: "old-key", option: "UTF8" }],
      },
    ],
    [
      {
        stepIndex: 0,
        argIndex: 0,
        type: "string",
        reference: stringRef.reference,
      },
      {
        stepIndex: 0,
        argIndex: 1,
        type: "toggleString",
        reference: toggleRef.reference,
      },
    ],
  );

  source.evaluate("input");
  stringRef.setText("second");
  toggleRef.setText("key-two");
  source.evaluate("input");

  expect(runPipeline).toHaveBeenLastCalledWith("input", [
    {
      opName: "Test",
      args: ["second", { string: "key-two", option: "UTF8" }],
    },
  ]);
});

test("keeps reference metadata outside the serializable recipe and disposes clones", () => {
  const reference = fakeReference("selected");
  const source = createPipelineResultSource(
    "decode",
    [{ opName: "Test", args: ["selected"] }],
    [
      {
        stepIndex: 0,
        argIndex: 0,
        type: "string",
        reference: reference.reference,
      },
    ],
  );
  expect(source.recipe).toEqual({
    name: "decode",
    steps: [{ opName: "Test", args: ["selected"] }],
  });
  expect(JSON.stringify(source.recipe)).not.toContain("stepIndex");
  source.dispose?.();
  expect(source.references![0].reference.dispose).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run the focused source test and verify RED**

Run `npx jest test/commands/resultSource.test.ts --runInBand`.

Expected: FAIL because source reference types and materialization do not exist.

- [ ] **Step 3: Add runtime reference types**

In `pipelineResult.ts`, import `SelectionReference` and define:

```ts
export type PipelineArgReference = {
  stepIndex: number;
  argIndex: number;
  type: "string" | "toggleString";
  reference: SelectionReference;
};

export type PipelineResultSource = {
  recipe: { name: string; steps: PipelineStep[] };
  evaluate: (input: string) => string | Promise<string>;
  references?: PipelineArgReference[];
  dispose?: () => void;
};
```

- [ ] **Step 4: Materialize cloned bindings before each run**

Replace `createPipelineResultSource` with:

```ts
export function createPipelineResultSource(
  name: string,
  steps: PipelineStep[],
  references: PipelineArgReference[] = [],
): PipelineResultSource {
  const recipe = { name, steps: structuredClone(steps) };
  const runtimeReferences = references.map((binding) => ({
    ...binding,
    reference: binding.reference.clone(),
  }));
  const materialize = (): PipelineStep[] => {
    const next = structuredClone(recipe.steps);
    for (const binding of runtimeReferences) {
      const step = next[binding.stepIndex];
      if (!step || !Array.isArray(step.args)) continue;
      if (binding.type === "toggleString") {
        const current = step.args[binding.argIndex] as
          | { option?: unknown }
          | undefined;
        step.args[binding.argIndex] = {
          string: binding.reference.text,
          option: current?.option,
        };
      } else {
        step.args[binding.argIndex] = binding.reference.text;
      }
    }
    return next;
  };
  return {
    recipe,
    references: runtimeReferences,
    evaluate: (input) => runPipeline(input, materialize()),
    dispose: () => {
      for (const binding of runtimeReferences) binding.reference.dispose();
    },
  };
}
```

- [ ] **Step 5: Run tests, typecheck, and commit**

Run:

```bash
npx jest test/commands/resultSource.test.ts --runInBand
npm run typecheck
```

Expected: PASS. Commit:

```bash
git add src/commands/pipelineResult.ts src/commands/resultSource.ts test/commands/resultSource.test.ts
git commit -m "feat: materialize selection references"
```

---

### Task 3: Bind Recipe Arguments by Stable Step Identity

**Files:**
- Modify: `src/providers/recipeViewProvider.ts`
- Modify: `src/extension.ts:90-165`
- Modify: `test/commands/recipeViewProvider.test.ts`

**Interfaces:**
- Consumes: `SelectionReferenceTracker`, `SelectionReference`, and `PipelineArgReference` from Tasks 1-2.
- Changes: `RecipeCallbacks.onApply(name, steps, references)`.
- Changes: `RecipeCallbacks.getSelectionReference(): SelectionReference | undefined` replaces `getSelection()`.
- Produces: webview state `stepIds: string[]`; `edit` messages carry `stepIds` and optional `editedArg`; `useSelection` carries `stepId` and `arg`.

- [ ] **Step 1: Add failing provider tests for stable bindings and unlinking**

Refactor the test fixture to supply a fake `SelectionReference` with mutable text and an event emitter. Update existing state expectations to include `stepIds: expect.any(Array)` and update webview fixture state with `stepIds: ["step-1"]`.

Add focused tests proving:

```ts
test("reference changes update the bound plain value", async () => {
  const { onMessage, reference, v } = setupReference("first");
  await onMessage({
    type: "edit",
    name: "r",
    steps: [{ opName: "FromBase64", args: ["old", "", ""] }],
    stepIds: ["step-1"],
  });
  await onMessage({ type: "useSelection", stepId: "step-1", arg: 0 });
  reference.setText("second");
  reference.fire();
  expect(lastPostedState(v).recipe.steps[0].args[0]).toBe("second");
});

test("toggleString reference changes preserve the option", async () => {
  const { onMessage, reference, v } = setupReference("key-one");
  await onMessage({
    type: "edit",
    name: "r",
    steps: [
      {
        opName: "FromBase64",
        args: ["", { string: "old", option: "UTF8" }, ""],
      },
    ],
    stepIds: ["step-1"],
  });
  await onMessage({ type: "useSelection", stepId: "step-1", arg: 1 });
  reference.setText("key-two");
  reference.fire();
  expect(lastPostedState(v).recipe.steps[0].args[1]).toEqual({
    string: "key-two",
    option: "UTF8",
  });
});

test("reorder follows step IDs and manual target edits unlink", async () => {
  const { onMessage, reference, onApply } = setupReference("bound");
  const first = { opName: "FromBase64", args: ["first", "", ""] };
  const second = { opName: "FromBase64", args: ["second", "", ""] };
  await onMessage({
    type: "edit",
    name: "r",
    steps: [first, second],
    stepIds: ["a", "b"],
  });
  await onMessage({ type: "useSelection", stepId: "a", arg: 0 });
  await onMessage({
    type: "edit",
    name: "r",
    steps: [second, first],
    stepIds: ["b", "a"],
  });
  await onMessage({
    type: "edit",
    name: "r",
    steps: [second, { ...first, args: ["manual", "", ""] }],
    stepIds: ["b", "a"],
    editedArg: { stepId: "a", arg: 0 },
  });
  reference.setText("ignored");
  reference.fire();
  await onMessage({ type: "apply" });
  expect(onApply.mock.calls[0][1][1].args[0]).toBe("manual");
  expect(onApply.mock.calls[0][2]).toEqual([]);
  expect(reference.dispose).toHaveBeenCalled();
});
```

Also test that removing a step and `load()` dispose bindings, and that `save` receives ordinary materialized steps only.

- [ ] **Step 2: Run the provider suite and verify RED**

Run `npx jest test/commands/recipeViewProvider.test.ts --runInBand`.

Expected: FAIL because stable IDs, reference events, and new callback contracts do not exist.

- [ ] **Step 3: Add provider binding state and materialization helpers**

In `recipeViewProvider.ts`, define an internal binding and add fields:

```ts
type RecipeBinding = {
  type: "string" | "toggleString";
  reference: SelectionReference;
  subscription: vscode.Disposable;
};

private stepIds: string[] = [];
private stepSeq = 0;
private bindings = new Map<string, RecipeBinding>();

private bindingKey(stepId: string, arg: number): string {
  return JSON.stringify([stepId, arg]);
}

private parseBindingKey(key: string): [string, number] {
  return JSON.parse(key) as [string, number];
}

private nextStepId(): string {
  return `step-${++this.stepSeq}`;
}
```

Add these helpers:

```ts
private disposeBinding(key: string): void {
  const binding = this.bindings.get(key);
  if (!binding) return;
  binding.subscription.dispose();
  binding.reference.dispose();
  this.bindings.delete(key);
}

private disposeBindings(): void {
  for (const key of [...this.bindings.keys()]) this.disposeBinding(key);
}

private removeOrphanedBindings(): void {
  const live = new Set(this.stepIds);
  for (const key of [...this.bindings.keys()]) {
    if (!live.has(this.parseBindingKey(key)[0])) this.disposeBinding(key);
  }
}

private materializeBinding(
  stepId: string,
  arg: number,
  binding: RecipeBinding,
): void {
  const stepIndex = this.stepIds.indexOf(stepId);
  const step = this.recipe.steps[stepIndex];
  if (!step) return;
  if (binding.type === "toggleString") {
    const current = step.args[arg] as { option?: unknown } | undefined;
    step.args[arg] = {
      string: binding.reference.text,
      option: current?.option,
    };
  } else {
    step.args[arg] = binding.reference.text;
  }
}

private materializeAll(): void {
  for (const [key, binding] of this.bindings) {
    const [stepId, arg] = this.parseBindingKey(key);
    this.materializeBinding(stepId, arg, binding);
  }
}

private resultReferences(): PipelineArgReference[] {
  const references: PipelineArgReference[] = [];
  for (const [key, binding] of this.bindings) {
    const [stepId, argIndex] = this.parseBindingKey(key);
    const stepIndex = this.stepIds.indexOf(stepId);
    if (stepIndex < 0) continue;
    references.push({
      stepIndex,
      argIndex,
      type: binding.type,
      reference: binding.reference,
    });
  }
  return references;
}
```

- [ ] **Step 4: Replace snapshot selection with reference binding**

Change callbacks to:

```ts
export type RecipeCallbacks = {
  onApply: (
    name: string,
    steps: PipelineStep[],
    references: PipelineArgReference[],
  ) => void | Promise<void>;
  onSave: (name: string, steps: PipelineStep[]) => void | Promise<void>;
  getSelectionReference: () => SelectionReference | undefined;
};
```

For `useSelection`, validate `stepId`, locate its current index, validate the argument type, obtain a reference, replace any old binding, subscribe to `onDidChange`, materialize immediately, and post state. For `apply`, materialize all bindings and pass references mapped to current `stepIndex`; for `save`, materialize and pass only cloned ordinary steps.

For `edit`, accept `stepIds` only when they are unique strings matching the step count. Dispose removed-step bindings. If `editedArg` names a current step ID and integer argument, dispose only that binding before storing the incoming ordinary recipe.

`addOp` appends a fresh ID. `load` disposes all bindings and assigns fresh IDs. `postState` includes `stepIds`.

Implement `dispose()` as `this.disposeBindings()` and make the provider implement `vscode.Disposable`.

- [ ] **Step 5: Carry stable IDs and edited targets through webview operations**

In the embedded script:

```js
let stepIds = [];

function emitEdit(editedArg) {
  vscode.postMessage({
    type: "edit",
    name: nameEl.value,
    steps,
    stepIds,
    editedArg,
  });
}
```

Call `emitEdit({ stepId: stepIds[si], arg: ai })` only from `handleArgUpdate`. Change the name listener to `nameEl.addEventListener("input", () => emitEdit())` so the DOM event is not mistaken for an edit target. Reorder and remove call `emitEdit()` without a target. Include `stepId: stepIds[si]` in `useSelection`. Splice/move `stepIds` in parallel with `steps`, and load `msg.stepIds` with state.

- [ ] **Step 6: Wire the tracker and dynamic result source in the extension**

Instantiate one `SelectionReferenceTracker`, push it into `context.subscriptions`, and replace `getSelection` with:

```ts
getSelectionReference: () => {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.selection.isEmpty) return undefined;
  return selectionReferences.create(editor.document, editor.selection);
},
```

Change `onApply` to accept references, build one source, and use it for initial evaluation and presentation:

```ts
const source = createPipelineResultSource(name, steps, references);
const result = await source.evaluate(text);
await presentPipelineResult(
  editor,
  result,
  "Recipe",
  resultRenderers,
  undefined,
  source,
);
```

If evaluation or presentation rejects, call `source.dispose?.()` in the existing catch path before logging the recipe error. Source disposal is idempotent.

Push `recipeView` into `context.subscriptions` after making it disposable, so its bindings are released at extension shutdown.

- [ ] **Step 7: Run focused tests, typecheck, and commit**

Run:

```bash
npx jest test/commands/recipeViewProvider.test.ts test/commands/resultSource.test.ts --runInBand
npm run typecheck
```

Expected: PASS. Commit:

```bash
git add src/providers/recipeViewProvider.ts src/extension.ts test/commands/recipeViewProvider.test.ts
git commit -m "feat: bind recipe arguments to selections"
```

---

### Task 4: Recompute Results for Reference Changes

**Files:**
- Modify: `src/commands/resultsController.ts`
- Modify: `src/commands/pipelineResult.ts`
- Modify: `test/commands/resultsController.test.ts`
- Modify: `test/commands/pipelineResult.test.ts`

**Interfaces:**
- Consumes: `PipelineResultSource.references` and `dispose()` from Task 2.
- Produces: Results records that subscribe to binding changes and own source disposal.
- Produces: `presentPipelineResult` ownership rule: sidebar retains source; all other modes dispose it after presentation.

- [ ] **Step 1: Add failing Results sidebar subscription tests**

Add this helper beside `source()` in `resultsController.test.ts`:

```ts
function sourceWithReference() {
  let listener: (() => void) | undefined;
  const subscription = { dispose: jest.fn() };
  const reference: SelectionReference = {
    text: "key",
    onDidChange: jest.fn((next: () => void) => {
      listener = next;
      return subscription;
    }),
    clone: jest.fn(),
    dispose: jest.fn(),
  };
  const value = source("Recipe");
  value.references = [
    {
      stepIndex: 0,
      argIndex: 0,
      type: "string",
      reference,
    },
  ];
  value.dispose = jest.fn();
  return {
    source: value,
    fire: () => listener?.(),
    subscription,
  };
}
```

Import `SelectionReference` from `selectionReference`. Add tests with fake timers:

```ts
test("debounces reference changes and recomputes with current values", async () => {
  jest.useFakeTimers();
  const dynamic = sourceWithReference();
  const { controller } = setup(20);
  const { editor } = makeEditor(makeDocument("source.txt", "input"), 0, 5);
  controller.show(editor, "initial", target(0, 5), dynamic.source);

  dynamic.fire();
  dynamic.fire();
  await jest.advanceTimersByTimeAsync(20);

  expect(dynamic.source.evaluate).toHaveBeenCalledTimes(1);
  expect(dynamic.source.evaluate).toHaveBeenCalledWith("input");
});

test("deleting a result disposes its reference subscription and source", async () => {
  const dynamic = sourceWithReference();
  const { controller, emit, lastState } = setup();
  const { editor } = makeEditor(makeDocument("source.txt"));
  controller.show(editor, "initial", target(1, 4), dynamic.source);
  await emit({
    type: "action",
    action: "delete",
    id: lastState().items[0].id,
  });
  expect(dynamic.subscription.dispose).toHaveBeenCalledTimes(1);
  expect(dynamic.source.dispose).toHaveBeenCalledTimes(1);
});

test("closing the input document disposes result reference resources", () => {
  const dynamic = sourceWithReference();
  const { controller, close } = setup();
  const document = makeDocument("source.txt");
  const { editor } = makeEditor(document);
  controller.show(editor, "initial", target(1, 4), dynamic.source);
  close(document);
  expect(dynamic.subscription.dispose).toHaveBeenCalledTimes(1);
  expect(dynamic.source.dispose).toHaveBeenCalledTimes(1);
});

test("controller disposal releases result reference resources", () => {
  const dynamic = sourceWithReference();
  const { controller } = setup();
  const { editor } = makeEditor(makeDocument("source.txt"));
  controller.show(editor, "initial", target(1, 4), dynamic.source);
  controller.dispose();
  expect(dynamic.subscription.dispose).toHaveBeenCalledTimes(1);
  expect(dynamic.source.dispose).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Add failing result-source ownership tests**

In `pipelineResult.test.ts`, import `PipelineResultSource` and add:

```ts
function disposableSource(): PipelineResultSource {
  return {
    recipe: { name: "r", steps: [] },
    evaluate: jest.fn(),
    dispose: jest.fn(),
  };
}

test.each(["popup", "copy", "replace", "inline", "panel"] as const)(
  "%s mode disposes a runtime result source after presentation",
  async (mode) => {
    __setConfig({ pipelineResultAction: mode });
    const source = disposableSource();
    const { editor } = makeEditor();
    const render = { inline: jest.fn(), panel: jest.fn() };
    await presentPipelineResult(
      editor as unknown as TextEditor,
      "RESULT",
      "Result",
      render,
      undefined,
      source,
    );
    expect(source.dispose).toHaveBeenCalledTimes(1);
  },
);

test("sidebar transfers runtime source ownership to its renderer", async () => {
  __setConfig({ pipelineResultAction: "sidebar" });
  const source = disposableSource();
  const showSidebar = jest.fn();
  const { editor } = makeEditor();
  await presentPipelineResult(
    editor as unknown as TextEditor,
    "RESULT",
    "Result",
    { sidebar: showSidebar },
    undefined,
    source,
  );
  expect(showSidebar).toHaveBeenCalled();
  expect(source.dispose).not.toHaveBeenCalled();
});
```

- [ ] **Step 3: Run both suites and verify RED**

Run:

```bash
npx jest test/commands/resultsController.test.ts test/commands/pipelineResult.test.ts --runInBand
```

Expected: FAIL because result records do not subscribe or dispose sources, and presentation has no ownership cleanup.

- [ ] **Step 4: Subscribe and clean up result reference sources**

Add `referenceSubscriptions: vscode.Disposable[]` to `ResultRecord`. In `show`, create the record first, then subscribe each `source.references` binding with:

```ts
binding.reference.onDidChange(() => this.schedule(item))
```

Add one helper:

```ts
private disposeSource(item: ResultRecord): void {
  for (const subscription of item.referenceSubscriptions) subscription.dispose();
  item.referenceSubscriptions = [];
  item.source.dispose?.();
}
```

Call it exactly once from `remove`, `removeDocument`, and controller `dispose`. Existing input-document tracking and generation guards remain unchanged. Reference-only document close is handled by the tracker and does not remove the result.

- [ ] **Step 5: Dispose non-sidebar result sources after presentation**

Wrap `presentPipelineResult`'s mode handling in `try/finally` with `let sourceRetained = false`. Set it true only after a sidebar renderer successfully accepts a source. In `finally`, call `source?.dispose?.()` when not retained. Inline and panel renderers receive the source for existing context but do not retain ownership.

Preserve every existing result action and fallback behavior; this step changes only source lifetime.

- [ ] **Step 6: Run full verification**

Run:

```bash
npx jest test/commands/resultsController.test.ts test/commands/pipelineResult.test.ts --runInBand
npm run typecheck
npx eslint src/commands/trackedRange.ts src/commands/selectionReference.ts src/commands/resultSource.ts src/commands/pipelineResult.ts src/commands/resultsController.ts src/providers/recipeViewProvider.ts src/extension.ts test/commands/selectionReference.test.ts test/commands/resultSource.test.ts test/commands/resultsController.test.ts test/commands/pipelineResult.test.ts test/commands/recipeViewProvider.test.ts
npm test -- --runInBand
```

Expected: focused tests, typecheck, and scoped lint pass; full Jest reports all suites passing.

- [ ] **Step 7: Review and commit**

Inspect `git status`, `git diff`, and `git log --oneline -10`. Confirm `src/generated/opsRegistry.ts` remains unstaged. Commit only Task 4 files:

```bash
git add src/commands/resultsController.ts src/commands/pipelineResult.ts test/commands/resultsController.test.ts test/commands/pipelineResult.test.ts
git commit -m "feat: update results from selection references"
```
