# Design: `inline` pipeline-result mode via CodeLens

**Date:** 2026-06-16
**Status:** Approved
**Builds on:** [2026-06-16-pipeline-result-default-action-design.md](2026-06-16-pipeline-result-default-action-design.md)

## Problem

The `tschef.pipelineResultAction` setting currently offers `popup`, `replace`,
and `copy`. We want a fourth mode, `inline`, that shows the result *in the
editor, between lines*, with Replace/Copy actions, and that **stays open until
explicitly closed** (a hover cannot do this — it auto-dismisses on cursor
move/Escape).

## Decision: CodeLens

Among stable VS Code APIs, a persistent, between-lines, clickable element is a
**CodeLens** row. (The true Copilot-style boxed inset requires the proposed
`editorInsets` API, which is not usable in published extensions; a webview
panel is persistent but not inline.) CodeLens is stable and shippable. Its
limitation — a single line of link-styled text — is acceptable: the row shows a
truncated preview plus action links, and the full result is always available
via Copy/Replace.

## Scope

- In scope: a new `inline` value for `tschef.pipelineResultAction`, used by the
  `tschef.runPipeline` and `tschef.runSavedPipeline` commands (same call sites
  as the other modes).
- Out of scope: the Pipeline Editor panel (unchanged), and the other three
  modes (unchanged).

## Mechanism

A single `InlineResultController` owns one "active inline result" and acts as a
`CodeLensProvider`:

- State: `{ uri: vscode.Uri; targetRange: vscode.Range; result: string } | undefined`.
  `targetRange` is the replace target captured at show time (the selection, or
  the whole document when the selection is empty), computed via the existing
  `replaceTarget` helper.
- `register(context)` registers three things (disposables pushed to
  `context.subscriptions`):
  1. `vscode.languages.registerCodeLensProvider({ scheme: "*" }, controller)`
  2. `vscode.commands.registerCommand("tschef.applyInlineResult", (action) => …)`
  3. `vscode.workspace.onDidChangeTextDocument(…)` for auto-close.
- `show(editor, result)`: store state, fire `onDidChangeCodeLenses`. VS Code
  re-queries `provideCodeLenses`.
- `provideCodeLenses(document)`: if no state or `document.uri.toString() !==
  state.uri.toString()`, return `[]`. Otherwise return a row of CodeLenses, all
  anchored at a zero-length range on `targetRange.start.line`:
  - Preview lens: title `$(output) <preview>`, no `command` (plain label).
    `<preview>` = result with newlines replaced by spaces, truncated to 80
    chars with a trailing `…` when longer.
  - `$(replace) Replace` → command `tschef.applyInlineResult`, args `["replace"]`.
  - `$(clippy) Copy` → args `["copy"]`.
  - `$(close) Close` → args `["close"]`.

CodeLens renders the row *above* `targetRange.start.line` (between lines).

## Action behavior (`tschef.applyInlineResult`)

- `replace`: `await editor.edit(eb => eb.replace(state.targetRange, state.result))`
  on the active editor, then clear state + fire change event (row disappears —
  the text changed, so the result is now stale).
- `copy`: `vscode.env.clipboard.writeText(state.result)` + transient
  `vscode.window.setStatusBarMessage("ts-chef: Pipeline result copied", 3000)`.
  **State is retained** — the row stays open (non-destructive; the user may
  still Replace or Close).
- `close`: clear state + fire change event.

`onDidChangeTextDocument`: if the changed document is the state's document,
clear state + fire change event (auto-close so a stale result never lingers).
Replace triggers this too, which is fine — state is already cleared first.

If no active editor is available for `replace`, the action is a no-op (guarded).

## Code structure

- New `src/commands/inlineResult.ts`: `InlineResultController implements
  vscode.CodeLensProvider`, exporting the class. Owns the state, the
  `EventEmitter<void>` for `onDidChangeCodeLenses`, `register`, `show`,
  `provideCodeLenses`, and the private apply handler. Imports `replaceTarget`
  from `pipelineResult.ts`.
- `src/commands/pipelineResult.ts`:
  - Export `replaceTarget` (currently a private function) for reuse.
  - Extend the union: `type PipelineResultAction = "popup" | "replace" | "copy" | "inline"`.
  - `presentPipelineResult(editor, result, label, showInline?)` gains an
    optional injected callback `showInline?: (editor: vscode.TextEditor,
    result: string) => void | Promise<void>`. The `inline` branch calls
    `showInline` when provided; if not provided (defensive), it falls through
    to the `popup` behavior.
- `src/extension.ts`: construct `const inlineResult = new
  InlineResultController()`, call `inlineResult.register(context)` during
  activation, and pass `(editor, result) => inlineResult.show(editor, result)`
  as the `showInline` argument at both `presentPipelineResult` call sites.

## Setting and docs

- `package.json`: add `"inline"` to the `tschef.pipelineResultAction` enum and a
  fourth `enumDescriptions` entry: "Show the result in a CodeLens row above the
  selection with Replace/Copy/Close actions". Default remains `"popup"`.
- `docs/usage.md`: add `inline` to the documented list of values.

## Testing

Extend `test/vscode-mock.ts` with the surface the new code uses:
`languages.registerCodeLensProvider`, `commands.registerCommand` /
`commands.executeCommand`, `workspace.onDidChangeTextDocument`, and simple
stand-ins for `EventEmitter` (with `event`/`fire`), `CodeLens` (stores
`range`/`command`), `Range` (built from two `Position`s, exposing `.start.line`
and a `contains` method), and `Uri` (a `{ toString() }` wrapper). These
additions must not break `store.test.ts` or `pipelineResult.test.ts`.

- `test/commands/pipelineResult.test.ts`: add a test that `inline` mode invokes
  the injected `showInline` with `(editor, result)` and does not call popup /
  replace / copy. Existing tests are unaffected (they pass no `showInline` and
  use other modes).
- `test/commands/inlineResult.test.ts` (new):
  - `show(editor, result)` stores state and fires `onDidChangeCodeLenses`.
  - `provideCodeLenses(doc)` returns four lenses with the correct titles,
    commands, and args when the doc matches; returns `[]` when there is no state
    or the doc uri differs.
  - `apply("replace")` calls `editor.edit` (replacing `targetRange` with the
    result) and clears state (subsequent `provideCodeLenses` → `[]`).
  - `apply("copy")` calls `clipboard.writeText(result)` and **retains** state
    (subsequent `provideCodeLenses` still returns the lenses).
  - `apply("close")` clears state.
  - An `onDidChangeTextDocument` event for the stored doc clears state.

## Non-goals

- Multi-line / boxed rendering (CodeLens is single-line by nature).
- Multiple simultaneous inline results (one active result at a time).
- Persisting inline results across editor reloads.
