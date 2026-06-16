# Operations Sidebar Pane Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Operations" pane to the tschef sidebar that lists all operations grouped by module with a filter, where clicking an operation applies it to the current selection via `presentPipelineResult` (honoring `pipelineResultAction`).

**Architecture:** A new `OperationsTreeProvider` (two-level: module groups → operation leaves, with a filter) decoupled from the registry via an injected item list + `needsInput` predicate. `extension.ts` builds the provider from `registry`, registers the view, and adds `tschef.filterOperations` (title-bar filter) and `tschef.applyOperation(opName)` (reuses `promptForArgs`/`runOp`/`resultToString`/the render map). A shared `operationNeedsInput` helper is extracted into `runner.ts`.

**Tech Stack:** TypeScript, VS Code TreeView API, Jest + ts-jest (`vscode` mocked via `test/vscode-mock.ts`), esbuild.

---

## File Structure

- **Modify** `src/commands/runner.ts` — export `operationNeedsInput(op)`.
- **Modify** `src/extension.ts` — use the helper in `buildOpPickItems`; build/register the provider; register the two commands.
- **Create** `src/providers/operationsTreeProvider.ts` — the tree provider.
- **Modify** `test/vscode-mock.ts` — add `TreeItem`, `ThemeIcon`, `TreeItemCollapsibleState`.
- **Create** `test/commands/operationNeedsInput.test.ts` — helper test.
- **Create** `test/commands/operationsTreeProvider.test.ts` — provider tests.
- **Modify** `package.json` — `operationsView`, `tschef.filterOperations`, view/title button.

---

## Task 1: Extract `operationNeedsInput` helper (TDD)

**Files:**
- Test: `test/commands/operationNeedsInput.test.ts` (create)
- Modify: `src/commands/runner.ts`
- Modify: `src/extension.ts` (use the helper in `buildOpPickItems`)

- [ ] **Step 1: Write the failing test**

Create `test/commands/operationNeedsInput.test.ts`:
```ts
import { operationNeedsInput } from "../../src/commands/runner";
import type { Operation } from "../../src/chef/Operation";

function op(args: unknown[]): Operation {
  return { args } as unknown as Operation;
}

describe("operationNeedsInput", () => {
  test("true when a toggleString arg has an empty value", () => {
    expect(operationNeedsInput(op([{ type: "toggleString", value: "" }]))).toBe(
      true,
    );
  });

  test("false when the toggleString arg has a value", () => {
    expect(
      operationNeedsInput(op([{ type: "toggleString", value: "Hex" }])),
    ).toBe(false);
  });

  test("false when there are no args", () => {
    expect(operationNeedsInput(op([]))).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest test/commands/operationNeedsInput.test.ts`
Expected: FAIL — `operationNeedsInput` is not exported from runner.

- [ ] **Step 3: Add the helper to `src/commands/runner.ts`**

Change the import on line 2 from:
```ts
import type { ArgConfig } from "../chef/Operation";
```
to:
```ts
import type { ArgConfig, Operation } from "../chef/Operation";
```

Then add this exported function immediately after that import line (before the `resolveDefaultArg` JSDoc):
```ts
/** True when the operation has a required free-text (empty toggleString) arg. */
export function operationNeedsInput(op: Operation): boolean {
  return op.args.some(
    (a) => a.type === "toggleString" && (a.value as string) === "",
  );
}
```

- [ ] **Step 4: Use the helper in `buildOpPickItems` (`src/extension.ts`)**

Add `operationNeedsInput` to the runner import. Change:
```ts
import {
  runOp,
  parsePipeline,
  runPipeline,
  resolveDefaultArg,
} from "./commands/runner";
```
to:
```ts
import {
  runOp,
  parsePipeline,
  runPipeline,
  resolveDefaultArg,
  operationNeedsInput,
} from "./commands/runner";
```

Then in `buildOpPickItems`, change:
```ts
      const inst = e.factory();
      const needsInput = inst.args.some(
        (a) => a.type === "toggleString" && (a.value as string) === "",
      );
```
to:
```ts
      const inst = e.factory();
      const needsInput = operationNeedsInput(inst);
```

- [ ] **Step 5: Run tests + typecheck**

Run: `npx jest test/commands/operationNeedsInput.test.ts && npm run typecheck && npx prettier --check src/commands/runner.ts src/extension.ts test/commands/operationNeedsInput.test.ts`
Expected: 3 tests pass; typecheck 0; prettier clean (write + re-check if needed).

- [ ] **Step 6: Commit**

```bash
git add src/commands/runner.ts src/extension.ts test/commands/operationNeedsInput.test.ts
git commit -m "refactor: extract operationNeedsInput helper"
```

---

## Task 2: `OperationsTreeProvider` (TDD)

**Files:**
- Modify: `test/vscode-mock.ts`
- Test: `test/commands/operationsTreeProvider.test.ts` (create)
- Create: `src/providers/operationsTreeProvider.ts`

- [ ] **Step 1: Extend the vscode mock**

Append to the END of `test/vscode-mock.ts`:
```ts
export const TreeItemCollapsibleState = {
  None: 0,
  Collapsed: 1,
  Expanded: 2,
};

export class TreeItem {
  label: string;
  collapsibleState: number | undefined;
  description?: string | boolean;
  tooltip?: string;
  iconPath?: unknown;
  command?: unknown;
  contextValue?: string;
  constructor(label: string, collapsibleState?: number) {
    this.label = label;
    this.collapsibleState = collapsibleState;
  }
}

export class ThemeIcon {
  constructor(public readonly id: string) {}
}
```

- [ ] **Step 2: Write the failing test**

Create `test/commands/operationsTreeProvider.test.ts`:
```ts
import { OperationsTreeProvider } from "../../src/providers/operationsTreeProvider";
import { TreeItemCollapsibleState } from "../vscode-mock";
import type { TreeItem, Command } from "vscode";

const ITEMS = [
  { opName: "FromBase64", displayName: "From Base64", module: "Encoding" },
  { opName: "ToBase64", displayName: "To Base64", module: "Encoding" },
  { opName: "MD5", displayName: "MD5", module: "Hashing" },
];

describe("OperationsTreeProvider", () => {
  test("top level returns one collapsed group per module, sorted, with counts", () => {
    const p = new OperationsTreeProvider(ITEMS);
    const groups = p.getChildren() as TreeItem[];

    expect(groups.map((g) => g.label)).toEqual(["Encoding", "Hashing"]);
    expect(groups[0].collapsibleState).toBe(TreeItemCollapsibleState.Collapsed);
    expect(groups[0].description).toBe("2");
    expect(groups[1].description).toBe("1");
  });

  test("expanding a group returns its op leaves sorted, with the apply command", () => {
    const p = new OperationsTreeProvider(ITEMS);
    const [encoding] = p.getChildren();
    const leaves = p.getChildren(encoding) as TreeItem[];

    expect(leaves.map((l) => l.label)).toEqual(["From Base64", "To Base64"]);
    expect(leaves[0].collapsibleState).toBe(TreeItemCollapsibleState.None);
    const cmd = leaves[0].command as Command;
    expect(cmd.command).toBe("tschef.applyOperation");
    expect(cmd.arguments).toEqual(["FromBase64"]);
  });

  test("leaves whose needsInput is true show a hint", () => {
    const p = new OperationsTreeProvider(ITEMS, (op) => op === "FromBase64");
    const [encoding] = p.getChildren();
    const leaves = p.getChildren(encoding) as TreeItem[];
    const fromB64 = leaves.find((l) => l.label === "From Base64") as TreeItem;
    const toB64 = leaves.find((l) => l.label === "To Base64") as TreeItem;

    expect(fromB64.description).toBe("needs input");
    expect(toB64.description).toBeUndefined();
  });

  test("setFilter narrows ops, omits empty groups, and expands matches", () => {
    const p = new OperationsTreeProvider(ITEMS);
    p.setFilter("base64");
    const groups = p.getChildren() as TreeItem[];

    expect(groups.map((g) => g.label)).toEqual(["Encoding"]);
    expect(groups[0].collapsibleState).toBe(TreeItemCollapsibleState.Expanded);
    const leaves = p.getChildren(groups[0]) as TreeItem[];
    expect(leaves.map((l) => l.label)).toEqual(["From Base64", "To Base64"]);
  });

  test("an empty filter restores all groups, collapsed", () => {
    const p = new OperationsTreeProvider(ITEMS);
    p.setFilter("base64");
    p.setFilter("");
    const groups = p.getChildren() as TreeItem[];

    expect(groups.map((g) => g.label)).toEqual(["Encoding", "Hashing"]);
    expect(groups[0].collapsibleState).toBe(TreeItemCollapsibleState.Collapsed);
  });

  test("filter also matches opName, not just displayName", () => {
    const p = new OperationsTreeProvider(ITEMS);
    p.setFilter("md5");
    const groups = p.getChildren() as TreeItem[];
    expect(groups.map((g) => g.label)).toEqual(["Hashing"]);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx jest test/commands/operationsTreeProvider.test.ts`
Expected: FAIL — `Cannot find module '../../src/providers/operationsTreeProvider'`.

- [ ] **Step 4: Implement the provider**

Create `src/providers/operationsTreeProvider.ts`:
```ts
import * as vscode from "vscode";

export type OperationItem = {
  opName: string;
  displayName: string;
  module: string;
};

class GroupNode extends vscode.TreeItem {
  constructor(
    public readonly module: string,
    public readonly ops: OperationItem[],
    expanded: boolean,
  ) {
    super(
      module,
      expanded
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.Collapsed,
    );
    this.description = `${ops.length}`;
    this.contextValue = "operation-group";
  }
}

class OperationNode extends vscode.TreeItem {
  constructor(
    public readonly op: OperationItem,
    needsInput: boolean,
  ) {
    super(op.displayName, vscode.TreeItemCollapsibleState.None);
    if (needsInput) this.description = "needs input";
    this.tooltip = op.opName;
    this.iconPath = new vscode.ThemeIcon("symbol-method");
    this.contextValue = "operation";
    this.command = {
      command: "tschef.applyOperation",
      title: "Apply Operation",
      arguments: [op.opName],
    };
  }
}

type Node = GroupNode | OperationNode;

/**
 * Lists operations grouped by module, with a filter. Clicking an operation
 * leaf fires `tschef.applyOperation` with its opName.
 */
export class OperationsTreeProvider implements vscode.TreeDataProvider<Node> {
  private _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private filter = "";

  constructor(
    private readonly items: OperationItem[],
    private readonly needsInput: (opName: string) => boolean = () => false,
  ) {}

  setFilter(text: string): void {
    this.filter = text.toLowerCase();
    this._onDidChangeTreeData.fire();
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: Node): vscode.TreeItem {
    return element;
  }

  getChildren(element?: Node): Node[] {
    if (element) {
      if (element instanceof GroupNode) {
        return element.ops.map(
          (op) => new OperationNode(op, this.needsInput(op.opName)),
        );
      }
      return [];
    }

    const matched = this.filter
      ? this.items.filter(
          (o) =>
            o.displayName.toLowerCase().includes(this.filter) ||
            o.opName.toLowerCase().includes(this.filter),
        )
      : this.items;

    const byModule = new Map<string, OperationItem[]>();
    for (const o of matched) {
      const mod = o.module || "Other";
      if (!byModule.has(mod)) byModule.set(mod, []);
      byModule.get(mod)!.push(o);
    }

    const expanded = this.filter.length > 0;
    return Array.from(byModule.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(
        ([mod, ops]) =>
          new GroupNode(
            mod,
            ops
              .slice()
              .sort((a, b) => a.displayName.localeCompare(b.displayName)),
            expanded,
          ),
      );
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx jest test/commands/operationsTreeProvider.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 6: Full suite + typecheck + prettier + eslint**

Run: `npm test && npm run typecheck && npx prettier --check src/providers/operationsTreeProvider.ts test/commands/operationsTreeProvider.test.ts test/vscode-mock.ts && npx eslint src/providers/operationsTreeProvider.ts`
Expected: all suites pass (0 failures); typecheck 0; prettier clean; eslint exits 0.

- [ ] **Step 7: Commit (do NOT stage `src/generated/opsRegistry.ts`)**

```bash
git add src/providers/operationsTreeProvider.ts test/commands/operationsTreeProvider.test.ts test/vscode-mock.ts
git commit -m "feat: add OperationsTreeProvider (grouped, filterable)"
```

---

## Task 3: Wire the provider + commands into `extension.ts`

**Files:**
- Modify: `src/extension.ts`

- [ ] **Step 1: Add the provider import**

In `src/extension.ts`, find:
```ts
import { PipelinesTreeProvider } from "./providers/pipelinesTreeProvider";
```
Insert immediately AFTER it:
```ts
import { OperationsTreeProvider } from "./providers/operationsTreeProvider";
```

- [ ] **Step 2: Build the provider and register the view**

In `activate()`, find:
```ts
  const varTree = new VariablesTreeProvider(varStore);
  const pipeTree = new PipelinesTreeProvider(pipeStore);

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("tschef.variablesView", varTree),
    vscode.window.registerTreeDataProvider("tschef.pipelinesView", pipeTree),
  );
```
Replace with:
```ts
  const varTree = new VariablesTreeProvider(varStore);
  const pipeTree = new PipelinesTreeProvider(pipeStore);

  const opItems = registry.map((e) => ({
    opName: e.opName,
    displayName: e.displayName,
    module: e.module || "Other",
  }));
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

- [ ] **Step 3: Register the filter + apply commands**

In `src/extension.ts`, find the line:
```ts
  // ---- Commands ----
```
Insert immediately AFTER it:
```ts

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
      async (opName: string) => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showWarningMessage("ts-chef: No active editor.");
          return;
        }
        const rawText = editor.document.getText(editor.selection);
        if (!rawText) {
          vscode.window.showWarningMessage("ts-chef: Select text first.");
          return;
        }
        const text = resolveVars(rawText, varStore);
        const entry = registry.find((e) => e.opName === opName);
        if (!entry) return;
        const args = await promptForArgs(entry.factory());
        if (args === null) return;
        try {
          const str = resultToString(runOp(opName, text, args));
          if (str === "" && text !== "") {
            vscode.window.showWarningMessage(
              `ts-chef: "${entry.displayName}" produced an empty result — nothing replaced.`,
            );
            return;
          }
          await presentPipelineResult(editor, str, entry.displayName, {
            inline: (ed, res) => inlineResult.show(ed, res),
            panel: (ed, res) => panelResult.show(ed, res),
          });
          log(`applyOperation: "${entry.displayName}" applied`);
        } catch (e) {
          log(`applyOperation error: ${e}`);
          vscode.window.showErrorMessage(`ts-chef: ${e}`);
        }
      },
    ),
  );
```

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run compile && npx prettier --check src/extension.ts && npx eslint src/extension.ts`
Expected: typecheck 0; esbuild emits `dist/extension.js` with no ERRORS (pre-existing d3 warnings only); prettier clean; eslint exits 0.

- [ ] **Step 5: Commit (do NOT stage `src/generated/opsRegistry.ts`)**

```bash
git add src/extension.ts
git commit -m "feat: register Operations view + filter/apply commands"
```

---

## Task 4: `package.json` — view, command, menu

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add the Operations view (first in the sidebar)**

In `package.json`, find:
```json
    "views": {
      "tschef-sidebar": [
        {
          "id": "tschef.variablesView",
          "name": "Variables",
          "contextualTitle": "tschef Variables"
        },
```
Replace with:
```json
    "views": {
      "tschef-sidebar": [
        {
          "id": "tschef.operationsView",
          "name": "Operations",
          "contextualTitle": "tschef Operations"
        },
        {
          "id": "tschef.variablesView",
          "name": "Variables",
          "contextualTitle": "tschef Variables"
        },
```

- [ ] **Step 2: Add the filter command**

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
        "command": "tschef.filterOperations",
        "title": "tschef: Filter Operations",
        "icon": "$(search)"
      },
```

- [ ] **Step 3: Add the view/title filter button**

In `package.json`, find:
```json
      "view/title": [
        {
          "command": "tschef.addVariable",
          "when": "view == tschef.variablesView",
          "group": "navigation"
        },
```
Replace with:
```json
      "view/title": [
        {
          "command": "tschef.filterOperations",
          "when": "view == tschef.operationsView",
          "group": "navigation"
        },
        {
          "command": "tschef.addVariable",
          "when": "view == tschef.variablesView",
          "group": "navigation"
        },
```

- [ ] **Step 4: Verify**

Run:
```
node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('valid')" && node -e "console.log(require('./package.json').contributes.views['tschef-sidebar'].map(v=>v.id).join(','))" && npx prettier --check package.json
```
Expected: prints `valid`; prints `tschef.operationsView,tschef.variablesView,tschef.pipelinesView`; prettier clean (write + re-check if needed).

- [ ] **Step 5: Commit**

```bash
git add package.json
git commit -m "feat: contribute Operations view + filter command"
```

---

## Task 5: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full gate**

Run: `npm run typecheck && npm test && npm run build`
Expected: typecheck 0; all suites pass (operationNeedsInput + OperationsTreeProvider tests included); build emits `dist/extension.js` (pre-existing d3 warnings only).

- [ ] **Step 2: Confirm view + commands wired**

Run:
```
node -e "console.log(require('./package.json').contributes.views['tschef-sidebar'].map(v=>v.id).join(','))"
grep -c "tschef.applyOperation" src/extension.ts
grep -c "tschef.filterOperations" src/extension.ts
```
Expected: prints the 3 view ids including `tschef.operationsView`; both greps print at least `1`.

- [ ] **Step 3: Restore the generated registry if the build dirtied it**

Run: `git restore src/generated/opsRegistry.ts 2>/dev/null; git status --short`
Expected: clean working tree.

---

## Self-Review

**Spec coverage:**
- New `operationsView` first in sidebar → Task 4 ✓
- `OperationsTreeProvider` (module groups → leaves, injected items + needsInput, filter) → Task 2 ✓
- Leaf fires `tschef.applyOperation` with `[opName]`; needsInput hint → Task 2 ✓
- Filter command (`$(search)` title button, input box, empty clears, cancel keeps) → Tasks 3 & 4 ✓
- `applyOperation`: require selection, resolveVars, promptForArgs, runOp, presentPipelineResult with render map → Task 3 ✓
- `operationNeedsInput` extracted, used by `buildOpPickItems` + the provider predicate → Tasks 1 & 3 ✓
- Mock additions (`TreeItem`/`ThemeIcon`/`TreeItemCollapsibleState`) → Task 2 ✓
- Tests for helper + provider → Tasks 1 & 2 ✓

**Placeholder scan:** No TBD/TODO; complete code in every step.

**Type consistency:** `OperationItem = { opName, displayName, module }` is used by the provider (Task 2), the test items, and the `opItems` mapping in `extension.ts` (Task 3). `operationNeedsInput(op: Operation)` (Task 1) is used in `buildOpPickItems` and the provider predicate. The provider's leaf `command.arguments = [opName]` matches `tschef.applyOperation(opName)` (Task 3). The view id `tschef.operationsView` matches between `registerTreeDataProvider` (Task 3) and the `views` contribution (Task 4). `tschef.filterOperations` matches between the command registration (Task 3), the contribution, and the menu (Task 4). Build stays green: Task 1 self-contained; Task 2 new file; Task 3 wires existing pieces; Task 4 declarative.
