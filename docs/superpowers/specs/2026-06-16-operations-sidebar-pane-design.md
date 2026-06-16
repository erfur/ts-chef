# Design: Operations sidebar pane

**Date:** 2026-06-16
**Status:** Approved

## Problem

There is no way to browse the full operation catalog in the sidebar. Quick
Convert exposes operations via a command-palette QuickPick, but users want a
persistent, filterable pane in the `tschef` sidebar where they can find an
operation and apply it to the current selection — the way saved pipelines work.

## Goal

Add an **Operations** pane to the `tschef-sidebar` that lists all operations
(grouped by module) with a filter, where clicking an operation applies it to
the current selection, routing the result through the existing
`presentPipelineResult` flow (so it honors `tschef.pipelineResultAction`).

## Components

### `OperationsTreeProvider` (`src/providers/operationsTreeProvider.ts`, new)

A two-level `vscode.TreeDataProvider`:

- **Top level:** module group nodes (collapsible), one per distinct `module`,
  sorted alphabetically.
- **Children of a group:** operation leaf nodes for that module, sorted by
  `displayName`.

Decoupled from the registry for testability — constructed with:

```ts
type OperationItem = { opName: string; displayName: string; module: string };

new OperationsTreeProvider(
  items: OperationItem[],
  needsInput?: (opName: string) => boolean, // default () => false
)
```

- **Leaf node:** `label = displayName`; `iconPath = ThemeIcon("symbol-method")`;
  `tooltip = opName`; when `needsInput(opName)` is true, append a `$(key)` hint
  to the `description`. `command = { command: "tschef.applyOperation", title:
  "Apply Operation", arguments: [opName] }` (mirrors `PipelineNode` firing
  `runSavedPipeline`).
- **Group node:** `label = module`; `description = "<n>"` (op count);
  `collapsibleState = Collapsed`, or `Expanded` when a filter is active and the
  group has matches.
- **Filter:** `private filter = ""`; `setFilter(text: string)` lowercases and
  fires `onDidChangeTreeData`. With a non-empty filter, a leaf matches when
  `displayName` or `opName` (lowercased) includes it; groups with no matching
  ops are omitted; matching groups render expanded. Empty filter → all groups,
  collapsed.
- `refresh()` fires the change event.

The `needsInput` predicate is called lazily — only for leaves in an expanded
group — so no operations are instantiated at startup.

### Filter command `tschef.filterOperations`

A `$(search)` title-bar button on the Operations view. Runs `showInputBox`
(prefilled with the current filter), then `provider.setFilter(value ?? "")`.
Empty input clears the filter. Also available from the command palette.

### Apply command `tschef.applyOperation(opName: string)` (in `extension.ts`)

Registered (not contributed in `package.json`; invoked from the tree):

1. `editor = activeTextEditor`; if none, warn and return.
2. `rawText = editor.document.getText(editor.selection)`; if empty, warn
   ("ts-chef: Select text first.") and return.
3. `text = resolveVars(rawText, varStore)`.
4. `entry = registry.find(e => e.opName === opName)`; if none, return.
5. `args = await promptForArgs(entry.factory())`; if `null` (cancelled), return.
6. `str = resultToString(runOp(opName, text, args))`. On the empty-result case
   mirror `quickConvert` (warn that nothing was produced).
7. `await presentPipelineResult(editor, str, entry.displayName, { inline:
   (ed, res) => inlineResult.show(ed, res), panel: (ed, res) =>
   panelResult.show(ed, res) })`.
8. Wrap op execution in try/catch with `showErrorMessage`, like `quickConvert`.

This reuses `resolveVars`, `promptForArgs`, `runOp`, `resultToString`, and the
same render map as the pipeline commands.

### Shared helper `operationNeedsInput`

Extract the "needs input" check currently inlined in `buildOpPickItems`
(`extension.ts`) into an exported helper in `src/commands/runner.ts`:

```ts
export function operationNeedsInput(op: Operation): boolean {
  return op.args.some(
    (a) => a.type === "toggleString" && (a.value as string) === "",
  );
}
```

`buildOpPickItems` uses it; `extension.ts` builds the provider's `needsInput`
predicate from it (memoized: `(opName) => operationNeedsInput(entry.factory())`,
caching results by opName so each op is instantiated at most once).

### Wiring (`extension.ts` `activate`)

- Build `OperationItem[]` from `registry` (`{ opName, displayName, module }`).
- Construct the provider with that list and the memoized `needsInput` predicate.
- `registerTreeDataProvider("tschef.operationsView", opsTree)`.
- Register `tschef.filterOperations` and `tschef.applyOperation`.

### `package.json`

- `contributes.views.tschef-sidebar`: add `{ id: "tschef.operationsView", name:
  "Operations", contextualTitle: "tschef Operations" }` as the first view.
- `contributes.commands`: add `tschef.filterOperations`
  (title "tschef: Filter Operations", icon `$(search)`).
- `contributes.menus.view/title`: add the filter button
  `{ command: "tschef.filterOperations", when: "view == tschef.operationsView",
  group: "navigation" }`.
- `tschef.applyOperation` is NOT contributed (internal; takes an arg).

## Testing

`test/commands/operationsTreeProvider.test.ts` (new), constructing the provider
with a small injected `OperationItem[]` (e.g. ops across two modules) and a fake
`needsInput`:

- `getChildren()` (no element) returns one group node per distinct module,
  sorted, each labelled with the module and its op count.
- `getChildren(group)` returns the module's op leaves, sorted by displayName,
  each carrying `command.command === "tschef.applyOperation"` and
  `command.arguments === [opName]`.
- A leaf whose `needsInput(opName)` is true shows the `$(key)` hint.
- `setFilter("base")` narrows leaves to matches (by displayName/opName), omits
  groups with no matches, and renders matching groups expanded.
- Empty filter restores all groups, collapsed.

The mock needs `ThemeIcon` and `TreeItemCollapsibleState` added to
`test/vscode-mock.ts` (additive). The `applyOperation` command is thin glue in
`extension.ts` (like `quickConvert`/`runSavedPipeline`) — covered by
typecheck/build, not a unit test.

## Non-goals

- Changing `quickConvert` or any existing command/mode.
- Showing operation argument editors in the tree (the apply flow prompts via
  `promptForArgs`).
- Favorites/recents, drag-to-pipeline, or per-operation help — possible later.
- Search across operation descriptions (filter matches name/displayName only).
