# Remove Saved Variables Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove extension-level saved variables and their persisted data while preserving recipe-local `Register` operation behavior.

**Architecture:** Remove the saved-variable package contributions, activation wiring, input preprocessing, tree provider, and storage model. Replace the storage model with one narrow, tested cleanup function that deletes only legacy `variables.json` files during activation; pipeline persistence and operation-engine registers remain unchanged.

**Tech Stack:** TypeScript, VS Code Extension API, Node.js `fs`/`path`, Jest with ts-jest, Prettier, ESLint

## Global Constraints

- Preserve the CyberChef-compatible `Register` operation and `$R0`, `$R1`, and subsequent recipe-register behavior.
- Delete only `variables.json`; preserve parent directories and unrelated files.
- Cleanup failures must be logged and must not prevent extension activation.
- Keep `StorageScope`, `PipelineStore`, and saved-pipeline behavior unchanged.
- Do not edit `src/chef/operations/Register.ts`, `src/chef/operations/index.ts`, or `src/generated/opsRegistry.ts`.
- Leave historical design specifications and implementation plans unchanged.
- Do not stage or modify pre-existing unrelated worktree changes.

---

### Task 1: Remove Variable Package Contributions

**Files:**
- Modify: `test/packageContributions.test.ts`
- Modify: `package.json:27-121`

**Interfaces:**
- Consumes: VS Code contribution metadata in `package.json`.
- Produces: A package with no `tschef.setVariable`, `tschef.showVariables`, or `tschef.addVariable` command and no `tschef.variablesView` view.

- [ ] **Step 1: Add failing package-contribution assertions**

Replace `test/packageContributions.test.ts` with:

```ts
import pkg from "../package.json";

describe("package contributions", () => {
  test("does not contribute the standalone pipeline editor command", () => {
    const commands = pkg.contributes.commands.map((command) => command.command);

    expect(commands).not.toContain("tschef.openPipelineEditor");
    expect(commands).toContain("tschef.runPipeline");
    expect(commands).toContain("tschef.runSavedPipelinePicker");
  });

  test("does not contribute saved-variable commands or view", () => {
    const commands = pkg.contributes.commands.map((command) => command.command);
    const views = pkg.contributes.views["tschef-sidebar"].map((view) => view.id);

    expect(commands).not.toContain("tschef.setVariable");
    expect(commands).not.toContain("tschef.showVariables");
    expect(commands).not.toContain("tschef.addVariable");
    expect(views).not.toContain("tschef.variablesView");
  });
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
npm test -- --runInBand test/packageContributions.test.ts
```

Expected: FAIL because `tschef.setVariable`, `tschef.showVariables`, `tschef.addVariable`, and `tschef.variablesView` are still contributed.

- [ ] **Step 3: Remove command, view, and menu contributions**

In `package.json`, remove these three objects from `contributes.commands`:

```json
{
  "command": "tschef.setVariable",
  "title": "tschef: Set Variable"
},
{
  "command": "tschef.showVariables",
  "title": "tschef: Show Variables"
},
{
  "command": "tschef.addVariable",
  "title": "tschef: Add Variable",
  "icon": "$(add)"
}
```

Remove this object from `contributes.views["tschef-sidebar"]`:

```json
{
  "id": "tschef.variablesView",
  "name": "Variables",
  "contextualTitle": "tschef Variables"
}
```

Remove this object from `contributes.menus["view/title"]`:

```json
{
  "command": "tschef.addVariable",
  "when": "view == tschef.variablesView",
  "group": "navigation"
}
```

Do not change the Operations, Recipe, or Pipelines view contributions.

- [ ] **Step 4: Run the focused test and verify it passes**

Run:

```bash
npm test -- --runInBand test/packageContributions.test.ts
```

Expected: PASS with both package-contribution tests passing.

- [ ] **Step 5: Commit the package-level removal**

```bash
git add package.json test/packageContributions.test.ts
git commit -m "feat: remove saved-variable contributions"
```

---

### Task 2: Add Legacy Variable File Cleanup

**Files:**
- Modify: `src/storage/store.ts:1-32`
- Modify: `test/storage/store.test.ts:1-39,139`

**Interfaces:**
- Consumes: `globalDir: string`, the first `vscode.workspace.workspaceFolders` entry, and an error reporter callback.
- Produces: `removeLegacyVariableFiles(globalDir: string, reportError: (message: string) => void): void` exported from `src/storage/store.ts`.

- [ ] **Step 1: Add failing cleanup tests**

Change the import in `test/storage/store.test.ts` to:

```ts
import {
  PipelineStore,
  VariableStore,
  Pipeline,
  removeLegacyVariableFiles,
} from "../../src/storage/store";
```

Append these tests inside the existing `describe("scope-aware stores", ...)` block:

```ts
  test("legacy variable cleanup removes global and workspace files only", () => {
    const vscodeDir = path.join(wsDir, ".vscode");
    const workspaceStoreDir = path.join(vscodeDir, "ts-chef");
    fs.mkdirSync(workspaceStoreDir, { recursive: true });

    const globalVariables = path.join(globalDir, "variables.json");
    const workspaceVariables = path.join(workspaceStoreDir, "variables.json");
    const globalKeep = path.join(globalDir, "pipelines.json");
    const workspaceKeep = path.join(workspaceStoreDir, "pipelines.json");
    fs.writeFileSync(globalVariables, "[]");
    fs.writeFileSync(workspaceVariables, "[]");
    fs.writeFileSync(globalKeep, "[]");
    fs.writeFileSync(workspaceKeep, "[]");

    removeLegacyVariableFiles(globalDir, jest.fn());

    expect(fs.existsSync(globalVariables)).toBe(false);
    expect(fs.existsSync(workspaceVariables)).toBe(false);
    expect(fs.existsSync(globalKeep)).toBe(true);
    expect(fs.existsSync(workspaceKeep)).toBe(true);
    expect(fs.existsSync(globalDir)).toBe(true);
    expect(fs.existsSync(workspaceStoreDir)).toBe(true);
  });

  test("legacy variable cleanup tolerates missing files", () => {
    const reportError = jest.fn();

    expect(() => removeLegacyVariableFiles(globalDir, reportError)).not.toThrow();
    expect(reportError).not.toHaveBeenCalled();
  });

  test("legacy variable cleanup reports deletion failures and continues", () => {
    const globalVariables = path.join(globalDir, "variables.json");
    fs.writeFileSync(globalVariables, "[]");
    const realRmSync = fs.rmSync;
    const rmSpy = jest.spyOn(fs, "rmSync").mockImplementation((target, options) => {
      if (target === globalVariables) throw new Error("denied");
      return realRmSync(target, options);
    });
    const reportError = jest.fn();

    removeLegacyVariableFiles(globalDir, reportError);

    expect(reportError).toHaveBeenCalledWith(
      expect.stringContaining(`Failed to remove ${globalVariables}: Error: denied`),
    );
    rmSpy.mockRestore();
  });
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
npm test -- --runInBand test/storage/store.test.ts
```

Expected: FAIL at TypeScript compilation because `removeLegacyVariableFiles` is not exported.

- [ ] **Step 3: Implement the cleanup function**

Add this function after `writeJSON` and before the Variables section in `src/storage/store.ts`:

```ts
export function removeLegacyVariableFiles(
  globalDir: string,
  reportError: (message: string) => void,
): void {
  const dirs = [globalDir, workspaceStoreDir()];
  for (const dir of dirs) {
    if (!dir) continue;
    const file = path.join(dir, "variables.json");
    try {
      fs.rmSync(file, { force: true });
    } catch (error) {
      reportError(`Failed to remove ${file}: ${error}`);
    }
  }
}
```

This deliberately removes only the file, uses `force: true` so a missing file is a no-op, and catches each location independently so one failure does not stop cleanup of the other location.

- [ ] **Step 4: Run the focused cleanup tests and verify they pass**

Run:

```bash
npm test -- --runInBand test/storage/store.test.ts
```

Expected: PASS with the existing store tests and all three cleanup tests passing.

- [ ] **Step 5: Commit the cleanup behavior**

```bash
git add src/storage/store.ts test/storage/store.test.ts
git commit -m "feat: remove legacy variable files on startup"
```

---

### Task 3: Remove Saved-Variable Runtime And Storage

**Files:**
- Modify: `src/extension.ts:1-63,116-138,155-178,238-320,323-405,407-515`
- Modify: `src/storage/store.ts:32-108`
- Modify: `test/storage/store.test.ts:1-139`
- Delete: `src/providers/variablesTreeProvider.ts`

**Interfaces:**
- Consumes: `removeLegacyVariableFiles(globalDir: string, reportError: (message: string) => void): void` from Task 2 and the existing `log(message: string): void` logger.
- Produces: Activation that runs `removeLegacyVariableFiles(context.globalStorageUri.fsPath, log)` and passes raw editor input directly to operations and pipelines.

- [ ] **Step 1: Remove variable-store tests and imports**

Change the `test/storage/store.test.ts` import to:

```ts
import {
  PipelineStore,
  Pipeline,
  removeLegacyVariableFiles,
} from "../../src/storage/store";
```

Delete these four saved-variable tests from the file:

```ts
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

  test("variable loadAll merges both scopes, workspace first", () => {
    const store = new VariableStore(globalDir);
    store.set("global", "g", "G");
    store.set("workspace", "w", "W");
    const all = store.loadAll();
    expect(all.map((v) => [v.name, v.scope])).toEqual([
      ["w", "workspace"],
      ["g", "global"],
    ]);
  });

  test("variable delete only affects the target scope", () => {
    const store = new VariableStore(globalDir);
    store.set("global", "x", "G");
    store.set("workspace", "x", "W");
    store.delete("workspace", "x");
    const all = store.loadAll();
    expect(all).toHaveLength(1);
    expect(all[0].scope).toBe("global");
    expect(all[0].value).toBe("G");
  });
```

Keep all pipeline-store and legacy-cleanup tests.

- [ ] **Step 2: Remove the saved-variable storage model**

Delete the entire Variables section in `src/storage/store.ts`, from:

```ts
// ---- Variables ----
```

through the closing brace of `VariableStore`, immediately before:

```ts
// ---- Pipelines ----
```

Keep `StorageScope`, `workspaceStoreDir`, JSON helpers, `removeLegacyVariableFiles`, and all pipeline types and behavior unchanged.

- [ ] **Step 3: Replace variable imports and startup wiring**

In `src/extension.ts`, delete:

```ts
import { VariablesTreeProvider } from "./providers/variablesTreeProvider";
```

Replace the storage import with:

```ts
import {
  PipelineStore,
  StorageScope,
  ScopedPipeline,
  removeLegacyVariableFiles,
} from "./storage/store";
```

Delete the complete `resolveVars` and `pickScope` functions. `pickScope` is no longer used after the variable commands are removed; pipeline save scope continues to come from `tschef.defaultPipelineScope`.

At the start of `activate`, replace variable and pipeline store initialization:

```ts
  const globalDir = context.globalStorageUri.fsPath;
  const varStore = new VariableStore(globalDir);
  const pipeStore = new PipelineStore(globalDir);

  const varTree = new VariablesTreeProvider(varStore);
  const pipeTree = new PipelinesTreeProvider(pipeStore);
```

with:

```ts
  const globalDir = context.globalStorageUri.fsPath;
  removeLegacyVariableFiles(globalDir, log);
  const pipeStore = new PipelineStore(globalDir);
  const pipeTree = new PipelinesTreeProvider(pipeStore);
```

Remove this registration from the first `context.subscriptions.push` call:

```ts
vscode.window.registerTreeDataProvider("tschef.variablesView", varTree),
```

- [ ] **Step 4: Remove input substitution from every execution path**

Make these five replacements in `src/extension.ts`:

1. Recipe `onApply`: replace `const rawText = ...; const text = resolveVars(rawText, varStore);` with:

```ts
        const text =
          editor.document.getText(editor.selection) || editor.document.getText();
```

2. `tschef.applyOperation`: replace:

```ts
        const rawText = editor.document.getText(editor.selection);
        if (!rawText) {
```

and its later `resolveVars` line with:

```ts
        const text = editor.document.getText(editor.selection);
        if (!text) {
```

3. `tschef.quickConvert`: replace:

```ts
      const rawText = editor.document.getText(selection);
      if (!rawText) {
```

and its later `resolveVars` line with:

```ts
      const text = editor.document.getText(selection);
      if (!text) {
```

4. `tschef.runPipeline`: replace `rawText` plus `resolveVars` with:

```ts
      const text =
        editor.document.getText(editor.selection) || editor.document.getText();
```

5. `tschef.runSavedPipeline`: replace `rawText` plus `resolveVars` with:

```ts
        const text =
          editor.document.getText(editor.selection) || editor.document.getText();
```

After these changes, search `src/extension.ts` for `resolveVars`, `varStore`, and `rawText`; none should remain.

- [ ] **Step 5: Remove all variable command handlers and provider code**

Delete the complete `context.subscriptions.push` blocks registering:

```text
tschef.setVariable
tschef.showVariables
tschef.addVariable
```

Delete `src/providers/variablesTreeProvider.ts` in full. Do not change `src/providers/pipelinesTreeProvider.ts`.

- [ ] **Step 6: Run focused tests and type checking**

Run:

```bash
npm test -- --runInBand test/storage/store.test.ts test/packageContributions.test.ts
npm run typecheck
```

Expected: both Jest suites PASS and TypeScript exits successfully with no unresolved variable-store or provider references.

- [ ] **Step 7: Verify saved-variable references are gone from current source and package metadata**

Run:

```bash
rg 'VariableStore|VariablesTreeProvider|tschef\.(setVariable|showVariables|addVariable)|tschef\.variablesView|resolveVars|varStore' src package.json test
```

Expected: no matches. Mentions of ordinary TypeScript variables, variable-length operations, and operation-engine registers are outside this pattern and remain valid.

Run:

```bash
rg 'opName: "Register"|export \{ Register \}' src/generated/opsRegistry.ts src/chef/operations/index.ts
```

Expected: two matches confirming the `Register` operation is still registered and exported.

- [ ] **Step 8: Commit the runtime removal**

```bash
git add src/extension.ts src/storage/store.ts test/storage/store.test.ts src/providers/variablesTreeProvider.ts
git commit -m "feat: remove saved-variable runtime"
```

---

### Task 4: Update Current Documentation And Verify

**Files:**
- Modify: `README.md:29-36`
- Modify: `docs/usage.md:31-33`

**Interfaces:**
- Consumes: The completed saved-variable removal from Tasks 1-3.
- Produces: Current user documentation that advertises recipe-local registers but not saved variables.

- [ ] **Step 1: Remove the saved-variable feature claim**

Delete this bullet from `README.md`:

```markdown
- **Variable support** for storing values and reusing them in later pipeline steps.
```

Do not alter historical documents under `docs/superpowers/specs` or `docs/superpowers/plans`.

- [ ] **Step 2: Clarify that the usage guide describes recipe registers**

Replace the final section of `docs/usage.md` with:

```markdown
## Recipe registers

Use the **Register** operation to capture intermediate results into recipe-local registers such as `$R0` and `$R1`. Later operations in the same recipe can reference those registers in their arguments.
```

- [ ] **Step 3: Format only files changed by this implementation**

Run:

```bash
npx prettier --write package.json src/extension.ts src/storage/store.ts test/storage/store.test.ts test/packageContributions.test.ts README.md docs/usage.md
```

Expected: Prettier completes successfully. Do not run a repository-wide formatter because unrelated worktree changes must remain untouched.

- [ ] **Step 4: Run focused verification**

Run:

```bash
npm test -- --runInBand test/storage/store.test.ts test/packageContributions.test.ts
npm run typecheck
```

Expected: focused tests PASS and type checking exits successfully.

- [ ] **Step 5: Run full project verification**

Run:

```bash
npm test -- --runInBand
npm run lint
npm run build:chef
npm run compile
```

Expected: all Jest suites PASS, ESLint exits successfully, the chef TypeScript build completes, and the extension bundle compiles. Do not run `npm run build` because it regenerates `src/generated/opsRegistry.ts`, which is outside this feature and has a pre-existing worktree modification.

- [ ] **Step 6: Inspect the final diff and protected operation files**

Run:

```bash
git status --short
git diff --check
git diff -- src/chef/operations/Register.ts src/chef/operations/index.ts
```

Expected: no whitespace errors and no diff in either operation-engine file. `src/generated/opsRegistry.ts` may remain listed only as the pre-existing unrelated modification.

- [ ] **Step 7: Commit the documentation update**

```bash
git add README.md docs/usage.md
git commit -m "docs: distinguish recipe registers from variables"
```

- [ ] **Step 8: Confirm branch state**

Run:

```bash
git status --short --branch
git log --oneline -5
```

Expected: the feature commits are present on `feature/remove-variables`; only pre-existing unrelated worktree changes remain unstaged.
