# System-wide (global) Presets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users save ts-chef pipelines and variables system-wide (global scope) so they are available in every workspace, while keeping today's per-workspace storage.

**Architecture:** A scope-aware storage layer. `PipelineStore` and `VariableStore` each read/write two scopes — `workspace` (unchanged location) and `global` (backed by `context.globalStorageUri`). User-facing lists show the merge of both scopes, each item tagged with its scope. Saving defaults to global; the user can pick workspace per save. Variable resolution gives workspace precedence over global.

**Tech Stack:** TypeScript, VS Code extension API (`ExtensionContext.globalStorageUri`, TreeDataProvider, Webview, QuickPick), Jest + ts-jest.

**Spec:** `docs/superpowers/specs/2026-06-14-system-wide-presets-design.md`

---

## Prerequisites

- Dependencies must be installed: run `npm install` (or `npm ci`) once before starting. `node_modules` may be absent.
- All work happens on branch `feature/system-wide-presets` (already created).
- Commit messages must NOT add a co-author or Claude attribution.

## File Structure

| File | Responsibility | Action |
| --- | --- | --- |
| `src/storage/store.ts` | Scope-aware `PipelineStore` / `VariableStore`, scope types | Modify (core) |
| `test/vscode-mock.ts` | Minimal `vscode` mock for unit tests | Create |
| `jest.config.js` | Map `vscode` import to the mock | Modify |
| `package.json` | Add `typecheck` script | Modify |
| `test/storage/store.test.ts` | Unit tests for the scope-aware stores | Create |
| `src/extension.ts` | Build `globalDir`, scope picker, scoped commands | Modify |
| `src/panels/pipelinePanel.ts` | Scope `<select>`, `hasWorkspace`, scoped save | Modify |
| `src/providers/pipelinesTreeProvider.ts` | Merged list, scope tag, scoped run command | Modify |
| `src/providers/variablesTreeProvider.ts` | Merged list, scope tag | Modify |
| `README.md` | Document global presets | Modify |

> **Note on the type-check gate:** `src/storage/store.ts` changes its public API in Task 2. Its callers (extension, panel, providers) are updated in Tasks 3–5. Until all callers are updated, `npm run typecheck` reports errors in the not-yet-updated files. Each task below states which errors are expected to remain; the project type-checks cleanly at the end of Task 5.

---

## Task 1: Test infrastructure (vscode mock + jest mapping + typecheck script)

**Files:**
- Create: `test/vscode-mock.ts`
- Modify: `jest.config.js`
- Modify: `package.json` (scripts)

- [ ] **Step 1: Create the minimal vscode mock**

Create `test/vscode-mock.ts`:

```ts
/**
 * Minimal `vscode` mock for unit tests. Only the surface used by
 * src/storage/store.ts is implemented. `workspace.workspaceFolders` is
 * settable so tests can simulate an open/closed folder.
 */
export const window = {
  showWarningMessage: jest.fn(),
};

export const workspace: {
  workspaceFolders: { uri: { fsPath: string } }[] | undefined;
} = {
  workspaceFolders: undefined,
};
```

- [ ] **Step 2: Map the `vscode` import to the mock in jest.config.js**

In `jest.config.js`, add a `moduleNameMapper` entry. The full file becomes:

```js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.js', '**/test/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  moduleNameMapper: {
    '^vscode$': '<rootDir>/test/vscode-mock.ts',
  },
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  verbose: true,
  transformIgnorePatterns: [
    "node_modules/(?!(geodesy)/)"
  ],
  reporters: [
    'default',
    ['jest-html-reporters', {
      publicPath: './test-report',
      filename: 'index.html',
      expand: true,
    }]
  ]
};
```

- [ ] **Step 3: Add a `typecheck` script to package.json**

In `package.json`, inside `"scripts"`, add this entry (place it next to `"lint"`):

```json
    "typecheck": "tsc --noEmit -p tsconfig.json",
```

(Resulting fragment, for reference:)

```json
    "lint": "eslint .",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "lint:fix": "eslint . --fix",
```

- [ ] **Step 4: Verify the existing test suite still passes**

Run: `npx jest test/runner.test.ts`
Expected: PASS (the new jest config does not affect existing tests; `vscode` mapping is unused here).

- [ ] **Step 5: Commit**

```bash
git add test/vscode-mock.ts jest.config.js package.json
git commit -m "test: add vscode mock, jest module mapping, and typecheck script"
```

---

## Task 2: Scope-aware storage layer

**Files:**
- Modify: `src/storage/store.ts`
- Test: `test/storage/store.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/storage/store.test.ts`:

```ts
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { PipelineStore, VariableStore, Pipeline } from "../../src/storage/store";
import * as vscode from "vscode";

// `vscode` is the mock from test/vscode-mock.ts (via moduleNameMapper).
const mockVscode = vscode as unknown as {
  workspace: { workspaceFolders?: { uri: { fsPath: string } }[] };
  window: { showWarningMessage: jest.Mock };
};

function mkTmp(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

const samplePipeline = (name: string): Pipeline => ({
  name,
  description: "d",
  raw: "From Base64",
  steps: [{ opName: "FromBase64", args: [] }],
});

describe("scope-aware stores", () => {
  let globalDir: string;
  let wsDir: string;

  beforeEach(() => {
    globalDir = mkTmp("tschef-global-");
    wsDir = mkTmp("tschef-ws-");
    mockVscode.workspace.workspaceFolders = [{ uri: { fsPath: wsDir } }];
    mockVscode.window.showWarningMessage.mockClear();
  });

  afterEach(() => {
    fs.rmSync(globalDir, { recursive: true, force: true });
    fs.rmSync(wsDir, { recursive: true, force: true });
  });

  test("global pipeline save persists and loads tagged global", () => {
    const store = new PipelineStore(globalDir);
    store.upsert("global", samplePipeline("g1"));
    expect(fs.existsSync(path.join(globalDir, "pipelines.json"))).toBe(true);
    const all = store.loadAll();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe("g1");
    expect(all[0].scope).toBe("global");
  });

  test("workspace pipeline save persists under workspace dir tagged workspace", () => {
    const store = new PipelineStore(globalDir);
    store.upsert("workspace", samplePipeline("w1"));
    expect(fs.existsSync(path.join(wsDir, ".ts-chef", "pipelines.json"))).toBe(true);
    const all = store.loadAll();
    expect(all).toHaveLength(1);
    expect(all[0].scope).toBe("workspace");
  });

  test("loadAll merges both scopes, workspace first", () => {
    const store = new PipelineStore(globalDir);
    store.upsert("global", samplePipeline("g1"));
    store.upsert("workspace", samplePipeline("w1"));
    const all = store.loadAll();
    expect(all.map((p) => [p.name, p.scope])).toEqual([
      ["w1", "workspace"],
      ["g1", "global"],
    ]);
  });

  test("same name in both scopes coexist (upsert isolates by scope)", () => {
    const store = new PipelineStore(globalDir);
    store.upsert("global", samplePipeline("X"));
    store.upsert("workspace", samplePipeline("X"));
    const all = store.loadAll();
    expect(all).toHaveLength(2);
    expect(all.map((p) => p.scope).sort()).toEqual(["global", "workspace"]);
  });

  test("delete only affects the target scope", () => {
    const store = new PipelineStore(globalDir);
    store.upsert("global", samplePipeline("X"));
    store.upsert("workspace", samplePipeline("X"));
    store.delete("workspace", "X");
    const all = store.loadAll();
    expect(all).toHaveLength(1);
    expect(all[0].scope).toBe("global");
  });

  test("variable get: workspace overrides global", () => {
    const store = new VariableStore(globalDir);
    store.set("global", "key", "G");
    store.set("workspace", "key", "W");
    expect(store.get("key")).toBe("W");
  });

  test("variable get falls back to global when no workspace value", () => {
    const store = new VariableStore(globalDir);
    store.set("global", "key", "G");
    expect(store.get("key")).toBe("G");
  });

  test("workspace save with no folder open warns and writes nothing", () => {
    mockVscode.workspace.workspaceFolders = undefined;
    const store = new PipelineStore(globalDir);
    store.upsert("workspace", samplePipeline("w1"));
    expect(mockVscode.window.showWarningMessage).toHaveBeenCalled();
    expect(store.loadAll()).toHaveLength(0);
  });

  test("global save with no folder open succeeds", () => {
    mockVscode.workspace.workspaceFolders = undefined;
    const store = new PipelineStore(globalDir);
    store.upsert("global", samplePipeline("g1"));
    expect(store.loadAll()).toHaveLength(1);
    expect(mockVscode.window.showWarningMessage).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest test/storage/store.test.ts`
Expected: FAIL — compile errors such as "Expected 1 arguments, but got 2" on `upsert`/`set`, and "Property 'loadAll' does not exist", because `store.ts` still has the old single-scope API.

- [ ] **Step 3: Rewrite `src/storage/store.ts` with the scope-aware API**

Replace the entire contents of `src/storage/store.ts` with:

```ts
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

export type StorageScope = "workspace" | "global";

/** Resolve the per-workspace storage directory, or undefined if no folder is open. */
function workspaceStoreDir(): string | undefined {
  const ws = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!ws) return undefined;
  const vscodePath = path.join(ws, ".vscode");
  if (fs.existsSync(vscodePath)) return path.join(vscodePath, "ts-chef");
  return path.join(ws, ".ts-chef");
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJSON<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

function writeJSON(file: string, data: unknown): void {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");
}

// ---- Variables ----

export interface Variable {
  name: string;
  value: string;
  description?: string;
}

export interface ScopedVariable extends Variable {
  scope: StorageScope;
}

export class VariableStore {
  constructor(private globalDir: string) {}

  private dir(scope: StorageScope): string | undefined {
    return scope === "global" ? this.globalDir : workspaceStoreDir();
  }

  load(scope: StorageScope): Variable[] {
    const dir = this.dir(scope);
    if (!dir) return [];
    return readJSON<Variable[]>(path.join(dir, "variables.json"), []);
  }

  /** Merged view of both scopes; workspace items first. */
  loadAll(): ScopedVariable[] {
    const ws = this.load("workspace").map((v) => ({
      ...v,
      scope: "workspace" as const,
    }));
    const gl = this.load("global").map((v) => ({
      ...v,
      scope: "global" as const,
    }));
    return [...ws, ...gl];
  }

  save(scope: StorageScope, vars: Variable[]): void {
    const dir = this.dir(scope);
    if (!dir) {
      vscode.window.showWarningMessage(
        "ts-chef: open a workspace folder to save variables.",
      );
      return;
    }
    ensureDir(dir);
    writeJSON(path.join(dir, "variables.json"), vars);
  }

  /** Resolve a variable value; workspace overrides global. */
  get(name: string): string | undefined {
    const ws = this.load("workspace").find((v) => v.name === name);
    if (ws) return ws.value;
    return this.load("global").find((v) => v.name === name)?.value;
  }

  set(
    scope: StorageScope,
    name: string,
    value: string,
    description?: string,
  ): void {
    const vars = this.load(scope).filter((v) => v.name !== name);
    vars.push({ name, value, description });
    this.save(scope, vars);
  }

  delete(scope: StorageScope, name: string): void {
    this.save(
      scope,
      this.load(scope).filter((v) => v.name !== name),
    );
  }
}

// ---- Pipelines ----

export interface PipelineStep {
  opName: string;
  args: unknown[];
}

export interface Pipeline {
  name: string;
  description?: string;
  steps: PipelineStep[];
  raw: string; // original pipe syntax
}

export interface ScopedPipeline extends Pipeline {
  scope: StorageScope;
}

export class PipelineStore {
  constructor(private globalDir: string) {}

  private dir(scope: StorageScope): string | undefined {
    return scope === "global" ? this.globalDir : workspaceStoreDir();
  }

  load(scope: StorageScope): Pipeline[] {
    const dir = this.dir(scope);
    if (!dir) return [];
    return readJSON<Pipeline[]>(path.join(dir, "pipelines.json"), []);
  }

  /** Merged view of both scopes; workspace items first. */
  loadAll(): ScopedPipeline[] {
    const ws = this.load("workspace").map((p) => ({
      ...p,
      scope: "workspace" as const,
    }));
    const gl = this.load("global").map((p) => ({
      ...p,
      scope: "global" as const,
    }));
    return [...ws, ...gl];
  }

  save(scope: StorageScope, pipelines: Pipeline[]): void {
    const dir = this.dir(scope);
    if (!dir) {
      vscode.window.showWarningMessage(
        "ts-chef: open a workspace folder to save pipelines.",
      );
      return;
    }
    ensureDir(dir);
    writeJSON(path.join(dir, "pipelines.json"), pipelines);
  }

  upsert(scope: StorageScope, pipeline: Pipeline): void {
    const list = this.load(scope).filter((p) => p.name !== pipeline.name);
    list.push(pipeline);
    this.save(scope, list);
  }

  delete(scope: StorageScope, name: string): void {
    this.save(
      scope,
      this.load(scope).filter((p) => p.name !== name),
    );
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest test/storage/store.test.ts`
Expected: PASS — all 9 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/storage/store.ts test/storage/store.test.ts
git commit -m "feat: scope-aware pipeline and variable stores (workspace + global)"
```

---

## Task 3: Wire global storage and scope into extension commands

**Files:**
- Modify: `src/extension.ts`

- [ ] **Step 1: Update the store import to include `StorageScope`**

In `src/extension.ts`, change the storage import (currently line 8):

```ts
import { VariableStore, PipelineStore, StorageScope } from "./storage/store";
```

- [ ] **Step 2: Remove the now-invalid unused `load()` call in `resolveVars`**

In `resolveVars` (near the top), delete the unused line `const vars = varStore.load();`. The function becomes:

```ts
/** Replace $varName / {{varName}} references with stored variable values. */
function resolveVars(text: string, varStore: VariableStore): string {
  return text
    .replace(
      /\{\{([^}]+)\}\}/g,
      (_, name) => varStore.get(name.trim()) ?? `{{${name}}}`,
    )
    .replace(
      /\$([A-Za-z_][A-Za-z0-9_-]*)/g,
      (_, name) => varStore.get(name) ?? `$${name}`,
    );
}
```

- [ ] **Step 3: Add a module-level `pickScope` helper**

Add this function just below `resolveVars` (before `promptForArgs`):

```ts
/**
 * Ask where to save. Defaults to global. When no workspace folder is open,
 * global is the only option, so it is returned without prompting.
 * Returns undefined if the user cancels.
 */
async function pickScope(): Promise<StorageScope | undefined> {
  const hasWorkspace = !!vscode.workspace.workspaceFolders?.length;
  if (!hasWorkspace) return "global";
  const pick = await vscode.window.showQuickPick(
    [
      { label: "Global (all workspaces)", scope: "global" as const },
      { label: "Workspace", scope: "workspace" as const },
    ],
    { placeHolder: "Save to which scope?" },
  );
  return pick?.scope;
}
```

- [ ] **Step 4: Build the global dir and pass it to the stores**

Replace the two store constructions in `activate` (currently lines 102-103):

```ts
  const globalDir = context.globalStorageUri.fsPath;
  const varStore = new VariableStore(globalDir);
  const pipeStore = new PipelineStore(globalDir);
```

- [ ] **Step 5: Add a scope prompt to `tschef.setVariable`**

In the `tschef.setVariable` command, after the `desc` input box and before refreshing the tree, replace the existing `varStore.set(name, value, desc ?? undefined);` line with:

```ts
      const scope = await pickScope();
      if (!scope) return;
      varStore.set(scope, name, value, desc ?? undefined);
```

- [ ] **Step 6: Make `tschef.showVariables` scope-aware**

Replace the body of the `tschef.showVariables` command with:

```ts
    vscode.commands.registerCommand("tschef.showVariables", async () => {
      const vars = varStore.loadAll();
      if (!vars.length) {
        vscode.window.showInformationMessage("ts-chef: No variables defined.");
        return;
      }
      const items = vars.map((v) => ({
        label: v.name,
        description: `${v.scope === "global" ? "Global" : "Workspace"} · ${v.value}`,
        detail: v.description,
        scope: v.scope,
        value: v.value,
      }));
      const action = await vscode.window.showQuickPick(
        [
          { label: "$(add) Add variable", action: "add" as const },
          ...items.map((i) => ({ ...i, action: "inspect" as const })),
        ],
        { placeHolder: "Variables — pick to delete/edit" },
      );
      if (!action) return;
      if (action.action === "add") {
        vscode.commands.executeCommand("tschef.setVariable");
        return;
      }
      const choice = await vscode.window.showQuickPick(
        [
          { label: "$(edit) Edit value" },
          { label: "$(trash) Delete" },
          { label: "$(copy) Copy value" },
        ],
        { placeHolder: `Variable: ${action.label}` },
      );
      if (!choice) return;
      if (choice.label.includes("Delete")) {
        varStore.delete(action.scope, action.label);
        varTree.refresh();
      }
      if (choice.label.includes("Edit")) {
        const newVal = await vscode.window.showInputBox({
          value: action.value,
          prompt: "New value",
        });
        if (newVal !== undefined) {
          varStore.set(action.scope, action.label, newVal);
          varTree.refresh();
        }
      }
      if (choice.label.includes("Copy")) {
        if (action.value) vscode.env.clipboard.writeText(action.value);
      }
    }),
```

- [ ] **Step 7: Make `tschef.runSavedPipeline` accept an optional scope**

Replace the handler signature and lookup at the top of the `tschef.runSavedPipeline` command. Change:

```ts
      async (name: string) => {
        const pipeline = pipeStore.load().find((p) => p.name === name);
        if (!pipeline) return;
```

to:

```ts
      async (name: string, scope?: StorageScope) => {
        const all = pipeStore.loadAll();
        const pipeline = scope
          ? all.find((p) => p.name === name && p.scope === scope)
          : all.find((p) => p.name === name);
        if (!pipeline) return;
```

(The rest of the handler is unchanged — it uses `pipeline.steps`.)

- [ ] **Step 8: Make `tschef.runSavedPipelinePicker` show scope and forward it**

Replace the body of the `tschef.runSavedPipelinePicker` command with:

```ts
      async () => {
        const pipelines = pipeStore.loadAll();
        if (!pipelines.length) {
          vscode.window.showInformationMessage(
            "ts-chef: No saved pipelines. Save one in the Pipeline Editor first.",
          );
          return;
        }
        const picked = await vscode.window.showQuickPick(
          pipelines.map((p) => ({
            label: p.name,
            description: `${p.scope === "global" ? "Global" : "Workspace"} · ${p.description ?? ""}`,
            detail: p.raw,
            name: p.name,
            scope: p.scope,
          })),
          {
            placeHolder: "Select a saved pipeline to run…",
            matchOnDescription: true,
            matchOnDetail: true,
          },
        );
        if (!picked) return;
        vscode.commands.executeCommand(
          "tschef.runSavedPipeline",
          picked.name,
          picked.scope,
        );
      },
```

- [ ] **Step 9: Type-check**

Run: `npm run typecheck`
Expected: errors ONLY in `src/panels/pipelinePanel.ts`, `src/providers/pipelinesTreeProvider.ts`, and `src/providers/variablesTreeProvider.ts` (they still use the old API — fixed in Tasks 4 and 5). There must be NO errors reported in `src/extension.ts` or `src/storage/store.ts`.

- [ ] **Step 10: Commit**

```bash
git add src/extension.ts
git commit -m "feat: scope-aware variable and pipeline commands with global default"
```

---

## Task 4: Scope selector in the pipeline editor webview

**Files:**
- Modify: `src/panels/pipelinePanel.ts`

- [ ] **Step 1: Import scope types**

In `src/panels/pipelinePanel.ts`, change the storage import (line 2):

```ts
import {
  PipelineStore,
  Pipeline,
  PipelineStep,
  ScopedPipeline,
  StorageScope,
} from "../storage/store";
```

- [ ] **Step 2: Allow the editor to open with a scoped pipeline**

Change the `open` static method signature and the constructor `initial` parameter type from `Pipeline` to `ScopedPipeline`:

In `open(...)`:

```ts
  static open(
    context: vscode.ExtensionContext,
    store: PipelineStore,
    initial?: ScopedPipeline,
  ): void {
```

In the `private constructor(...)`:

```ts
  private constructor(
    panel: vscode.WebviewPanel,
    private store: PipelineStore,
    private context: vscode.ExtensionContext,
    initial?: ScopedPipeline,
  ) {
```

And change `buildHtml`'s parameter type:

```ts
  private buildHtml(initial?: ScopedPipeline): string {
```

- [ ] **Step 3: Save to the chosen scope**

In `handleMessage`, replace the `case "save":` block's `this.store.upsert({...})` call so it reads the scope from the message (default global):

```ts
      case "save": {
        const name = (msg.name as string).trim();
        if (!name) {
          vscode.window.showWarningMessage("Pipeline name required.");
          return;
        }
        try {
          const steps = msg.steps
            ? (msg.steps as PipelineStep[])
            : parsePipeline(msg.raw as string);
          const raw =
            (msg.raw as string) || steps.map((s) => s.opName).join(" | ");
          const scope = (msg.scope as StorageScope) ?? "global";
          this.store.upsert(scope, {
            name,
            raw,
            steps,
            description: msg.description as string | undefined,
          });
          vscode.commands.executeCommand("tschef.refreshPipelines");
          log(`Pipeline "${name}" saved to ${scope} (${steps.length} step(s))`);
          vscode.window.showInformationMessage(
            `ts-chef: Pipeline "${name}" saved (${scope}).`,
          );
        } catch (e) {
          vscode.window.showErrorMessage(`ts-chef parse error: ${e}`);
        }
        break;
      }
```

- [ ] **Step 4: Add the scope `<select>` to the header HTML**

In `buildHtml`, just after the existing initial-value declarations near the top of the method, add:

```ts
    const initialScope: StorageScope = initial?.scope ?? "global";
    const hasWorkspace = !!vscode.workspace.workspaceFolders?.length;
```

Then, in the returned HTML, replace the Save button line inside `<div class="hdr">`:

```html
  <button class="btn" onclick="savePipeline()">Save</button>
```

with a scope selector followed by the Save button:

```html
  <select id="pipeScope" class="btn-sec" title="Where to save this pipeline">
    <option value="global" ${initialScope === "global" ? "selected" : ""}>Global</option>
    <option value="workspace" ${initialScope === "workspace" ? "selected" : ""} ${hasWorkspace ? "" : "disabled"}>Workspace</option>
  </select>
  <button class="btn" onclick="savePipeline()">Save</button>
```

- [ ] **Step 5: Send the selected scope in the save message**

In the inline webview `<script>`, update `savePipeline()` to include the scope:

```js
function savePipeline() {
  const raw = document.getElementById('pipeText').value.trim();
  const name = document.getElementById('pipeName').value.trim();
  const description = document.getElementById('pipeDesc').value.trim();
  const scope = document.getElementById('pipeScope').value;
  vscode.postMessage({
    type: 'save',
    raw,
    name,
    description,
    scope,
    steps: steps.map(s => ({ opName: s.opName, args: s.argValues })),
  });
}
```

- [ ] **Step 6: Type-check**

Run: `npm run typecheck`
Expected: errors ONLY in `src/providers/pipelinesTreeProvider.ts` and `src/providers/variablesTreeProvider.ts` (fixed in Task 5). NO errors in `src/panels/pipelinePanel.ts`.

- [ ] **Step 7: Commit**

```bash
git add src/panels/pipelinePanel.ts
git commit -m "feat: scope selector in pipeline editor, default global"
```

---

## Task 5: Scope-tagged tree views

**Files:**
- Modify: `src/providers/pipelinesTreeProvider.ts`
- Modify: `src/providers/variablesTreeProvider.ts`

- [ ] **Step 1: Update the pipelines tree provider**

Replace the entire contents of `src/providers/pipelinesTreeProvider.ts` with:

```ts
import * as vscode from "vscode";
import { PipelineStore, ScopedPipeline } from "../storage/store";

class PipelineNode extends vscode.TreeItem {
  constructor(public readonly pipeline: ScopedPipeline) {
    super(pipeline.name, vscode.TreeItemCollapsibleState.None);
    const scopeLabel = pipeline.scope === "global" ? "Global" : "Workspace";
    const desc = pipeline.description ?? pipeline.raw.slice(0, 50);
    this.description = `${scopeLabel} · ${desc}`;
    this.tooltip = pipeline.raw;
    this.contextValue = `pipeline-${pipeline.scope}`;
    this.iconPath = new vscode.ThemeIcon("symbol-event");
    this.command = {
      command: "tschef.runSavedPipeline",
      title: "Run Pipeline",
      arguments: [pipeline.name, pipeline.scope],
    };
  }
}

export class PipelinesTreeProvider
  implements vscode.TreeDataProvider<PipelineNode>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private store: PipelineStore) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }
  getTreeItem(e: PipelineNode): vscode.TreeItem {
    return e;
  }
  getChildren(): PipelineNode[] {
    return this.store.loadAll().map((p) => new PipelineNode(p));
  }
}
```

- [ ] **Step 2: Update the variables tree provider**

Replace the entire contents of `src/providers/variablesTreeProvider.ts` with:

```ts
import * as vscode from "vscode";
import { VariableStore, ScopedVariable } from "../storage/store";

class VariableNode extends vscode.TreeItem {
  constructor(public readonly variable: ScopedVariable) {
    super(variable.name, vscode.TreeItemCollapsibleState.None);
    const scopeLabel = variable.scope === "global" ? "Global" : "Workspace";
    const val =
      variable.value.length > 40
        ? variable.value.slice(0, 40) + "…"
        : variable.value;
    this.description = `${scopeLabel} · ${val}`;
    this.tooltip = `${variable.name}: ${variable.value}${variable.description ? "\n" + variable.description : ""}`;
    this.contextValue = `variable-${variable.scope}`;
    this.iconPath = new vscode.ThemeIcon("key");
  }
}

export class VariablesTreeProvider
  implements vscode.TreeDataProvider<VariableNode>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private store: VariableStore) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: VariableNode): vscode.TreeItem {
    return element;
  }

  getChildren(): VariableNode[] {
    return this.store.loadAll().map((v) => new VariableNode(v));
  }
}
```

- [ ] **Step 3: Type-check the whole project**

Run: `npm run typecheck`
Expected: PASS — no errors anywhere (all callers now match the new store API).

- [ ] **Step 4: Run the full test suite**

Run: `npx jest test/storage/store.test.ts test/runner.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/providers/pipelinesTreeProvider.ts src/providers/variablesTreeProvider.ts
git commit -m "feat: show scope tag for pipelines and variables in tree views"
```

---

## Task 6: Documentation and full verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document global presets in the README**

In `README.md`, in the **Features** list, replace the line:

```markdown
- **Saved pipelines** for reusable workflows across a workspace.
```

with:

```markdown
- **Saved pipelines** for reusable workflows, stored per-workspace or system-wide (global) so they are available in every workspace.
```

And in the **Pipeline Editor** usage section, replace step 4:

```markdown
4. Save pipelines when you want to reuse a recipe later.
```

with:

```markdown
4. Save pipelines when you want to reuse a recipe later. Choose **Global** (available in every workspace) or **Workspace** in the scope selector next to Save — global is the default.
```

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: PASS (no errors; pre-existing warnings, if any, are unchanged).

- [ ] **Step 3: Type-check**

Run: `npm run typecheck`
Expected: PASS — no errors.

- [ ] **Step 4: Run tests**

Run: `npx jest test/storage/store.test.ts test/runner.test.ts`
Expected: PASS.

- [ ] **Step 5: Build the extension bundle**

Run: `npm run build`
Expected: PASS — `build:chef`, `generate-ops`, and `compile` all succeed; `dist/extension.js` is produced.

- [ ] **Step 6: Commit**

```bash
git add README.md
git commit -m "docs: document system-wide (global) presets"
```

---

## Manual verification (after all tasks)

Run the extension (F5 in VS Code) and confirm:

1. Open the Pipeline Editor, build a recipe, leave scope on **Global**, click Save. Close the workspace / open a different folder — the pipeline still appears in the Pipelines sidebar tagged `Global · …` and runs.
2. With a folder open, save a pipeline with scope **Workspace**; it appears tagged `Workspace · …` and is absent in other workspaces.
3. With NO folder open, the webview's Workspace option is disabled and saving (global) works.
4. `tschef: Set Variable` prompts for scope when a folder is open; with no folder open it saves globally without prompting.
5. Define the same variable name in both scopes; `$name` resolution uses the workspace value (workspace overrides global).
6. The Pipelines and Variables sidebars show both scopes, each tagged.

---

## Self-Review Notes

- **Spec coverage:** scope types + dirs + merged `loadAll` + per-scope mutators + `get` precedence (Task 2); `globalStorageUri` wiring + scope picker + scoped run/show commands (Task 3); webview scope select + `hasWorkspace` + scoped save (Task 4); scope-tagged trees + scoped run command args (Task 5); README + build/lint/test/typecheck gates (Tasks 1 & 6). All spec sections map to a task.
- **Placeholder scan:** none — every code/command step is complete.
- **Type consistency:** `StorageScope`, `ScopedPipeline`, `ScopedVariable`, `loadAll()`, `upsert(scope, …)`, `set(scope, …)`, `delete(scope, …)`, and `runSavedPipeline(name, scope?)` are used identically across all tasks.
