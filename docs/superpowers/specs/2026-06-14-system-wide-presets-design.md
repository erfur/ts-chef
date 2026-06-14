# System-wide (global) presets — design

**Date:** 2026-06-14
**Status:** Approved (pending spec review)
**Component:** `ts-chef` VS Code extension — storage layer, pipeline editor, sidebars, commands

## Problem

Saved pipelines and variables are stored only inside the current workspace
(`<workspace>/.vscode/ts-chef/` or `<workspace>/.ts-chef/`). They are unavailable
in other workspaces, and cannot be saved at all when no folder is open (the store
shows "open a workspace folder to save…" and discards the data).

Users want to save presets **system-wide** so they are available at all times,
regardless of which workspace — if any — is open.

## Goal

Add a second storage **scope**, `global`, alongside the existing `workspace`
scope, for **both pipelines and variables**. User-facing lists show the **merge**
of both scopes, each item tagged with its scope. Saving defaults to `global` but
the user can choose `workspace` per save.

Non-goals: data migration, sharing across machines beyond what VS Code Settings
Sync already does for `globalStorageUri`, multi-user/machine-wide storage,
import/export.

## Approach

A **scope-aware storage layer**. Each store (`PipelineStore`, `VariableStore`)
reads/writes two scopes:

- `workspace` — unchanged behavior and on-disk location.
- `global` — new, backed by `context.globalStorageUri` (the VS Code-managed
  per-extension global folder, e.g.
  `~/.config/Code/User/globalStorage/michaelweiss.ts-chef/`).

Rejected alternatives:

- **Single `tschef.storageScope` setting** (one location at a time, no merge) —
  can't mix per-preset; doesn't satisfy "available at all times" while still
  keeping workspace-local presets.
- **Separate duplicated `GlobalStore` class** — two parallel code paths to keep
  in sync; more code for no added capability.

## Components and changes

### 1. Storage layer — `src/storage/store.ts`

- New `export type StorageScope = "workspace" | "global"`.
- New scoped item types returned by merged reads:
  - `export interface ScopedPipeline extends Pipeline { scope: StorageScope }`
  - `export interface ScopedVariable extends Variable { scope: StorageScope }`
- Directory resolution becomes scope-aware:
  - `workspace` → existing logic: `<ws>/.vscode/ts-chef/` when `.vscode` exists,
    else `<ws>/.ts-chef/`; `undefined` when no folder is open.
  - `global` → the injected `globalDir`; always available; `mkdir -p` on write.
- Both stores gain `constructor(private globalDir: string)`.
- API (per store):
  - `loadAll(): Scoped<T>[]` — merged across both scopes, each item tagged with
    its `scope`. **Workspace items are listed first** (drives precedence below).
  - `load(scope: StorageScope): T[]` — single scope.
  - `save(scope, list)`, and the existing mutators made scope-aware:
    - `PipelineStore.upsert(scope, pipeline)`, `PipelineStore.delete(scope, name)`
    - `VariableStore.set(scope, name, value, description?)`,
      `VariableStore.delete(scope, name)`
- **Identity is `(scope, name)`**: `upsert` / `set` dedupe **only within the
  target scope**, so a workspace `"X"` and a global `"X"` can coexist.
- `VariableStore.get(name): string | undefined` applies **precedence: workspace
  overrides global** (local context wins). Used by variable resolution
  (`$var` / `{{var}}`).
- `save(scope)` warns "open a workspace folder to save…" **only** when
  `scope === "workspace"` and no folder is open. `global` always succeeds —
  incidentally fixing today's "can't save without a workspace" limitation.

### 2. Save UX

- **Pipeline webview** — `src/panels/pipelinePanel.ts`:
  - Add a small scope `<select>` (`Global (all workspaces)` / `Workspace`) beside
    the Save button, **default Global**.
  - The `Workspace` option is rendered `disabled` when no workspace folder is open
    (the panel reads `vscode.workspace.workspaceFolders` and passes a
    `hasWorkspace` flag into the HTML).
  - The `save` message carries `scope`; the panel calls `store.upsert(scope, …)`.
  - When the panel opens to edit an existing preset, its scope is preselected
    (the optional `initial` becomes a `ScopedPipeline`).
- **Set Variable command** — `tschef.setVariable` in `src/extension.ts`:
  - After name/value/description, show a `QuickPick` for scope (default Global;
    `Workspace` offered only when a folder is open), then
    `varStore.set(scope, …)`.

### 3. Tree views (sidebars)

- `src/providers/pipelinesTreeProvider.ts` and
  `src/providers/variablesTreeProvider.ts` switch to `store.loadAll()`.
- Each node keeps its **semantic icon** (`symbol-event` for pipelines, `key` for
  variables) and **appends the scope to its `description`** (e.g. `Global · <desc>`).
- `contextValue` becomes scope-qualified (`pipeline-global`, `pipeline-workspace`,
  `variable-global`, `variable-workspace`) for future menu targeting.
- Presentation: **flat list with a scope tag** (chosen over two-level Global /
  Workspace grouping for simplicity; lists are typically small).
- Pipeline nodes carry `scope` in their run command arguments (see §4).

### 4. Run / pick flow — `src/extension.ts`

- `tschef.runSavedPipeline` accepts `(name: string, scope?: StorageScope)`.
  Tree nodes and the QuickPicker pass `scope` explicitly, so name collisions are
  unambiguous. When `scope` is omitted (bare command invocation), it falls back to
  the first match in `loadAll()` (workspace-first ordering ⇒ workspace wins).
- `tschef.runSavedPipelinePicker` lists `loadAll()` with the scope shown in each
  item; it forwards `scope` to `runSavedPipeline`.
- `tschef.showVariables` lists `loadAll()` with scope shown; edit/delete act on the
  selected item's **own scope** (`varStore.set(item.scope, …)` /
  `varStore.delete(item.scope, …)`).
- `resolveVars(text, varStore)` uses `varStore.get(name)` (workspace-over-global
  precedence) — no signature change needed.

### 5. Wiring & migration — `src/extension.ts`

- In `activate`, build `const globalDir = context.globalStorageUri.fsPath` and pass
  it to both store constructors:
  `new VariableStore(globalDir)`, `new PipelineStore(globalDir)`.
- **No data migration.** Existing workspace `pipelines.json` / `variables.json`
  keep loading as `workspace`. Global files start empty and are created on first
  global save.

## Data flow

```
save (webview / command)
  → choose scope (default global; workspace disabled if no folder)
  → store.upsert(scope, item) / store.set(scope, …)
  → write <scopeDir>/{pipelines,variables}.json

list / run (sidebar, pickers, resolveVars)
  → store.loadAll()  ── merge workspace(first) + global, tag each with scope
  → display with scope tag / resolve with workspace-over-global precedence
  → run uses (name, scope) for unambiguous lookup
```

## Error handling & edge cases

- **No workspace open:** global save/load works; workspace option is disabled in
  the webview and omitted from the Set Variable scope picker; a direct
  `save("workspace", …)` with no folder warns and writes nothing.
- **Global dir missing:** `globalStorageUri` is not auto-created by VS Code;
  `ensureDir` (`mkdir -p`) runs on every global write. Reads of a missing file
  return the empty fallback.
- **Name collision across scopes:** both items coexist and both appear in lists
  (each tagged). Run/edit/delete always carry scope, so the correct one is acted on.
- **Corrupt JSON:** unchanged behavior — `readJSON` returns the fallback (`[]`).

## Testing

- Add a minimal `vscode` mock and a `moduleNameMapper` entry in `jest.config.js`
  (`^vscode$` → the mock) so the vscode-coupled store can be unit-tested. The mock
  exposes a settable `workspace.workspaceFolders` and a `jest.fn`
  `window.showWarningMessage`. Reusable for future tests of vscode-coupled modules.
- New `test/storage/store.test.ts` using OS temp dirs for `globalDir` and a fake
  workspace folder. Cases:
  - Global save → `loadAll()` returns it tagged `global`; file written under
    `globalDir`.
  - Workspace save → tagged `workspace`; file written under the workspace dir.
  - `loadAll()` merges both scopes, workspace-first.
  - `upsert` / `set` isolate by scope: same name in both scopes coexist.
  - `delete` only affects the target scope.
  - `VariableStore.get` returns the workspace value when both scopes define a name
    (workspace-over-global precedence).
  - `save("workspace", …)` with no folder open → `showWarningMessage` called, no
    file written.
  - `save("global", …)` with no folder open → succeeds.
- Existing `npm test`, `npm run lint`, and `npm run build` must stay green.

## Affected files

- `src/storage/store.ts` — scope-aware stores (core change).
- `src/extension.ts` — store wiring with `globalDir`; scope in
  `setVariable` / `showVariables` / `runSavedPipeline` / `runSavedPipelinePicker`.
- `src/panels/pipelinePanel.ts` — scope `<select>`, `hasWorkspace`, scoped save.
- `src/providers/pipelinesTreeProvider.ts` — `loadAll()`, scope tag, scoped run cmd.
- `src/providers/variablesTreeProvider.ts` — `loadAll()`, scope tag.
- `jest.config.js` — `moduleNameMapper` for the vscode mock.
- `test/vscode-mock.ts` (new) — minimal vscode mock.
- `test/storage/store.test.ts` (new) — store unit tests.
- `README.md` — note that pipelines/variables can be saved globally (system-wide).
