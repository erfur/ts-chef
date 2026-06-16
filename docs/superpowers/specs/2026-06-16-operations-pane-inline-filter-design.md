# Design: Operations pane — inline as-you-type filter (WebviewView)

**Date:** 2026-06-16
**Status:** Approved
**Supersedes the view layer of:** [2026-06-16-operations-sidebar-pane-design.md](2026-06-16-operations-sidebar-pane-design.md)

## Problem

The Operations pane currently filters via a popup (`showInputBox`). We want an
**inline filter that updates the list as you type**, and matching groups should
**auto-expand** so no extra clicks are needed. A VS Code `TreeView` cannot host
an inline live-updating text input, so the pane is converted from a TreeView to
a **WebviewView** (custom HTML with a real `<input>`), which also gives full
control over group expansion.

## Scope

- Replace the Operations **view layer** (TreeView → WebviewView).
- Remove the popup filter command.
- Keep `tschef.applyOperation` and `operationNeedsInput` unchanged.
- No change to other views/modes.

## Changes

### `package.json`

- Change the `operationsView` contribution to a webview view:
  `{ "id": "tschef.operationsView", "name": "Operations", "type": "webview",
  "contextualTitle": "tschef Operations" }`.
- **Remove** the `tschef.filterOperations` command entry and its
  `view/title` button (the inline input replaces them).

### `OperationsViewProvider` (`src/providers/operationsViewProvider.ts`, new — replaces `operationsTreeProvider.ts`)

```ts
type OperationItem = { opName: string; displayName: string; module: string };

class OperationsViewProvider implements vscode.WebviewViewProvider {
  constructor(items: OperationItem[]) {}
  resolveWebviewView(view: vscode.WebviewView): void;
}
```

- `resolveWebviewView(view)`: set `view.webview.options = { enableScripts: true }`;
  set `view.webview.html` to the rendered page; subscribe
  `view.webview.onDidReceiveMessage`.
- **HTML** (themed with VS Code CSS variables): a sticky search `<input>` at the
  top; a container for the grouped list; an embedded `const OPS = <json>` of the
  item list (registry strings are trusted — no user input — so plain
  `JSON.stringify` is safe); and a `<script>` implementing the client behavior.
- **Message handler:** on `{ type: "apply", opName: string }` →
  `vscode.commands.executeCommand("tschef.applyOperation", opName)`.

### Client-side behavior (JS embedded in the HTML)

- Group `OPS` by `module`.
- On each `input` event: lowercase the query; a row matches when `displayName`
  or `opName` includes it. Re-render: when the query is empty, show every
  module group **collapsed**; when non-empty, show only groups with matches,
  each rendered **expanded**.
- Clicking a group header toggles that group's expand state (when no filter).
- Clicking an operation row posts `{ type: "apply", opName }` to the extension.
- HTML-escape `displayName`/`opName` when building rows.

### `extension.ts`

- Build the item list from `registry` (`{ opName, displayName, module }`) — no
  `needsInput` predicate needed now.
- Construct `OperationsViewProvider` and register it with
  `vscode.window.registerWebviewViewProvider("tschef.operationsView", provider)`.
- **Remove** the `tschef.filterOperations` command registration.
- Keep `tschef.applyOperation` exactly as-is (the webview invokes it via
  `executeCommand`).

### Removals

- Delete `src/providers/operationsTreeProvider.ts` and
  `test/commands/operationsTreeProvider.test.ts`.
- The mock's `TreeItem` / `ThemeIcon` / `TreeItemCollapsibleState` additions
  become unused by tests; leave them (harmless, real providers use them).

## Deliberate simplifications

1. **No "needs input" hint** in this view — rendering it would require
   instantiating all ~425 operations up front to embed the flag; the apply flow
   already prompts for input when needed.
2. **Client-side filter JS is not unit-tested** (browser JS in an HTML string,
   like the existing `pipelinePanel`). The provider is tested instead.

## Testing

`test/commands/operationsViewProvider.test.ts` (new), with a fake `WebviewView`
(settable `webview.html`, `webview.options`, a `jest.fn` `onDidReceiveMessage`):

- `resolveWebviewView` sets `enableScripts: true`, and the produced `html`
  contains an `<input>` and the operations' `displayName`s and `opName`s
  (embedded JSON).
- The captured `onDidReceiveMessage` handler, when called with
  `{ type: "apply", opName: "FromBase64" }`, calls
  `vscode.commands.executeCommand("tschef.applyOperation", "FromBase64")`.
- An unknown message type is ignored (no `executeCommand`).

`vscode.commands.executeCommand` is already a `jest.fn` in the mock; no new mock
surface is required.

## Non-goals

- Changing `tschef.applyOperation` or any other command/mode.
- The needs-input hint (dropped, see above).
- Persisting filter text across view hide/show, or fuzzy matching (plain
  substring on name/displayName).
- Syntax-highlighted or icon-rich rows (plain themed list).
