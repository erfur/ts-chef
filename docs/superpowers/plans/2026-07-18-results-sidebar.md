# Results Sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a live Results sidebar action whose entries track source selections, recompute when their input changes, navigate back to their source and recipe, and expose popup, copy, replace, and delete actions.

**Architecture:** Extend result presentation with an optional immutable recipe/evaluator context and route the new `sidebar` mode to a dedicated `ResultsController`. Keep editor lifecycle, range tracking, filtering, and actions in that controller; keep the `ResultsViewProvider` limited to rendering serialized state and emitting typed webview messages.

**Tech Stack:** TypeScript 5, VS Code Extension API 1.85, webview HTML/CSS/JavaScript, Jest 29 with `ts-jest`, JSDOM.

## Global Constraints

- Preserve `popup` as the default `tschef.pipelineResultAction`.
- Keep results in memory only for the current extension session.
- Remove a result when its source document closes, or after Delete or Replace.
- Default the Results filter to **All tabs**.
- Reuse the existing single ts-chef result panel for Popup.
- Keep Quick Convert unchanged.
- Do not modify the existing inline CodeLens result store.
- Do not overwrite the unrelated existing change in `src/generated/opsRegistry.ts`.

## File Map

- Create `src/providers/resultsViewProvider.ts`: typed view state/messages plus Results webview rendering.
- Create `src/commands/resultsController.ts`: result records, filtering, navigation, actions, range transforms, debounce, and recomputation.
- Create `src/commands/resultSource.ts`: immutable pipeline recipe/evaluator source factory.
- Create `test/commands/resultsController.test.ts`: controller state, actions, lifecycle, tracking, and async behavior.
- Create `test/commands/resultSource.test.ts`: pipeline source snapshot and evaluator behavior.
- Create `test/commands/resultsViewProvider.test.ts`: provider/webview rendering and message behavior.
- Modify `src/commands/pipelineResult.ts`: add `sidebar` mode and optional `PipelineResultSource` passed only to custom renderers.
- Modify `src/commands/applyOperation.ts`: snapshot a direct operation as a one-step recipe and evaluator.
- Modify `src/providers/recipeViewProvider.ts`: include the recipe name in Apply callbacks.
- Modify `src/extension.ts`: register the view/controller and supply pipeline recipe snapshots.
- Modify `src/commands/webviewResult.ts`: no behavioral change; expose its existing `show` method through controller dependency wiring.
- Modify `test/vscode-mock.ts`: add document/editor lifecycle APIs required by controller tests.
- Modify `test/commands/pipelineResult.test.ts`, `test/commands/applyOperation.test.ts`, and `test/commands/recipeViewProvider.test.ts`: cover new contracts.
- Modify `test/packageContributions.test.ts` and `package.json`: contribute the Results view and `sidebar` setting.
- Modify `docs/usage.md`: document the new result action.

---

### Task 1: Sidebar Result Dispatch Contract

**Files:**
- Modify: `src/commands/pipelineResult.ts`
- Modify: `test/commands/pipelineResult.test.ts`
- Modify: `package.json`
- Modify: `test/packageContributions.test.ts`
- Modify: `docs/usage.md`

**Interfaces:**
- Produces: `PipelineResultSource`, containing `recipe: { name: string; steps: PipelineStep[] }` and `evaluate(input: string): string | Promise<string>`.
- Produces: `PipelineResultAction` with the new `"sidebar"` member.
- Produces: `ResultRenderers.sidebar`, called as `(editor, result, target, source)` only when source context exists.

- [ ] **Step 1: Add failing dispatcher and package contribution tests**

Add these imports and tests to `test/commands/pipelineResult.test.ts`:

```ts
import type { PipelineStep } from "../../src/storage/store";

test("sidebar mode delegates with source context", async () => {
  __setConfig({ pipelineResultAction: "sidebar" });
  const showSidebar = jest.fn();
  const { editor } = makeEditor();
  const source = {
    recipe: {
      name: "decode",
      steps: [{ opName: "FromBase64", args: [] }] as PipelineStep[],
    },
    evaluate: jest.fn((input: string) => input),
  };

  await presentPipelineResult(
    editor as unknown as TextEditor,
    "RESULT",
    "Recipe",
    { sidebar: showSidebar },
    undefined,
    source,
  );

  expect(showSidebar).toHaveBeenCalledWith(
    editor,
    "RESULT",
    editor.selection,
    { ...source, label: "Recipe" },
  );
  expect(window.showInformationMessage).not.toHaveBeenCalled();
});

test("sidebar mode falls back to popup without source context", async () => {
  __setConfig({ pipelineResultAction: "sidebar" });
  window.showInformationMessage.mockResolvedValue(undefined);
  const { editor } = makeEditor();

  await presentPipelineResult(
    editor as unknown as TextEditor,
    "RESULT",
    "Result",
    { sidebar: jest.fn() },
  );

  expect(window.showInformationMessage).toHaveBeenCalledWith(
    "Result: RESULT",
    "Replace",
    "Copy",
  );
});
```

Add to `test/packageContributions.test.ts`:

```ts
test("contributes the Results view and sidebar result action", () => {
  const views = pkg.contributes.views["tschef-sidebar"];
  const setting = pkg.contributes.configuration.properties[
    "tschef.pipelineResultAction"
  ];

  expect(views).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: "tschef.resultsView",
        name: "Results",
        type: "webview",
      }),
    ]),
  );
  expect(setting.enum).toContain("sidebar");
  expect(setting.default).toBe("popup");
});
```

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `npm test -- --runInBand test/commands/pipelineResult.test.ts test/packageContributions.test.ts`

Expected: FAIL because `sidebar` is absent from the renderer type/configuration and no Results view is contributed.

- [ ] **Step 3: Implement the result source and sidebar dispatch types**

Update `src/commands/pipelineResult.ts` imports/types:

```ts
import type { PipelineStep } from "../storage/store";

export type PipelineResultAction =
  | "popup"
  | "replace"
  | "copy"
  | "inline"
  | "panel"
  | "sidebar";

export type PipelineResultSource = {
  recipe: { name: string; steps: PipelineStep[] };
  evaluate: (input: string) => string | Promise<string>;
};

export type RenderedResultSource = PipelineResultSource & { label: string };

export type ResultRenderer = (
  editor: vscode.TextEditor,
  result: string,
  target: vscode.Range,
  source?: RenderedResultSource,
) => void | Promise<void>;

export type ResultRenderers = Partial<
  Record<"inline" | "panel" | "sidebar", ResultRenderer>
>;
```

Add `source?: PipelineResultSource` after `target?: vscode.Range` in `presentPipelineResult`. Replace the custom renderer branch with:

```ts
if (mode === "inline" || mode === "panel" || mode === "sidebar") {
  const renderer = render?.[mode];
  if (renderer && (mode !== "sidebar" || source)) {
    const renderedSource = source ? { ...source, label } : undefined;
    await renderer(
      editor,
      result,
      target ?? replaceTarget(editor),
      renderedSource,
    );
    return;
  }
}
```

Update existing inline/panel renderer expectations to include a fourth `undefined` argument.

- [ ] **Step 4: Contribute the setting and Results view**

Add this view immediately after Recipe in `package.json`:

```json
{
  "id": "tschef.resultsView",
  "name": "Results",
  "type": "webview",
  "contextualTitle": "tschef Results"
}
```

Append `"sidebar"` to the result action enum and this matching enum description:

```json
"Keep a live result in the ts-chef Results view with Popup/Copy/Replace/Delete actions"
```

Add a `sidebar` bullet beside the existing result action bullets in `docs/usage.md`, stating that results update when their tracked input changes and can be filtered by current/all tabs.

- [ ] **Step 5: Run focused tests and typecheck**

Run: `npm test -- --runInBand test/commands/pipelineResult.test.ts test/packageContributions.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/commands/pipelineResult.ts test/commands/pipelineResult.test.ts package.json test/packageContributions.test.ts docs/usage.md
git commit -m "feat: add sidebar result action"
```

---

### Task 2: Immutable Recipe Source Plumbing

**Files:**
- Modify: `src/commands/applyOperation.ts`
- Modify: `test/commands/applyOperation.test.ts`
- Modify: `src/providers/recipeViewProvider.ts`
- Modify: `test/commands/recipeViewProvider.test.ts`
- Modify: `src/extension.ts`

**Interfaces:**
- Consumes: `PipelineResultSource` and the optional sixth `presentPipelineResult` argument from Task 1.
- Produces: `RecipeCallbacks.onApply(name: string, steps: PipelineStep[])`.
- Produces: direct operation source contexts whose evaluator reruns the captured operation and arguments asynchronously.

- [ ] **Step 1: Add failing direct-operation source tests**

Extend the non-empty selection test in `test/commands/applyOperation.test.ts`:

```ts
test("presents an immutable one-step recipe that can recompute", async () => {
  const { editor } = makeEditor("selected");
  (window as { activeTextEditor: unknown }).activeTextEditor = editor;
  runOpMock.mockReturnValueOnce("RESULT").mockReturnValueOnce("UPDATED");

  await applyOperation("Required", entry("required"), {});

  const source = presentMock.mock.calls[0][5]!;
  expect(source.recipe).toEqual({
    name: "",
    steps: [{ opName: "Required", args: [] }],
  });
  await expect(source.evaluate("changed")).resolves.toBe("UPDATED");
  expect(runOpMock).toHaveBeenLastCalledWith("Required", "changed", []);
});
```

Update the async presentation expectation to include `expect.objectContaining({ recipe: expect.any(Object), evaluate: expect.any(Function) })` as the sixth argument.

- [ ] **Step 2: Add a failing Recipe Apply callback test**

Change the final test in `test/commands/recipeViewProvider.test.ts` to:

```ts
test("apply passes the current recipe name and steps", () => {
  const { onMessage, onApply } = setup();
  const steps = [{ opName: "FromBase64", args: [] }];
  onMessage({ type: "edit", name: "decode", steps });
  onMessage({ type: "apply" });
  expect(onApply).toHaveBeenCalledWith("decode", steps);
});
```

- [ ] **Step 3: Run tests and verify failure**

Run: `npm test -- --runInBand test/commands/applyOperation.test.ts test/commands/recipeViewProvider.test.ts`

Expected: FAIL because Apply omits the recipe name and direct operation presentation omits source context.

- [ ] **Step 4: Implement direct operation snapshots**

In `src/commands/applyOperation.ts`, deep-clone prompted arguments before execution and use that same snapshot for the initial run, recipe, and evaluator:

```ts
const capturedArgs = structuredClone(args);
const result = await runOp(opName, text, capturedArgs);
```

Replace only the existing `presentPipelineResult` call with:

```ts
await presentPipelineResult(
  editor,
  str,
  entry.displayName,
  renderers,
  target,
  {
    recipe: {
      name: "",
      steps: [{ opName, args: structuredClone(capturedArgs) }],
    },
    evaluate: async (input) =>
      resultToString(await runOp(opName, input, structuredClone(capturedArgs))),
  },
);
```

- [ ] **Step 5: Include the recipe name in Apply**

Change `RecipeCallbacks` and the apply message handler in `src/providers/recipeViewProvider.ts`:

```ts
export type RecipeCallbacks = {
  onApply: (name: string, steps: PipelineStep[]) => void | Promise<void>;
  onSave: (name: string, steps: PipelineStep[]) => void | Promise<void>;
};

case "apply":
  await this.callbacks.onApply(this.recipe.name, this.recipe.steps);
  break;
```

Update the callback declaration in `src/extension.ts` from `onApply: async
(steps) =>` to `onApply: async (_name, steps) =>`. Task 6 uses the name when it
adds pipeline source contexts; this intermediate signature keeps the branch
type-correct without changing Recipe result behavior yet.

- [ ] **Step 6: Run focused tests**

Run: `npm test -- --runInBand test/commands/applyOperation.test.ts test/commands/recipeViewProvider.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/commands/applyOperation.ts test/commands/applyOperation.test.ts src/providers/recipeViewProvider.ts test/commands/recipeViewProvider.test.ts src/extension.ts
git commit -m "feat: capture result recipe sources"
```

---

### Task 3: Results Webview Provider

**Files:**
- Create: `src/providers/resultsViewProvider.ts`
- Create: `test/commands/resultsViewProvider.test.ts`

**Interfaces:**
- Produces: `ResultFilter = "all" | "current"`.
- Produces: `ResultViewItem = { id; label; source; output?; error? }`.
- Produces: `ResultsViewState = { filter; items; totalCount }`.
- Produces: `ResultsViewMessage`, emitted through `onDidMessage`.
- Produces: `ResultsViewProvider.setState(state)`.

- [ ] **Step 1: Write failing provider state/message tests**

Create `test/commands/resultsViewProvider.test.ts` with the existing `makeView` pattern from `recipeViewProvider.test.ts` and these core assertions:

```ts
test("ready posts the latest state", () => {
  const { provider, webview, onMessage } = setup();
  provider.setState({ filter: "all", items: [], totalCount: 0 });
  onMessage({ type: "ready" });
  expect(webview.postMessage).toHaveBeenCalledWith({
    type: "state",
    filter: "all",
    items: [],
    totalCount: 0,
  });
});

test("forwards filter, open, and action messages", () => {
  const { provider, onMessage } = setup();
  const received: unknown[] = [];
  provider.onDidMessage((message) => received.push(message));

  onMessage({ type: "filter", filter: "current" });
  onMessage({ type: "open", id: 4 });
  onMessage({ type: "action", action: "copy", id: 4 });

  expect(received).toEqual([
    { type: "filter", filter: "current" },
    { type: "open", id: 4 },
    { type: "action", action: "copy", id: 4 },
  ]);
});
```

Add JSDOM tests that post a state with one success and one error and assert:

```ts
expect(document.querySelectorAll(".result")).toHaveLength(2);
expect(document.querySelector("pre")?.textContent).toBe("line 1\nline 2");
expect(document.querySelector(".error")?.textContent).toContain("bad input");
expect(
  document.querySelector<HTMLButtonElement>('[data-action="copy"][data-id="2"]')
    ?.disabled,
).toBe(true);
```

Also assert `No results yet.` for `{ filter: "all", totalCount: 0 }` and `No results in the current tab.` for `{ filter: "current", items: [], totalCount: 2 }`.

- [ ] **Step 2: Run the provider test and verify failure**

Run: `npm test -- --runInBand test/commands/resultsViewProvider.test.ts`

Expected: FAIL because `ResultsViewProvider` does not exist.

- [ ] **Step 3: Implement typed provider state and message forwarding**

Create `src/providers/resultsViewProvider.ts` with these public contracts:

```ts
import * as vscode from "vscode";

export type ResultFilter = "all" | "current";
export type ResultAction = "popup" | "copy" | "replace" | "delete";

export type ResultViewItem = {
  id: number;
  label: string;
  source: string;
  output?: string;
  error?: string;
};

export type ResultsViewState = {
  filter: ResultFilter;
  items: ResultViewItem[];
  totalCount: number;
};

export type ResultsViewMessage =
  | { type: "filter"; filter: ResultFilter }
  | { type: "open"; id: number }
  | { type: "action"; action: ResultAction; id: number };

export class ResultsViewProvider implements vscode.WebviewViewProvider {
  private view: vscode.WebviewView | undefined;
  private state: ResultsViewState = { filter: "all", items: [], totalCount: 0 };
  private readonly messages = new vscode.EventEmitter<ResultsViewMessage>();
  readonly onDidMessage = this.messages.event;

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = { enableScripts: true };
    view.webview.html = this.html();
    view.webview.onDidReceiveMessage((message) => {
      if (message?.type === "ready") this.postState();
      else if (message?.type === "filter") {
        if (message.filter === "all" || message.filter === "current")
          this.messages.fire(message);
      } else if (
        (message?.type === "open" || message?.type === "action") &&
        Number.isInteger(message.id)
      ) {
        this.messages.fire(message);
      }
    });
  }

  setState(state: ResultsViewState): void {
    this.state = state;
    this.postState();
  }

  dispose(): void {
    this.messages.dispose();
  }

  private postState(): void {
    this.view?.webview.postMessage({ type: "state", ...this.state });
  }

  private html(): string {
    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
body { color: var(--vscode-foreground); background: var(--vscode-sideBar-background);
  font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); margin: 0; }
button { font: inherit; }
.filters { display: flex; gap: 4px; padding: 6px 8px; border-bottom: 1px solid var(--vscode-panel-border); }
.filters button[aria-pressed="true"] { color: var(--vscode-button-foreground); background: var(--vscode-button-background); }
.result { padding: 7px 8px; border-bottom: 1px solid var(--vscode-panel-border); cursor: pointer; }
.result:hover { background: var(--vscode-list-hoverBackground); }
.meta { display: flex; justify-content: space-between; gap: 8px; }
.source { opacity: .7; }
pre { white-space: pre-wrap; word-break: break-word; max-height: 8em; overflow: auto; margin: 5px 0; }
.error { color: var(--vscode-errorForeground); white-space: pre-wrap; margin: 5px 0; }
.actions { display: flex; gap: 4px; }
.actions button { color: var(--vscode-button-secondaryForeground); background: var(--vscode-button-secondaryBackground); border: 0; cursor: pointer; }
.actions button:disabled { opacity: .45; cursor: default; }
.empty { padding: 10px 8px; opacity: .7; }
</style></head><body>
<div class="filters"><button data-filter="all">All tabs</button><button data-filter="current">Current tab</button></div>
<div id="results"></div>
<script>
const vscode = acquireVsCodeApi();
const results = document.getElementById("results");
const esc = (value) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (value) => esc(value).replace(/"/g, "&quot;");
function render(state) {
  document.querySelectorAll("[data-filter]").forEach((button) =>
    button.setAttribute("aria-pressed", String(button.dataset.filter === state.filter)));
  if (!state.items.length) {
    const text = state.filter === "current" && state.totalCount
      ? "No results in the current tab." : "No results yet.";
    results.innerHTML = '<div class="empty">' + text + "</div>";
    return;
  }
  results.innerHTML = state.items.map((item) => {
    const failed = item.error != null;
    const body = failed
      ? '<div class="error">' + esc(item.error) + "</div>"
      : "<pre>" + esc(item.output || "") + "</pre>";
    const disabled = failed ? " disabled" : "";
    const action = (name, label) => '<button data-action="' + name + '" data-id="' + item.id + '"' +
      (name === "delete" ? "" : disabled) + ">" + label + "</button>";
    return '<div class="result" data-id="' + item.id + '"><div class="meta"><strong>' +
      esc(item.label) + '</strong><span class="source">' + esc(item.source) + "</span></div>" + body +
      '<div class="actions">' + action("popup", "Popup") + action("copy", "Copy") +
      action("replace", "Replace") + action("delete", "Delete") + "</div></div>";
  }).join("");
}
document.querySelectorAll("[data-filter]").forEach((button) => button.addEventListener("click", () =>
  vscode.postMessage({ type: "filter", filter: button.dataset.filter })));
results.addEventListener("click", (event) => {
  const action = event.target.closest("[data-action]");
  if (action) {
    event.stopPropagation();
    vscode.postMessage({ type: "action", action: action.dataset.action, id: Number(action.dataset.id) });
    return;
  }
  const row = event.target.closest(".result");
  if (row) vscode.postMessage({ type: "open", id: Number(row.dataset.id) });
});
window.addEventListener("message", (event) => { if (event.data.type === "state") render(event.data); });
vscode.postMessage({ type: "ready" });
</script></body></html>`;
  }
}
```

- [ ] **Step 4: Run provider tests and typecheck the new file**

Run: `npm test -- --runInBand test/commands/resultsViewProvider.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/providers/resultsViewProvider.ts test/commands/resultsViewProvider.test.ts
git commit -m "feat: add results sidebar webview"
```

---

### Task 4: Results Collection, Filtering, And Actions

**Files:**
- Create: `src/commands/resultsController.ts`
- Create: `test/commands/resultsController.test.ts`
- Modify: `test/vscode-mock.ts`

**Interfaces:**
- Consumes: `RenderedResultSource` from Task 1 and view types/events from Task 3.
- Produces: `ResultsController.show(editor, result, target, source)` for the sidebar renderer.
- Produces: `ResultsController.register(context)` for lifecycle subscriptions.
- Consumes dependencies: `loadRecipe(recipe)` and `showPanel(editor, result, target)`.

- [ ] **Step 1: Extend the VS Code mock for lifecycle and navigation**

Add jest functions in `test/vscode-mock.ts`:

```ts
export const window = {
  // existing members
  showTextDocument: jest.fn(),
  onDidChangeActiveTextEditor: jest.fn(() => ({ dispose: jest.fn() })),
};

export const workspace = {
  // existing members
  onDidCloseTextDocument: jest.fn(() => ({ dispose: jest.fn() })),
  onDidChangeTextDocument: jest.fn(() => ({ dispose: jest.fn() })),
};
```

Update the explicit `workspace` type to include both lifecycle functions.

- [ ] **Step 2: Write failing collection/filter tests**

Create `test/commands/resultsController.test.ts`. Use a fake view with `setState`, an event listener capture, fake documents implementing `uri`, `fileName`, `isClosed`, `getText`, `offsetAt`, and `positionAt`, and fake editors implementing `selection`, `viewColumn`, `edit`, and `revealRange`.

Cover these exact behaviors:

```ts
controller.show(editorA, "first", rangeA, source("Recipe A"));
controller.show(editorB, "second", rangeB, source("Recipe B"));

expect(lastState()).toMatchObject({
  filter: "all",
  totalCount: 2,
  items: [
    { label: "Recipe B", source: "b.txt", output: "second" },
    { label: "Recipe A", source: "a.txt", output: "first" },
  ],
});

await emit({ type: "filter", filter: "current" });
expect(lastState().items).toHaveLength(1);
expect(lastState().items[0].source).toBe("a.txt");
```

Capture the active-editor handler registered by `register`, switch it to editor B, and assert current filtering republishes only B.

- [ ] **Step 3: Write failing navigation/action tests**

Test the provider messages:

```ts
await emit({ type: "open", id });
expect(window.showTextDocument).toHaveBeenCalledWith(document, {
  viewColumn: editor.viewColumn,
  preserveFocus: false,
});
expect(shownEditor.selection).toEqual(expect.objectContaining({
  anchor: document.positionAt(startOffset),
  active: document.positionAt(endOffset),
}));
expect(shownEditor.revealRange).toHaveBeenCalled();
expect(loadRecipe).toHaveBeenCalledWith(source.recipe);
```

Also test:

- `popup` calls `showPanel(editor, output, currentRange)` and keeps the row.
- `copy` calls `env.clipboard.writeText(output)` and keeps the row.
- `delete` removes only the selected row.
- `replace` removes the row before invoking `shownEditor.edit`, then replaces the current range with output.
- source context is deep-cloned by mutating the original recipe after `show` and asserting navigation loads the old values.
- closing document A removes all A rows but keeps B rows.

- [ ] **Step 4: Run controller tests and verify failure**

Run: `npm test -- --runInBand test/commands/resultsController.test.ts`

Expected: FAIL because `ResultsController` does not exist.

- [ ] **Step 5: Implement controller records, registration, and filtering**

Create `src/commands/resultsController.ts` with this internal record and constructor:

```ts
import * as path from "path";
import * as vscode from "vscode";
import type { PipelineStep } from "../storage/store";
import type { RenderedResultSource } from "./pipelineResult";
import {
  ResultsViewProvider,
  type ResultFilter,
  type ResultsViewMessage,
} from "../providers/resultsViewProvider";

type ResultRecord = {
  id: number;
  editor: vscode.TextEditor;
  document: vscode.TextDocument;
  startOffset: number;
  endOffset: number;
  output?: string;
  error?: string;
  source: RenderedResultSource;
  generation: number;
  timer?: ReturnType<typeof setTimeout>;
};

type ResultsDependencies = {
  loadRecipe: (recipe: { name: string; steps: PipelineStep[] }) => void;
  showPanel: (
    editor: vscode.TextEditor,
    result: string,
    target: vscode.Range,
  ) => void;
  debounceMs?: number;
};

export class ResultsController {
  private results: ResultRecord[] = [];
  private filter: ResultFilter = "all";
  private seq = 0;
  private activeUri: string | undefined;

  constructor(
    private readonly view: ResultsViewProvider,
    private readonly dependencies: ResultsDependencies,
  ) {}

  register(context: vscode.ExtensionContext): void {
    this.activeUri = vscode.window.activeTextEditor?.document.uri.toString();
    context.subscriptions.push(
      this.view.onDidMessage((message) => void this.onMessage(message)),
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor) this.activeUri = editor.document.uri.toString();
        if (this.filter === "current") this.publish();
      }),
      vscode.workspace.onDidCloseTextDocument((document) => {
        this.removeDocument(document.uri.toString());
      }),
      this.view,
    );
    this.publish();
  }

  show(
    editor: vscode.TextEditor,
    result: string,
    target: vscode.Range,
    source: RenderedResultSource,
  ): void {
    this.results.unshift({
      id: this.seq++,
      editor,
      document: editor.document,
      startOffset: editor.document.offsetAt(target.start),
      endOffset: editor.document.offsetAt(target.end),
      output: result,
      source: { ...source, recipe: structuredClone(source.recipe) },
      generation: 0,
    });
    this.publish();
  }
}
```

Implement `publish` by filtering against `activeUri`, mapping records to `ResultViewItem`, using `path.basename(record.document.fileName)`, and calling `view.setState({ filter, items, totalCount: this.results.length })`.

- [ ] **Step 6: Implement navigation and actions**

Implement private helpers with these behaviors:

```ts
private range(item: ResultRecord): vscode.Range {
  return new vscode.Range(
    item.document.positionAt(item.startOffset),
    item.document.positionAt(item.endOffset),
  );
}

private async reveal(item: ResultRecord): Promise<vscode.TextEditor | undefined> {
  if (item.document.isClosed) {
    vscode.window.showWarningMessage(
      "ts-chef: Cannot open result - the source document is closed.",
    );
    return undefined;
  }
  return vscode.window.showTextDocument(item.document, {
    viewColumn: item.editor.viewColumn,
    preserveFocus: false,
  });
}
```

`open` calls `reveal`, assigns `editor.selection = new vscode.Selection(range.start, range.end)`, calls `editor.revealRange(range)`, then `loadRecipe(structuredClone(item.source.recipe))`. `replace` captures output/range, removes the record and publishes, reveals the source, and calls `editor.edit((builder) => builder.replace(range, output))`. `copy` uses the existing status text `ts-chef: Pipeline result copied`. `popup` calls the panel dependency with the stored source editor and current range. Guard Popup/Copy/Replace with `if (item.error || item.output === undefined) return`.

Validate message actions explicitly against `popup`, `copy`, `replace`, and `delete`; ignore unknown IDs/messages.

- [ ] **Step 7: Run focused tests**

Run: `npm test -- --runInBand test/commands/resultsController.test.ts test/commands/resultsViewProvider.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/commands/resultsController.ts test/commands/resultsController.test.ts test/vscode-mock.ts
git commit -m "feat: manage sidebar results"
```

---

### Task 5: Dynamic Range Tracking And Recalculation

**Files:**
- Modify: `src/commands/resultsController.ts`
- Modify: `test/commands/resultsController.test.ts`

**Interfaces:**
- Extends: `ResultsController.register` with `workspace.onDidChangeTextDocument`.
- Produces: exported pure `transformTrackedRange(start, end, changes)` for focused offset tests.

- [ ] **Step 1: Write failing pure range-transform tests**

Add table-driven tests for `transformTrackedRange`:

```ts
test.each([
  ["edit before", 5, 9, [{ rangeOffset: 0, rangeLength: 2, text: "1234" }], 7, 11, false],
  ["edit inside", 5, 9, [{ rangeOffset: 6, rangeLength: 1, text: "XYZ" }], 5, 11, true],
  ["insert at start", 5, 9, [{ rangeOffset: 5, rangeLength: 0, text: "X" }], 5, 10, true],
  ["insert at end", 5, 9, [{ rangeOffset: 9, rangeLength: 0, text: "X" }], 5, 10, true],
  ["edit after", 5, 9, [{ rangeOffset: 10, rangeLength: 1, text: "" }], 5, 9, false],
])("tracks %s", (_name, start, end, changes, nextStart, nextEnd, changed) => {
  expect(transformTrackedRange(start, end, changes)).toEqual({
    start: nextStart,
    end: nextEnd,
    changed,
  });
});
```

Add a multi-change case where two original-document edits occur before/inside the range and assert cumulative deltas are applied once.

- [ ] **Step 2: Write failing debounce, race, error, and recovery tests**

Use `jest.useFakeTimers()` and a controller with `debounceMs: 10`. Capture the `onDidChangeTextDocument` callback from the mock. Assert:

- An edit strictly before updates the range used by Open/Replace but does not call `evaluate`.
- Two intersecting edits within 10 ms result in one evaluation with the newest tracked text.
- Resolving an older evaluation after a newer one does not overwrite the newer output.
- A rejected evaluation publishes `{ error: "bad input", output: undefined }` and a later successful edit restores `{ output: "RECOVERED", error: undefined }`.
- Popup, Copy, and Replace messages are no-ops while that item is in its error state; Delete still removes it.
- Whole-document range `0..documentLength` reruns for every content edit.
- A zero-length range ignores edits away from its offset and expands/reruns for an insertion at its offset.
- Deleting or closing a result clears its pending timer so the evaluator does not run afterward.

Use `await jest.advanceTimersByTimeAsync(10)` and flush promises before assertions.

- [ ] **Step 3: Run controller tests and verify failure**

Run: `npm test -- --runInBand test/commands/resultsController.test.ts`

Expected: FAIL because range transformation and change-driven recomputation are absent.

- [ ] **Step 4: Implement range transformation**

Add this exported helper in `src/commands/resultsController.ts`:

```ts
type OffsetChange = { rangeOffset: number; rangeLength: number; text: string };

export function transformTrackedRange(
  start: number,
  end: number,
  changes: OffsetChange[],
): { start: number; end: number; changed: boolean } {
  const sorted = [...changes].sort((a, b) => a.rangeOffset - b.rangeOffset);
  const mapBoundary = (offset: number, includeInsertion: boolean): number => {
    let delta = 0;
    for (const change of sorted) {
      const changeStart = change.rangeOffset;
      const changeEnd = changeStart + change.rangeLength;
      const difference = change.text.length - change.rangeLength;
      if (changeEnd <= offset && !(change.rangeLength === 0 && changeStart === offset)) {
        delta += difference;
        continue;
      }
      if (changeStart > offset || (change.rangeLength > 0 && changeStart === offset))
        break;
      if (change.rangeLength === 0 && changeStart === offset)
        return offset + delta + (includeInsertion ? change.text.length : 0);
      if (changeStart < offset && changeEnd > offset)
        return changeStart + delta + (includeInsertion ? change.text.length : 0);
    }
    return offset + delta;
  };

  const changed = sorted.some((change) => {
    const changeEnd = change.rangeOffset + change.rangeLength;
    return change.rangeLength === 0
      ? change.rangeOffset >= start && change.rangeOffset <= end
      : change.rangeOffset < end && changeEnd > start;
  });

  return {
    start: mapBoundary(start, false),
    end: mapBoundary(end, true),
    changed,
  };
}
```

- [ ] **Step 5: Subscribe and schedule recomputation**

Import `log` from `../logger`, then add
`workspace.onDidChangeTextDocument` to `register`. For each record matching
`event.document.uri`, transform offsets, clamp to
`event.document.getText().length`, save them, and call `schedule(item)` only
when `changed` is true.

Implement scheduling and stale-run protection:

```ts
private schedule(item: ResultRecord): void {
  if (item.timer) clearTimeout(item.timer);
  const generation = ++item.generation;
  item.timer = setTimeout(() => {
    item.timer = undefined;
    void this.recompute(item, generation);
  }, this.dependencies.debounceMs ?? 150);
}

private async recompute(item: ResultRecord, generation: number): Promise<void> {
  if (!this.results.includes(item) || item.document.isClosed) return;
  const input = item.document.getText(this.range(item));
  try {
    const output = await item.source.evaluate(input);
    if (!this.results.includes(item) || item.generation !== generation) return;
    item.output = output;
    item.error = undefined;
  } catch (error) {
    if (!this.results.includes(item) || item.generation !== generation) return;
    item.output = undefined;
    item.error = error instanceof Error ? error.message : String(error);
    log(`Result recompute error: ${error}`);
  }
  this.publish();
}
```

Centralize result removal in `remove(id)` and document cleanup in `removeDocument(uri)`. Both clear pending timers before filtering records. Increment generation when removing so already-running evaluations are invalidated.

- [ ] **Step 6: Run controller tests**

Run: `npm test -- --runInBand test/commands/resultsController.test.ts`

Expected: PASS, including fake-timer cleanup in `afterEach(() => { jest.useRealTimers(); })`.

- [ ] **Step 7: Commit**

```bash
git add src/commands/resultsController.ts test/commands/resultsController.test.ts
git commit -m "feat: update results with tracked input"
```

---

### Task 6: Extension Integration And Full Verification

**Files:**
- Create: `src/commands/resultSource.ts`
- Create: `test/commands/resultSource.test.ts`
- Modify: `src/extension.ts`

**Interfaces:**
- Consumes: all interfaces from Tasks 1-5.
- Produces: `createPipelineResultSource(name, steps): PipelineResultSource`.
- Produces: a registered `tschef.resultsView` and fully wired `sidebar` renderer for every existing result-producing flow.

- [ ] **Step 1: Write a failing immutable pipeline source test**

Create `test/commands/resultSource.test.ts`:

```ts
import { createPipelineResultSource } from "../../src/commands/resultSource";
import { runPipeline } from "../../src/commands/runner";

jest.mock("../../src/commands/runner", () => ({
  runPipeline: jest.fn(() => "UPDATED"),
}));

test("captures immutable pipeline steps and evaluates with the snapshot", () => {
  const steps = [{ opName: "ROT13", args: [] }];
  const source = createPipelineResultSource("decode", steps);
  steps[0].opName = "MD5";

  expect(source.recipe).toEqual({
    name: "decode",
    steps: [{ opName: "ROT13", args: [] }],
  });
  expect(source.evaluate("input")).toBe("UPDATED");
  expect(runPipeline).toHaveBeenCalledWith("input", source.recipe.steps);
});
```

- [ ] **Step 2: Run the source test and verify failure**

Run: `npm test -- --runInBand test/commands/resultSource.test.ts`

Expected: FAIL because `createPipelineResultSource` does not exist.

- [ ] **Step 3: Implement the source snapshot helper**

Create `src/commands/resultSource.ts`:

```ts
import type { PipelineResultSource } from "./pipelineResult";
import { runPipeline } from "./runner";
import type { PipelineStep } from "../storage/store";

export function createPipelineResultSource(
  name: string,
  steps: PipelineStep[],
): PipelineResultSource {
  const recipe = { name, steps: structuredClone(steps) };
  return {
    recipe,
    evaluate: (input) => runPipeline(input, recipe.steps),
  };
}
```

This helper guarantees that the evaluator and displayed recipe use the same immutable steps.

- [ ] **Step 4: Register the provider/controller and sidebar renderer**

In `src/extension.ts`, import `RenderedResultSource`, `ResultRenderers`,
`ResultsController`, `ResultsViewProvider`, and `createPipelineResultSource`.

Replace the current early `const resultRenderers = ...` block with this
declaration before constructing `RecipeViewProvider`:

```ts
let resultRenderers: ResultRenderers;
```

After constructing `panelResult`, construct the view and controller:

```ts
const resultsView = new ResultsViewProvider();
const resultsController = new ResultsController(resultsView, {
  loadRecipe: (recipe) => {
    vscode.commands.executeCommand("tschef.recipeView.focus");
    recipeView.load(recipe);
  },
  showPanel: (editor, result, target) =>
    panelResult.show(editor, result, target),
});
```

Because `recipeView` is currently constructed later, move Results controller construction below `recipeView` construction while leaving `panelResult` registration where it is. Then register:

```ts
resultsController.register(context);
context.subscriptions.push(
  vscode.window.registerWebviewViewProvider(
    "tschef.resultsView",
    resultsView,
    { webviewOptions: { retainContextWhenHidden: true } },
  ),
);
```

Assign `resultRenderers` immediately after constructing the controller. The
Recipe Apply callback closes over this variable but cannot execute until after
extension activation has completed:

```ts
resultRenderers = {
  inline: (editor: vscode.TextEditor, result: string, target: vscode.Range) =>
    inlineResult.show(editor, result, target),
  panel: (editor: vscode.TextEditor, result: string, target: vscode.Range) =>
    panelResult.show(editor, result, target),
  sidebar: (
    editor: vscode.TextEditor,
    result: string,
    target: vscode.Range,
    source?: RenderedResultSource,
  ) => {
    if (source) resultsController.show(editor, result, target, source);
  },
};
```

- [ ] **Step 5: Pass recipe context from all pipeline call sites**

Update Recipe Apply to receive `(name, steps)` and call:

```ts
await presentPipelineResult(
  editor,
  result,
  "Recipe",
  resultRenderers,
  undefined,
  createPipelineResultSource(name, steps),
);
```

For typed pipelines, pass `createPipelineResultSource("", steps)`. For saved pipelines, pass `createPipelineResultSource(pipeline.name, pipeline.steps)`. Keep labels and replacement targets unchanged. Direct operations are already wired by Task 2.

- [ ] **Step 6: Run focused integration regressions**

Run:

```bash
npm test -- --runInBand test/commands/pipelineResult.test.ts test/commands/applyOperation.test.ts test/commands/recipeViewProvider.test.ts test/commands/resultSource.test.ts test/commands/resultsController.test.ts test/commands/resultsViewProvider.test.ts test/packageContributions.test.ts
```

Expected: PASS.

- [ ] **Step 7: Run formatting and inspect only intended edits**

Run: `npx prettier --write src/commands/pipelineResult.ts src/commands/applyOperation.ts src/commands/resultSource.ts src/commands/resultsController.ts src/providers/recipeViewProvider.ts src/providers/resultsViewProvider.ts src/extension.ts test/commands/pipelineResult.test.ts test/commands/applyOperation.test.ts test/commands/recipeViewProvider.test.ts test/commands/resultSource.test.ts test/commands/resultsController.test.ts test/commands/resultsViewProvider.test.ts test/packageContributions.test.ts test/vscode-mock.ts package.json`

Expected: Prettier completes without touching `src/generated/opsRegistry.ts`.

- [ ] **Step 8: Run complete verification**

Run: `npm run typecheck && npm run lint && npm test -- --runInBand && npm run build`

Expected: all commands exit 0. `npm run build` may regenerate `src/generated/opsRegistry.ts`; compare it carefully and do not stage the pre-existing unrelated change.

- [ ] **Step 9: Inspect final diff and commit**

Run `git status --short`, `git diff --check`, and `git diff --stat`. Confirm the only unstaged pre-existing file is `src/generated/opsRegistry.ts` if it still differs.

```bash
git add src/extension.ts src/commands/pipelineResult.ts src/commands/applyOperation.ts src/commands/resultSource.ts src/commands/resultsController.ts src/providers/recipeViewProvider.ts src/providers/resultsViewProvider.ts test/vscode-mock.ts test/commands/pipelineResult.test.ts test/commands/applyOperation.test.ts test/commands/recipeViewProvider.test.ts test/commands/resultSource.test.ts test/commands/resultsController.test.ts test/commands/resultsViewProvider.test.ts test/packageContributions.test.ts package.json docs/usage.md
git commit -m "feat: integrate live results sidebar"
```

- [ ] **Step 10: Request code review**

Invoke `superpowers:requesting-code-review` and review the complete branch diff from the design commit `62cbb0a` through the final implementation commit. Resolve any correctness findings, rerun the complete verification command, and create a new fix commit rather than amending.
