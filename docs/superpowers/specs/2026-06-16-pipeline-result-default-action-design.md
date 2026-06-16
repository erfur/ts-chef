# Design: Configurable default action for pipeline results

**Date:** 2026-06-16
**Status:** Approved

## Problem

When a pipeline runs from a command, its result is always presented in a
notification popup with `Replace` / `Copy` buttons. Users who always want the
same outcome (e.g. always replace, or always copy) must click the button every
time. There is no way to set a preferred default.

## Goal

Add a single configuration option that lets the user choose what happens to a
pipeline's result by default: show the popup (current behavior), replace
directly, or copy directly.

## Scope

In scope — the two commands that currently show a result popup in
`src/extension.ts`:

- `tschef.runPipeline` ("Run Pipeline on Selection")
- `tschef.runSavedPipeline` ("Run Saved Pipeline")

Out of scope:

- The Pipeline Editor panel (`Bake`). It renders results inline in its own
  webview, not as a popup, and is unchanged.
- Quick Convert and other commands.

## Configuration

New property under the existing `tschef` configuration in `package.json`:

```jsonc
"tschef.pipelineResultAction": {
  "type": "string",
  "enum": ["popup", "replace", "copy"],
  "enumDescriptions": [
    "Show a notification with Replace/Copy buttons (current behavior)",
    "Replace the selection (or whole document if nothing is selected) with the result",
    "Copy the result to the clipboard"
  ],
  "default": "popup",
  "description": "What to do with a pipeline's result. 'popup' asks each time."
}
```

The default `"popup"` preserves the current behavior, so existing users see no
change unless they opt in.

## Behavior

Read once per result via `vscode.workspace.getConfiguration("tschef").get("pipelineResultAction", "popup")`.

- **popup** — Unchanged. Show the information message with `Replace` and `Copy`
  buttons; act on the user's choice.
- **replace** — Apply the existing replace logic (replace the active editor's
  selection, or the whole document when the selection is empty), then show a
  transient status-bar message: `ts-chef: Pipeline result replaced selection`.
  No popup.
- **copy** — Write the result to the clipboard, then show a transient status-bar
  message: `ts-chef: Pipeline result copied`. No popup. (Status-bar feedback
  matters here because the result is not otherwise visible.)

## Code structure

The two commands currently contain near-identical result-handling blocks
(popup with Replace/Copy, replace selection-or-whole-document, copy to
clipboard). This duplication is extracted into one helper:

```ts
type PipelineResultAction = "popup" | "replace" | "copy";

async function presentPipelineResult(
  editor: vscode.TextEditor,
  result: string,
  label: string, // popup message prefix, e.g. "Result" or `Pipeline "name"`
): Promise<void>;
```

Both `runPipeline` and `runSavedPipeline` call `presentPipelineResult` instead
of their inline blocks. Minor unification: the popup's replace button label
becomes `Replace` in both commands (today `runPipeline` uses
`Replace Selection`).

The replace target is computed exactly as today:

```ts
const sel = editor.selection.isEmpty
  ? new vscode.Selection(
      editor.document.positionAt(0),
      editor.document.positionAt(editor.document.getText().length),
    )
  : editor.selection;
```

## Testing

Unit-test `presentPipelineResult` against the existing `test/vscode-mock.ts`,
extending the mock where needed (config `get`, `window.showInformationMessage`,
`window.setStatusBarMessage`, `env.clipboard.writeText`, `editor.edit`):

- `pipelineResultAction = "copy"` → `clipboard.writeText` called with the
  result; `showInformationMessage` not called.
- `pipelineResultAction = "replace"` → `editor.edit` called; clipboard and
  popup not used.
- `pipelineResultAction = "popup"` → `showInformationMessage` called; the
  chosen button drives replace/copy.

## Out of scope / non-goals

- Per-command or per-pipeline overrides (a single global default only — YAGNI).
- Changing the Pipeline Editor panel result display.
- Persisting "last used" action or remembering choices.
