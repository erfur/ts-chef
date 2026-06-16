# Design: persist the inline row + new `panel` (webview) result mode

**Date:** 2026-06-16
**Status:** Approved
**Builds on:** [2026-06-16-inline-result-codelens-design.md](2026-06-16-inline-result-codelens-design.md)

## Problem

Two refinements to `tschef.pipelineResultAction`:

1. The `inline` (CodeLens) row currently auto-closes whenever the document is
   edited. It should **persist** until explicitly closed.
2. A CodeLens is single-line, so `inline` cannot show multi-line output. Add a
   new **`panel`** mode that shows the full multi-line result in a persistent
   webview beside the editor, with Replace/Copy/Close actions.

## Part 1 — Persist the `inline` row

Remove the edit-driven auto-close from `InlineResultController`
(`src/commands/inlineResult.ts`):

- Delete the `vscode.workspace.onDidChangeTextDocument(...)` registration in
  `register()` and the private `onDocumentChanged` method. `register()` then
  pushes three disposables (code lens provider, command, EventEmitter).
- The row now persists until **Close** clears it, or **Replace** applies and
  clears it. **Copy** keeps it open (unchanged).

Accepted caveat (explicitly chosen): nothing tracks edits, so after the
document changes the anchor line and the Replace target range are frozen at
open time. After inserting/removing lines above, the row can sit on the wrong
line and Replace can target the wrong range. The fix is to Close and re-run.

### Part 1 tests (`test/commands/inlineResult.test.ts`)

- Remove the "editing the stored document auto-closes the row" test.
- Update the `getRegisteredHandlers` helper to stop reading
  `workspace.onDidChangeTextDocument` (it is no longer registered) — return
  only the `apply` handler.
- Add a test: after `register()`, `workspace.onDidChangeTextDocument` was NOT
  called (locks in persistence).

The mock keeps exporting `workspace.onDidChangeTextDocument` (now unused by the
controller) so the "not called" assertion can reference it.

## Part 2 — New `panel` result mode

### Setting

Add `"panel"` as a 5th value of `tschef.pipelineResultAction` with an
enumDescription: "Show the result in a webview panel beside the editor
(multi-line, with Replace/Copy/Close actions)". Default stays `"popup"`.

Union becomes:
`type PipelineResultAction = "popup" | "replace" | "copy" | "inline" | "panel"`.

### Dispatch refactor (`src/commands/pipelineResult.ts`)

Generalize the injected `showInline?` callback into a renderer map so multiple
custom-render modes share one mechanism:

```ts
type ResultRenderer = (
  editor: vscode.TextEditor,
  result: string,
) => void | Promise<void>;

export async function presentPipelineResult(
  editor: vscode.TextEditor,
  result: string,
  label: string,
  render?: Partial<Record<"inline" | "panel", ResultRenderer>>,
): Promise<void>;
```

The branch (after the `copy` block, before the popup code):

```ts
if ((mode === "inline" || mode === "panel") && render?.[mode]) {
  await render[mode]!(editor, result);
  return;
}
```

When the mode is `inline`/`panel` but no matching renderer is wired, control
falls through to the popup (defensive fallback, unchanged in spirit).

### `WebviewResultController` (`src/commands/webviewResult.ts`, new)

A single reusable webview panel.

- State: `{ editor: vscode.TextEditor; range: vscode.Range; result: string } | undefined`,
  where `range = replaceTarget(editor)` (imported from `pipelineResult.ts`).
  The `editor` reference is stored so Replace targets the originating editor
  even though the webview holds focus when a button is clicked.
- `register(context)`: pushes a disposable that disposes the panel on
  extension shutdown.
- `show(editor, result)`: set state; create the panel if absent
  (`vscode.window.createWebviewPanel("tschef.result", "ts-chef result",
  { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
  { enableScripts: true })`), wiring `webview.onDidReceiveMessage` and
  `onDidDispose` (which clears the panel + state); set
  `panel.webview.html` to the rendered result; `panel.reveal(Beside, true)`.
- HTML: themed with VS Code CSS variables — the **full result HTML-escaped in a
  scrollable `<pre>`** plus three buttons (**Replace**, **Copy**, **Close**)
  that `postMessage({ type })` via `acquireVsCodeApi()`.
- `onDidReceiveMessage(msg)`:
  - `replace` → `state.editor.edit(eb => eb.replace(state.range, state.result))`.
  - `copy` → `vscode.env.clipboard.writeText(state.result)` +
    `setStatusBarMessage("ts-chef: Pipeline result copied", 3000)`.
  - `close` → `panel.dispose()`.
  - Replace and Copy keep the panel open; only Close (or the user closing the
    tab) disposes it.

### Wiring (`src/extension.ts`)

- Construct both controllers; `inlineResult.register(context)` (existing) and
  `panelResult.register(context)`.
- At both `presentPipelineResult` call sites, replace the
  `(ed, res) => inlineResult.show(ed, res)` argument with:
  ```ts
  {
    inline: (ed, res) => inlineResult.show(ed, res),
    panel: (ed, res) => panelResult.show(ed, res),
  }
  ```

### Part 2 tests

Mock additions (`test/vscode-mock.ts`): `window.createWebviewPanel` (a
`jest.fn` returning a fake panel whose `webview.onDidReceiveMessage` and
`onDidDispose` are `jest.fn`s, plus `webview.html` settable, `reveal`,
`dispose`), and a `ViewColumn` object (`{ Active: -1, Beside: -2 }`).

- `test/commands/pipelineResult.test.ts`: update the inline-delegate test to
  pass `{ inline: fn }` and assert it is called; add a `panel`-mode test
  passing `{ panel: fn }` and asserting it is called.
- `test/commands/webviewResult.test.ts` (new):
  - `show` creates a panel with viewType `tschef.result`, `ViewColumn.Beside`,
    and `enableScripts: true`; sets `webview.html` to a string containing the
    result text and the words `Replace`, `Copy`, `Close`; calls `reveal`.
  - A second `show` reuses the same panel (`createWebviewPanel` called once).
  - The captured `onDidReceiveMessage` handler: `replace` calls
    `state.editor.edit`; `copy` calls `clipboard.writeText` + status bar;
    `close` calls `panel.dispose`.
  - The captured `onDidDispose` handler clears the panel so the next `show`
    creates a new one.

### Docs

`docs/usage.md`: add a `panel` bullet to the documented values.

## Non-goals

- Edit-tracking for either mode (explicitly dropped).
- Multi-line rendering in the CodeLens `inline` mode (impossible; that is the
  reason `panel` exists).
- Multiple simultaneous panels (one reusable panel).
- Syntax highlighting inside the panel (plain `<pre>` text).
