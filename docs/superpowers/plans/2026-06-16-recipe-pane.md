# Recipe Sidebar Pane Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Recipe" sidebar webview holding one working pipeline — built by ＋-adding operations from the Operations pane, named, reordered/removed in-pane, applied to the selection, saved into the pipelines list, and re-loadable from each pipeline entry.

**Architecture:** A new `RecipeViewProvider` (`WebviewViewProvider`) holds the canonical working recipe `{ name, steps }` and renders it (name input, step list with in-pane drag reorder + remove, Apply/Save buttons). It takes injected `onApply`/`onSave` callbacks. The Operations pane gets a ＋ per row → `executeCommand("tschef.addToRecipe", opName)`. `extension.ts` wires the callbacks (run via `presentPipelineResult`; save via `pipeStore.upsert`), the `addToRecipe`/`loadRecipe` commands, and an inline "Load into Recipe" button on the Pipelines tree.

**Tech Stack:** TypeScript, VS Code WebviewView API, Jest + ts-jest (`vscode` mocked), esbuild.

---

## File Structure

- **Create** `src/providers/recipeViewProvider.ts` — the recipe webview.
- **Create** `test/commands/recipeViewProvider.test.ts` — provider tests.
- **Modify** `src/providers/operationsViewProvider.ts` — ＋ per op row + `addToRecipe` message routing.
- **Modify** `test/commands/operationsViewProvider.test.ts` — add an `addToRecipe` test.
- **Modify** `src/extension.ts` — construct/register the recipe view; `addToRecipe` + `loadRecipe` commands.
- **Modify** `package.json` — `recipeView` (webview), `tschef.loadRecipe` command, `view/item/context` inline button.

(No change to `pipelinesTreeProvider.ts`: `PipelineNode` already exposes `.pipeline` and `contextValue = "pipeline-<scope>"`.)

---

## Task 1: `RecipeViewProvider` (TDD)

**Files:**
- Test: `test/commands/recipeViewProvider.test.ts` (create)
- Create: `src/providers/recipeViewProvider.ts`

- [ ] **Step 1: Write the failing test**

Create `test/commands/recipeViewProvider.test.ts`:
```ts
import { RecipeViewProvider } from "../../src/providers/recipeViewProvider";
import type { WebviewView } from "vscode";

const ITEMS = [
  { opName: "FromBase64", displayName: "From Base64", module: "Encoding" },
];

function makeView() {
  const webview = {
    options: {} as { enableScripts?: boolean },
    html: "",
    onDidReceiveMessage: jest.fn(),
    postMessage: jest.fn(),
  };
  const view = { webview, show: jest.fn() };
  return { view: view as unknown as WebviewView, webview, show: view.show };
}

function setup() {
  const onApply = jest.fn();
  const onSave = jest.fn();
  const p = new RecipeViewProvider(ITEMS, { onApply, onSave });
  const v = makeView();
  p.resolveWebviewView(v.view);
  const onMessage = v.webview.onDidReceiveMessage.mock.calls[0][0] as (
    m: unknown,
  ) => void;
  return { p, v, onApply, onSave, onMessage };
}

beforeEach(() => jest.clearAllMocks());

describe("RecipeViewProvider", () => {
  test("resolveWebviewView enables scripts and renders name input + buttons", () => {
    const { v } = setup();
    expect(v.webview.options.enableScripts).toBe(true);
    expect(v.webview.html).toContain('id="name"');
    expect(v.webview.html).toContain("Apply to selection");
    expect(v.webview.html).toContain("Save as pipeline");
  });

  test("ready posts the empty recipe state", () => {
    const { v, onMessage } = setup();
    onMessage({ type: "ready" });
    expect(v.webview.postMessage).toHaveBeenCalledWith({
      type: "state",
      recipe: { name: "", steps: [] },
    });
  });

  test("edit updates the canonical recipe; save passes it to onSave", () => {
    const { onMessage, onSave } = setup();
    const steps = [{ opName: "FromBase64", args: [] }];
    onMessage({ type: "edit", name: "r1", steps });
    onMessage({ type: "save" });
    expect(onSave).toHaveBeenCalledWith("r1", steps);
  });

  test("addOp appends a step and posts state", () => {
    const { p, v } = setup();
    v.webview.postMessage.mockClear();
    p.addOp({ opName: "FromBase64", args: [] });
    expect(v.webview.postMessage).toHaveBeenCalledWith({
      type: "state",
      recipe: { name: "", steps: [{ opName: "FromBase64", args: [] }] },
    });
  });

  test("load replaces the recipe, reveals the view, and posts state", () => {
    const { p, v } = setup();
    v.webview.postMessage.mockClear();
    p.load({ name: "p", steps: [{ opName: "MD5", args: [] }] });
    expect(v.show).toHaveBeenCalled();
    expect(v.webview.postMessage).toHaveBeenCalledWith({
      type: "state",
      recipe: { name: "p", steps: [{ opName: "MD5", args: [] }] },
    });
  });

  test("apply passes the current steps to onApply", () => {
    const { onMessage, onApply } = setup();
    const steps = [{ opName: "FromBase64", args: [] }];
    onMessage({ type: "edit", name: "", steps });
    onMessage({ type: "apply" });
    expect(onApply).toHaveBeenCalledWith(steps);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest test/commands/recipeViewProvider.test.ts`
Expected: FAIL — `Cannot find module '../../src/providers/recipeViewProvider'`.

- [ ] **Step 3: Implement the provider**

Create `src/providers/recipeViewProvider.ts`:
```ts
import * as vscode from "vscode";
import type { PipelineStep } from "../storage/store";

type Recipe = { name: string; steps: PipelineStep[] };

export type RecipeCallbacks = {
  onApply: (steps: PipelineStep[]) => void | Promise<void>;
  onSave: (name: string, steps: PipelineStep[]) => void | Promise<void>;
};

/**
 * Sidebar webview holding one working "recipe" (a single pipeline). Operations
 * are appended via `addOp` (the Operations pane's ＋), reordered/removed in the
 * webview, applied to the selection, and saved into the pipelines list. The
 * controller holds the canonical recipe so it survives hide/show and loads.
 */
export class RecipeViewProvider implements vscode.WebviewViewProvider {
  private view: vscode.WebviewView | undefined;
  private recipe: Recipe = { name: "", steps: [] };

  constructor(
    private readonly items: { opName: string; displayName: string }[],
    private readonly callbacks: RecipeCallbacks,
  ) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = { enableScripts: true };
    view.webview.html = this.html();
    view.webview.onDidReceiveMessage(
      (msg: { type?: string; name?: string; steps?: PipelineStep[] }) => {
        switch (msg.type) {
          case "ready":
            this.postState();
            break;
          case "edit":
            this.recipe = {
              name: msg.name ?? "",
              steps: Array.isArray(msg.steps) ? msg.steps : [],
            };
            break;
          case "apply":
            this.callbacks.onApply(this.recipe.steps);
            break;
          case "save":
            this.callbacks.onSave(this.recipe.name, this.recipe.steps);
            break;
        }
      },
    );
  }

  /** Append an operation step to the working recipe. */
  addOp(step: PipelineStep): void {
    this.recipe.steps.push(step);
    this.postState();
  }

  /** Replace the working recipe with a saved pipeline and reveal the pane. */
  load(pipeline: { name: string; steps: PipelineStep[] }): void {
    this.recipe = { name: pipeline.name, steps: pipeline.steps };
    this.view?.show?.(false);
    this.postState();
  }

  private postState(): void {
    this.view?.webview.postMessage({ type: "state", recipe: this.recipe });
  }

  private html(): string {
    const names: Record<string, string> = {};
    for (const it of this.items) names[it.opName] = it.displayName;
    const namesData = JSON.stringify(names).replace(/</g, "\\u003c");
    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <style>
      body {
        color: var(--vscode-foreground);
        font-family: var(--vscode-font-family);
        padding: 0;
        margin: 0;
      }
      #name {
        width: 100%;
        box-sizing: border-box;
        padding: 6px 8px;
        border: none;
        outline: none;
        color: var(--vscode-input-foreground);
        background: var(--vscode-input-background);
        border-bottom: 1px solid var(--vscode-panel-border);
      }
      #steps {
        padding: 4px 0;
      }
      .step {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 3px 8px;
        cursor: grab;
      }
      .step:hover {
        background: var(--vscode-list-hoverBackground);
      }
      .idx {
        opacity: 0.6;
        min-width: 1.4em;
        text-align: right;
      }
      .label {
        flex: 1;
      }
      .rm {
        cursor: pointer;
        opacity: 0.7;
      }
      .rm:hover {
        opacity: 1;
      }
      .empty {
        padding: 8px;
        opacity: 0.6;
      }
      .actions {
        display: flex;
        gap: 6px;
        padding: 8px;
        border-top: 1px solid var(--vscode-panel-border);
      }
      button {
        flex: 1;
        color: var(--vscode-button-foreground);
        background: var(--vscode-button-background);
        border: none;
        padding: 5px 8px;
        cursor: pointer;
        border-radius: 2px;
      }
      button:hover {
        background: var(--vscode-button-hoverBackground);
      }
    </style>
  </head>
  <body>
    <input id="name" type="text" placeholder="Recipe name…" />
    <div id="steps"></div>
    <div class="actions">
      <button id="apply">Apply to selection</button>
      <button id="save">Save as pipeline</button>
    </div>
    <script>
      const vscode = acquireVsCodeApi();
      const NAMES = ${namesData};
      const nameEl = document.getElementById("name");
      const stepsEl = document.getElementById("steps");
      let steps = [];
      let dragIdx = -1;

      function esc(s) {
        return String(s)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
      }
      function label(op) {
        return NAMES[op] || op;
      }

      function render() {
        if (!steps.length) {
          stepsEl.innerHTML =
            '<div class="empty">Empty recipe — add operations with ＋ from the Operations pane.</div>';
          return;
        }
        let html = "";
        steps.forEach((s, i) => {
          html +=
            '<div class="step" draggable="true" data-i="' +
            i +
            '"><span class="idx">' +
            (i + 1) +
            '</span><span class="label">' +
            esc(label(s.opName)) +
            '</span><span class="rm" data-rm="' +
            i +
            '" title="Remove">✕</span></div>';
        });
        stepsEl.innerHTML = html;
      }

      function emitEdit() {
        vscode.postMessage({ type: "edit", name: nameEl.value, steps });
      }

      nameEl.addEventListener("input", emitEdit);
      document
        .getElementById("apply")
        .addEventListener("click", () => vscode.postMessage({ type: "apply" }));
      document
        .getElementById("save")
        .addEventListener("click", () => vscode.postMessage({ type: "save" }));

      stepsEl.addEventListener("click", (e) => {
        const rm = e.target.closest("[data-rm]");
        if (rm) {
          steps.splice(Number(rm.dataset.rm), 1);
          render();
          emitEdit();
        }
      });
      stepsEl.addEventListener("dragstart", (e) => {
        const el = e.target.closest(".step");
        if (el) dragIdx = Number(el.dataset.i);
      });
      stepsEl.addEventListener("dragover", (e) => e.preventDefault());
      stepsEl.addEventListener("drop", (e) => {
        e.preventDefault();
        const el = e.target.closest(".step");
        if (!el || dragIdx < 0) return;
        const to = Number(el.dataset.i);
        const moved = steps.splice(dragIdx, 1)[0];
        steps.splice(to, 0, moved);
        dragIdx = -1;
        render();
        emitEdit();
      });

      window.addEventListener("message", (e) => {
        const msg = e.data;
        if (msg.type === "state") {
          nameEl.value = msg.recipe.name || "";
          steps = Array.isArray(msg.recipe.steps) ? msg.recipe.steps : [];
          render();
        }
      });

      vscode.postMessage({ type: "ready" });
      render();
    </script>
  </body>
</html>`;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest test/commands/recipeViewProvider.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 5: Full suite + typecheck + prettier + eslint**

Run: `npm test && npm run typecheck && npx prettier --check src/providers/recipeViewProvider.ts test/commands/recipeViewProvider.test.ts && npx eslint src/providers/recipeViewProvider.ts`
Expected: all suites pass; typecheck 0; prettier clean (write + re-check if needed); eslint exits 0.

- [ ] **Step 6: Commit (do NOT stage `src/generated/opsRegistry.ts`)**

```bash
git add src/providers/recipeViewProvider.ts test/commands/recipeViewProvider.test.ts
git commit -m "feat: add RecipeViewProvider (working-recipe webview)"
```

---

## Task 2: ＋ "add to recipe" on the Operations pane (TDD)

**Files:**
- Test: `test/commands/operationsViewProvider.test.ts`
- Modify: `src/providers/operationsViewProvider.ts`

- [ ] **Step 1: Add the failing test**

In `test/commands/operationsViewProvider.test.ts`, add this test inside the `describe(...)` block:
```ts
  test("an 'addToRecipe' message runs tschef.addToRecipe with the opName", () => {
    const p = new OperationsViewProvider(ITEMS);
    const { view, webview } = makeView();
    p.resolveWebviewView(view);

    const onMessage = webview.onDidReceiveMessage.mock.calls[0][0];
    onMessage({ type: "addToRecipe", opName: "FromBase64" });

    expect(commands.executeCommand).toHaveBeenCalledWith(
      "tschef.addToRecipe",
      "FromBase64",
    );
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest test/commands/operationsViewProvider.test.ts`
Expected: FAIL — the provider ignores `addToRecipe` (executeCommand not called).

- [ ] **Step 3: Route the message** — in `src/providers/operationsViewProvider.ts`, change:
```ts
    view.webview.onDidReceiveMessage(
      (msg: { type?: string; opName?: string }) => {
        if (msg.type === "apply" && typeof msg.opName === "string") {
          vscode.commands.executeCommand("tschef.applyOperation", msg.opName);
        }
      },
    );
```
to:
```ts
    view.webview.onDidReceiveMessage(
      (msg: { type?: string; opName?: string }) => {
        if (typeof msg.opName !== "string") return;
        if (msg.type === "apply") {
          vscode.commands.executeCommand("tschef.applyOperation", msg.opName);
        } else if (msg.type === "addToRecipe") {
          vscode.commands.executeCommand("tschef.addToRecipe", msg.opName);
        }
      },
    );
```

- [ ] **Step 4: Add the ＋ button to each row (HTML/CSS/JS)** — three edits in the `html()` template of the same file:

(a) Replace the `.op` CSS block:
```css
      .op {
        cursor: pointer;
        padding: 3px 8px 3px 22px;
      }
      .op:hover {
        background: var(--vscode-list-hoverBackground);
      }
```
with:
```css
      .op {
        cursor: pointer;
        padding: 3px 8px 3px 22px;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .op:hover {
        background: var(--vscode-list-hoverBackground);
      }
      .op-label {
        flex: 1;
      }
      .op-add {
        opacity: 0.55;
        padding: 0 4px;
      }
      .op-add:hover {
        opacity: 1;
      }
```

(b) Replace the row construction:
```js
              html +=
                '<div class="op" data-op="' +
                esc(op.opName) +
                '">' +
                esc(op.displayName) +
                "</div>";
```
with:
```js
              html +=
                '<div class="op" data-op="' +
                esc(op.opName) +
                '"><span class="op-label">' +
                esc(op.displayName) +
                '</span><span class="op-add" title="Add to recipe">＋</span></div>';
```

(c) Replace the start of the list click handler:
```js
      listEl.addEventListener("click", (e) => {
        const opEl = e.target.closest(".op[data-op]");
        if (opEl) {
          vscode.postMessage({ type: "apply", opName: opEl.dataset.op });
          return;
        }
```
with:
```js
      listEl.addEventListener("click", (e) => {
        const addEl = e.target.closest(".op-add");
        if (addEl) {
          const row = addEl.closest(".op[data-op]");
          if (row)
            vscode.postMessage({ type: "addToRecipe", opName: row.dataset.op });
          return;
        }
        const opEl = e.target.closest(".op[data-op]");
        if (opEl) {
          vscode.postMessage({ type: "apply", opName: opEl.dataset.op });
          return;
        }
```

- [ ] **Step 5: Run tests + checks**

Run: `npx jest test/commands/operationsViewProvider.test.ts && npm run typecheck && npx prettier --check src/providers/operationsViewProvider.ts test/commands/operationsViewProvider.test.ts && npx eslint src/providers/operationsViewProvider.ts`
Expected: provider tests pass (4 total); typecheck 0; prettier clean; eslint exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/providers/operationsViewProvider.ts test/commands/operationsViewProvider.test.ts
git commit -m "feat: add ＋ add-to-recipe action to the Operations pane"
```

---

## Task 3: Wire the recipe view + commands into `extension.ts`

**Files:**
- Modify: `src/extension.ts`

- [ ] **Step 1: Imports**

In `src/extension.ts`, after:
```ts
import { OperationsViewProvider } from "./providers/operationsViewProvider";
```
add:
```ts
import { RecipeViewProvider } from "./providers/recipeViewProvider";
```

And change:
```ts
import { VariableStore, PipelineStore, StorageScope } from "./storage/store";
```
to:
```ts
import {
  VariableStore,
  PipelineStore,
  StorageScope,
  ScopedPipeline,
} from "./storage/store";
```

- [ ] **Step 2: Construct + register the recipe view**

In `activate()`, find:
```ts
  const panelResult = new WebviewResultController();
  panelResult.register(context);

  // ---- Commands ----
```
Replace with:
```ts
  const panelResult = new WebviewResultController();
  panelResult.register(context);

  const recipeView = new RecipeViewProvider(opItems, {
    onApply: async (steps) => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage("ts-chef: No active editor.");
        return;
      }
      const rawText =
        editor.document.getText(editor.selection) ||
        editor.document.getText();
      const text = resolveVars(rawText, varStore);
      try {
        const result = runPipeline(text, steps);
        await presentPipelineResult(editor, result, "Recipe", {
          inline: (ed, res) => inlineResult.show(ed, res),
          panel: (ed, res) => panelResult.show(ed, res),
        });
      } catch (e) {
        log(`Recipe apply error: ${e}`);
        vscode.window.showErrorMessage(`ts-chef recipe error: ${e}`);
      }
    },
    onSave: async (name, steps) => {
      if (!name) {
        vscode.window.showWarningMessage(
          "ts-chef: Name the recipe before saving.",
        );
        return;
      }
      if (!steps.length) {
        vscode.window.showWarningMessage("ts-chef: Recipe is empty.");
        return;
      }
      const scope = await pickScope();
      if (!scope) return;
      const raw = steps.map((s) => s.opName).join(" | ");
      pipeStore.upsert(scope, { name, steps, raw });
      pipeTree.refresh();
      log(`Recipe "${name}" saved as pipeline (${scope})`);
      vscode.window.showInformationMessage(
        `ts-chef: Recipe "${name}" saved (${scope}).`,
      );
    },
  });

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      "tschef.recipeView",
      recipeView,
      { webviewOptions: { retainContextWhenHidden: true } },
    ),
  );

  // ---- Commands ----

  context.subscriptions.push(
    vscode.commands.registerCommand("tschef.addToRecipe", (opName: string) => {
      const entry = registry.find((e) => e.opName === opName);
      if (!entry) return;
      const step = {
        opName,
        args: entry.factory().args.map((a) => resolveDefaultArg(a)),
      };
      recipeView.addOp(step);
      vscode.commands.executeCommand("tschef.recipeView.focus");
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "tschef.loadRecipe",
      (node?: { pipeline?: ScopedPipeline }) => {
        const pipeline = node?.pipeline;
        if (!pipeline) return;
        vscode.commands.executeCommand("tschef.recipeView.focus");
        recipeView.load(pipeline);
      },
    ),
  );
```

- [ ] **Step 3: Verify**

Run: `npm run typecheck && npm run compile && npm test && npx prettier --check src/extension.ts && npx eslint src/extension.ts`
Expected: typecheck 0; esbuild emits `dist/extension.js` with no ERRORS (pre-existing d3 warnings only); all suites pass; prettier clean (write + re-check if needed); eslint exits 0.

- [ ] **Step 4: Commit (do NOT stage `src/generated/opsRegistry.ts`)**

```bash
git add src/extension.ts
git commit -m "feat: wire Recipe view + addToRecipe/loadRecipe commands"
```

---

## Task 4: `package.json` — recipe view, command, menu

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add the Recipe view (2nd, after Operations)**

In `package.json`, find:
```json
        {
          "id": "tschef.operationsView",
          "name": "Operations",
          "type": "webview",
          "contextualTitle": "tschef Operations"
        },
```
Replace with:
```json
        {
          "id": "tschef.operationsView",
          "name": "Operations",
          "type": "webview",
          "contextualTitle": "tschef Operations"
        },
        {
          "id": "tschef.recipeView",
          "name": "Recipe",
          "type": "webview",
          "contextualTitle": "tschef Recipe"
        },
```

- [ ] **Step 2: Add the loadRecipe command**

In `package.json`, find:
```json
      {
        "command": "tschef.quickConvert",
        "title": "tschef: Quick Convert Selection"
      },
```
Replace with:
```json
      {
        "command": "tschef.quickConvert",
        "title": "tschef: Quick Convert Selection"
      },
      {
        "command": "tschef.loadRecipe",
        "title": "tschef: Load Pipeline into Recipe",
        "icon": "$(arrow-right)"
      },
```

- [ ] **Step 3: Add the view/item/context inline button**

In `package.json`, find:
```json
        {
          "command": "tschef.runSavedPipelinePicker",
          "when": "view == tschef.pipelinesView",
          "group": "navigation"
        }
      ]
    }
```
Replace with:
```json
        {
          "command": "tschef.runSavedPipelinePicker",
          "when": "view == tschef.pipelinesView",
          "group": "navigation"
        }
      ],
      "view/item/context": [
        {
          "command": "tschef.loadRecipe",
          "when": "view == tschef.pipelinesView && viewItem =~ /^pipeline-/",
          "group": "inline"
        }
      ]
    }
```

- [ ] **Step 4: Verify**

Run:
```
node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('valid')" && node -e "const p=require('./package.json'); console.log('views:', p.contributes.views['tschef-sidebar'].map(v=>v.id).join(',')); console.log('loadRecipe cmd:', p.contributes.commands.some(c=>c.command==='tschef.loadRecipe')); console.log('item ctx:', !!p.contributes.menus['view/item/context'])" && npx prettier --check package.json
```
Expected: `valid`; views include `tschef.operationsView,tschef.recipeView,tschef.variablesView,tschef.pipelinesView`; `loadRecipe cmd: true`; `item ctx: true`; prettier clean (write + re-check if needed).

- [ ] **Step 5: Commit**

```bash
git add package.json
git commit -m "feat: contribute Recipe view + Load-into-Recipe button"
```

---

## Task 5: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full gate**

Run: `npm run typecheck && npm test && npm run build`
Expected: typecheck 0; all suites pass (RecipeViewProvider + the new Operations test included); build emits `dist/extension.js` (pre-existing d3 warnings only).

- [ ] **Step 2: Confirm wiring**

Run:
```
node -e "console.log(require('./package.json').contributes.views['tschef-sidebar'].map(v=>v.id).join(','))"
grep -c "registerWebviewViewProvider(\s*$\|\"tschef.recipeView\"" src/extension.ts
grep -c "tschef.addToRecipe\|tschef.loadRecipe" src/extension.ts
```
Expected: views list includes `tschef.recipeView`; both greps print at least the expected counts (recipeView registered; addToRecipe + loadRecipe present).

- [ ] **Step 3: Restore the generated registry if the build dirtied it**

Run: `git restore src/generated/opsRegistry.ts 2>/dev/null; git status --short`
Expected: clean working tree.

---

## Self-Review

**Spec coverage:**
- New `recipeView` webview (2nd pane, retainContextWhenHidden) → Tasks 3 & 4 ✓
- `RecipeViewProvider` canonical recipe; addOp/load; ready/edit/apply/save protocol; name input + steps list + Apply/Save → Task 1 ✓
- Temporary recipe default (`{name:"",steps:[]}`) + empty name → Task 1 ✓
- ＋ on Operations rows → `addToRecipe` → executeCommand → Task 2 ✓
- `addToRecipe` builds a default-arg step + reveals pane; `loadRecipe` loads a pipeline → Task 3 ✓
- onApply via `presentPipelineResult` (honors pipelineResultAction); onSave via `pipeStore.upsert` + tree refresh → Task 3 ✓
- "Load into Recipe" inline button on pipeline entries → Task 4 ✓
- Tests for provider + the addToRecipe routing → Tasks 1 & 2 ✓

**Placeholder scan:** No TBD/TODO; complete code in every step.

**Type consistency:** `PipelineStep = { opName, args }` is used in `RecipeViewProvider`, the step built in `tschef.addToRecipe`, and `onSave`/`onApply`. `RecipeCallbacks.onApply(steps)` / `onSave(name, steps)` match the message handlers and the `extension.ts` callbacks. `recipeView.addOp(step)` / `recipeView.load(pipeline)` match the command call sites. The view id `tschef.recipeView` matches between `registerWebviewViewProvider` (Task 3), the `tschef.recipeView.focus` reveal command, and the `views` contribution (Task 4). `tschef.addToRecipe`/`tschef.loadRecipe` match between the Operations message routing (Task 2), the command registrations (Task 3), and the menu/contribution (Task 4). `pipeStore.upsert` and `ScopedPipeline` match `store.ts`. Build stays green: Task 1 & 2 are isolated; Task 3 wires existing pieces; Task 4 is declarative.
