# Operations Pane Inline Filter (WebviewView) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Operations TreeView with a WebviewView that has an inline search box filtering the list as you type, with matching module groups auto-expanded; clicking an operation still invokes `tschef.applyOperation`.

**Architecture:** A new `OperationsViewProvider` (`vscode.WebviewViewProvider`) renders a themed HTML page — sticky search `<input>`, module groups, embedded op-list JSON, and client-side filter/expand JS. Clicking a row posts `{type:"apply",opName}` → `executeCommand("tschef.applyOperation", opName)`. The old `OperationsTreeProvider` + the `tschef.filterOperations` popup command are removed.

**Tech Stack:** TypeScript, VS Code WebviewView API, Jest + ts-jest (`vscode` mocked), esbuild.

---

## File Structure

- **Create** `src/providers/operationsViewProvider.ts` — the webview provider.
- **Create** `test/commands/operationsViewProvider.test.ts` — provider tests.
- **Modify** `src/extension.ts` — register the webview provider; drop the filter command + tree provider.
- **Delete** `src/providers/operationsTreeProvider.ts` + `test/commands/operationsTreeProvider.test.ts`.
- **Modify** `package.json` — `operationsView` → `type: "webview"`; remove the filter command + view/title button.

(The mock's `TreeItem`/`ThemeIcon`/`TreeItemCollapsibleState` become unused by tests but are left as-is — harmless.)

---

## Task 1: `OperationsViewProvider` (TDD)

**Files:**
- Test: `test/commands/operationsViewProvider.test.ts` (create)
- Create: `src/providers/operationsViewProvider.ts`

- [ ] **Step 1: Write the failing test**

Create `test/commands/operationsViewProvider.test.ts`:
```ts
import { OperationsViewProvider } from "../../src/providers/operationsViewProvider";
import { commands } from "../vscode-mock";
import type { WebviewView } from "vscode";

const ITEMS = [
  { opName: "FromBase64", displayName: "From Base64", module: "Encoding" },
  { opName: "MD5", displayName: "MD5", module: "Hashing" },
];

function makeView() {
  const webview = {
    options: {} as { enableScripts?: boolean },
    html: "",
    onDidReceiveMessage: jest.fn(),
    postMessage: jest.fn(),
  };
  return { view: { webview } as unknown as WebviewView, webview };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("OperationsViewProvider", () => {
  test("resolveWebviewView enables scripts and renders an input + the ops", () => {
    const p = new OperationsViewProvider(ITEMS);
    const { view, webview } = makeView();

    p.resolveWebviewView(view);

    expect(webview.options.enableScripts).toBe(true);
    expect(webview.html).toContain("<input");
    expect(webview.html).toContain("From Base64");
    expect(webview.html).toContain("FromBase64");
    expect(webview.html).toContain("MD5");
  });

  test("an 'apply' message runs tschef.applyOperation with the opName", () => {
    const p = new OperationsViewProvider(ITEMS);
    const { view, webview } = makeView();
    p.resolveWebviewView(view);

    const onMessage = webview.onDidReceiveMessage.mock.calls[0][0];
    onMessage({ type: "apply", opName: "FromBase64" });

    expect(commands.executeCommand).toHaveBeenCalledWith(
      "tschef.applyOperation",
      "FromBase64",
    );
  });

  test("a non-apply message is ignored", () => {
    const p = new OperationsViewProvider(ITEMS);
    const { view, webview } = makeView();
    p.resolveWebviewView(view);

    const onMessage = webview.onDidReceiveMessage.mock.calls[0][0];
    onMessage({ type: "somethingElse" });

    expect(commands.executeCommand).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest test/commands/operationsViewProvider.test.ts`
Expected: FAIL — `Cannot find module '../../src/providers/operationsViewProvider'`.

- [ ] **Step 3: Implement the provider**

Create `src/providers/operationsViewProvider.ts`:
```ts
import * as vscode from "vscode";

export type OperationItem = {
  opName: string;
  displayName: string;
  module: string;
};

/**
 * Sidebar webview listing operations grouped by module with an inline
 * as-you-type filter. Matching groups auto-expand while filtering; clicking an
 * operation invokes `tschef.applyOperation` with its opName.
 */
export class OperationsViewProvider implements vscode.WebviewViewProvider {
  constructor(private readonly items: OperationItem[]) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    view.webview.options = { enableScripts: true };
    view.webview.html = this.html();
    view.webview.onDidReceiveMessage(
      (msg: { type?: string; opName?: string }) => {
        if (msg.type === "apply" && typeof msg.opName === "string") {
          vscode.commands.executeCommand("tschef.applyOperation", msg.opName);
        }
      },
    );
  }

  private html(): string {
    const data = JSON.stringify(this.items);
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
      #filter {
        position: sticky;
        top: 0;
        width: 100%;
        box-sizing: border-box;
        padding: 6px 8px;
        border: none;
        outline: none;
        color: var(--vscode-input-foreground);
        background: var(--vscode-input-background);
        border-bottom: 1px solid var(--vscode-panel-border);
      }
      .group-header {
        cursor: pointer;
        padding: 4px 8px;
        font-weight: 600;
        user-select: none;
        opacity: 0.85;
      }
      .group-header:hover {
        background: var(--vscode-list-hoverBackground);
      }
      .op {
        cursor: pointer;
        padding: 3px 8px 3px 22px;
      }
      .op:hover {
        background: var(--vscode-list-hoverBackground);
      }
      .count {
        opacity: 0.6;
        font-weight: normal;
        margin-left: 4px;
      }
    </style>
  </head>
  <body>
    <input id="filter" type="text" placeholder="Filter operations…" autofocus />
    <div id="list"></div>
    <script>
      const vscode = acquireVsCodeApi();
      const OPS = ${data};
      const listEl = document.getElementById("list");
      const filterEl = document.getElementById("filter");
      const expanded = new Set();

      function esc(s) {
        return s
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");
      }

      function groupsFor(ql) {
        const byModule = new Map();
        for (const op of OPS) {
          if (
            ql &&
            !op.displayName.toLowerCase().includes(ql) &&
            !op.opName.toLowerCase().includes(ql)
          )
            continue;
          if (!byModule.has(op.module)) byModule.set(op.module, []);
          byModule.get(op.module).push(op);
        }
        return [...byModule.entries()].sort((a, b) =>
          a[0].localeCompare(b[0]),
        );
      }

      function render() {
        const q = filterEl.value.trim().toLowerCase();
        const filtering = q.length > 0;
        const groups = groupsFor(q);
        let html = "";
        for (const [mod, ops] of groups) {
          const open = filtering || expanded.has(mod);
          html +=
            '<div class="group-header" data-mod="' +
            esc(mod) +
            '">' +
            (open ? "▾ " : "▸ ") +
            esc(mod) +
            '<span class="count">' +
            ops.length +
            "</span></div>";
          if (open) {
            ops.sort((a, b) => a.displayName.localeCompare(b.displayName));
            for (const op of ops) {
              html +=
                '<div class="op" data-op="' +
                esc(op.opName) +
                '">' +
                esc(op.displayName) +
                "</div>";
            }
          }
        }
        listEl.innerHTML = html || '<div class="op">No matches</div>';
      }

      filterEl.addEventListener("input", render);
      listEl.addEventListener("click", (e) => {
        const opEl = e.target.closest(".op[data-op]");
        if (opEl) {
          vscode.postMessage({ type: "apply", opName: opEl.dataset.op });
          return;
        }
        const hdr = e.target.closest(".group-header");
        if (hdr && !filterEl.value.trim()) {
          const mod = hdr.dataset.mod;
          if (expanded.has(mod)) expanded.delete(mod);
          else expanded.add(mod);
          render();
        }
      });

      render();
    </script>
  </body>
</html>`;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest test/commands/operationsViewProvider.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 5: Full suite + typecheck + prettier + eslint**

Run: `npm test && npm run typecheck && npx prettier --check src/providers/operationsViewProvider.ts test/commands/operationsViewProvider.test.ts && npx eslint src/providers/operationsViewProvider.ts`
Expected: all suites pass; typecheck 0; prettier clean (write + re-check if needed); eslint exits 0.

- [ ] **Step 6: Commit (do NOT stage `src/generated/opsRegistry.ts`)**

```bash
git add src/providers/operationsViewProvider.ts test/commands/operationsViewProvider.test.ts
git commit -m "feat: add OperationsViewProvider (webview, inline filter)"
```

---

## Task 2: Rewire `extension.ts` and remove the tree provider

**Files:**
- Modify: `src/extension.ts`
- Delete: `src/providers/operationsTreeProvider.ts`, `test/commands/operationsTreeProvider.test.ts`

- [ ] **Step 1: Swap the provider import**

In `src/extension.ts`, change:
```ts
import { OperationsTreeProvider } from "./providers/operationsTreeProvider";
```
to:
```ts
import { OperationsViewProvider } from "./providers/operationsViewProvider";
```

- [ ] **Step 2: Replace the construction + registration**

In `src/extension.ts`, find:
```ts
  const needsInputCache = new Map<string, boolean>();
  const opsTree = new OperationsTreeProvider(opItems, (opName) => {
    const cached = needsInputCache.get(opName);
    if (cached !== undefined) return cached;
    const entry = registry.find((e) => e.opName === opName);
    const result = entry ? operationNeedsInput(entry.factory()) : false;
    needsInputCache.set(opName, result);
    return result;
  });

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("tschef.operationsView", opsTree),
    vscode.window.registerTreeDataProvider("tschef.variablesView", varTree),
    vscode.window.registerTreeDataProvider("tschef.pipelinesView", pipeTree),
  );
```
Replace with:
```ts
  const opsView = new OperationsViewProvider(opItems);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("tschef.operationsView", opsView),
    vscode.window.registerTreeDataProvider("tschef.variablesView", varTree),
    vscode.window.registerTreeDataProvider("tschef.pipelinesView", pipeTree),
  );
```

(`opItems` stays as-is above this block. `operationNeedsInput` remains imported — it is still used by `buildOpPickItems`.)

- [ ] **Step 3: Remove the filter command registration**

In `src/extension.ts`, find:
```ts
  // ---- Commands ----

  context.subscriptions.push(
    vscode.commands.registerCommand("tschef.filterOperations", async () => {
      const value = await vscode.window.showInputBox({
        prompt: "Filter operations",
        placeHolder: "e.g. base64",
      });
      if (value === undefined) return; // cancelled — keep current filter
      opsTree.setFilter(value);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "tschef.applyOperation",
```
Replace with:
```ts
  // ---- Commands ----

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "tschef.applyOperation",
```

- [ ] **Step 4: Delete the old tree provider and its test**

```bash
git rm src/providers/operationsTreeProvider.ts test/commands/operationsTreeProvider.test.ts
```

- [ ] **Step 5: Verify**

Run: `npm run typecheck && npm run compile && npm test && npx prettier --check src/extension.ts && npx eslint src/extension.ts`
Expected: typecheck 0; esbuild emits `dist/extension.js` with no ERRORS (pre-existing d3 warnings only); all suites pass (the deleted tree-provider test is gone; the new webview-provider test remains); prettier clean; eslint exits 0.

- [ ] **Step 6: Commit (do NOT stage `src/generated/opsRegistry.ts`)**

```bash
git add src/extension.ts src/providers/operationsTreeProvider.ts test/commands/operationsTreeProvider.test.ts
git commit -m "feat: use OperationsViewProvider; drop tree provider + filter command"
```

---

## Task 3: `package.json` — webview view, remove filter command

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Make the Operations view a webview**

In `package.json`, find:
```json
        {
          "id": "tschef.operationsView",
          "name": "Operations",
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
```

- [ ] **Step 2: Remove the filter command entry**

In `package.json`, find and delete this entry (in `contributes.commands`):
```json
      {
        "command": "tschef.filterOperations",
        "title": "tschef: Filter Operations",
        "icon": "$(search)"
      },
```

- [ ] **Step 3: Remove the view/title filter button**

In `package.json`, find and delete this menu item (in `contributes.menus.view/title`):
```json
        {
          "command": "tschef.filterOperations",
          "when": "view == tschef.operationsView",
          "group": "navigation"
        },
```

- [ ] **Step 4: Verify**

Run:
```
node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('valid')" && node -e "const p=require('./package.json'); console.log('opsView type:', p.contributes.views['tschef-sidebar'].find(v=>v.id==='tschef.operationsView').type); console.log('filterOperations cmd present:', p.contributes.commands.some(c=>c.command==='tschef.filterOperations'))" && npx prettier --check package.json
```
Expected: prints `valid`; `opsView type: webview`; `filterOperations cmd present: false`; prettier clean (write + re-check if needed).

- [ ] **Step 5: Commit**

```bash
git add package.json
git commit -m "feat: contribute Operations as a webview view; remove filter command"
```

---

## Task 4: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full gate**

Run: `npm run typecheck && npm test && npm run build`
Expected: typecheck 0; all suites pass; build emits `dist/extension.js` (pre-existing d3 warnings only).

- [ ] **Step 2: Confirm the swap is complete**

Run:
```
node -e "console.log(require('./package.json').contributes.views['tschef-sidebar'].find(v=>v.id==='tschef.operationsView').type)"
grep -c "registerWebviewViewProvider" src/extension.ts
grep -rc "operationsTreeProvider\|filterOperations" src/ package.json || echo "no stale references"
```
Expected: prints `webview`; `registerWebviewViewProvider` grep prints `1`; no stale `operationsTreeProvider`/`filterOperations` references remain.

- [ ] **Step 3: Restore the generated registry if the build dirtied it**

Run: `git restore src/generated/opsRegistry.ts 2>/dev/null; git status --short`
Expected: clean working tree.

---

## Self-Review

**Spec coverage:**
- View → webview (`type: "webview"`) → Task 3 ✓
- `OperationsViewProvider` (resolveWebviewView, enableScripts, embedded ops JSON, search input, grouped collapsible list, apply message → executeCommand) → Task 1 ✓
- Client-side as-you-type filter + auto-expand of matching groups → Task 1 (client JS in `html()`) ✓
- `executeCommand("tschef.applyOperation", opName)` on row click → Task 1 ✓
- Register via `registerWebviewViewProvider`; remove filter command → Task 2 ✓
- Delete old tree provider + test → Task 2 ✓
- Remove `filterOperations` command + menu → Task 3 ✓
- `tschef.applyOperation` + `operationNeedsInput` kept → Tasks 2 (untouched apply command; helper still imported/used) ✓
- Provider tests (html has input + op names; apply message → executeCommand; non-apply ignored) → Task 1 ✓

**Placeholder scan:** No TBD/TODO; complete code in every step.

**Type consistency:** `OperationItem = { opName, displayName, module }` matches the existing `opItems` mapping reused in `extension.ts`. The message shape `{ type: "apply", opName }` matches both the client `postMessage` and the provider's `onDidReceiveMessage` handler and the test. The view id `tschef.operationsView` matches between `registerWebviewViewProvider` (Task 2) and the `type: "webview"` contribution (Task 3). Build stays green: Task 1 adds a new file; Task 2 swaps the import + deletes the now-unused provider/test together; Task 3 is declarative.
