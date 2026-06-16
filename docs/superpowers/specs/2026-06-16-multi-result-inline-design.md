# Design: multiple simultaneous inline (CodeLens) results

**Date:** 2026-06-16
**Status:** Approved
**Builds on:** [2026-06-16-inline-result-codelens-design.md](2026-06-16-inline-result-codelens-design.md), [2026-06-16-persist-inline-and-panel-result-mode-design.md](2026-06-16-persist-inline-and-panel-result-mode-design.md)

## Problem

`InlineResultController` shows one inline result at a time — each `show()`
overwrites the previous one. We want multiple inline rows to coexist, so
several pipeline results can stay on screen together.

## Scope

Entirely within `src/commands/inlineResult.ts` (and its test). No changes to
`pipelineResult.ts`, `extension.ts`, `package.json`, or the panel/popup/other
modes. The internal command `tschef.applyInlineResult` is not contributed in
`package.json`, so changing its argument list is self-contained.

## Design

- **State:** replace the single `state` with `results: InlineResult[]`, where
  `InlineResult = { id: number; uri: vscode.Uri; targetRange: vscode.Range; result: string }`,
  plus a private `seq` counter for ids.
- **`show(editor, result)`:** append a new `InlineResult` with a fresh `id`
  (`this.seq++`) instead of overwriting; fire `onDidChangeCodeLenses`.
- **`provideCodeLenses(document)`:** iterate `results`; for each whose `uri`
  matches the document, emit its 4-lens row (preview + Replace/Copy/Close)
  anchored at that result's `targetRange.start.line`. The action lenses carry
  `arguments: [action, id]` (the preview lens keeps `command: ""`).
- **`apply(action, id)`** (the registered command now receives two args): find
  the result by `id`; if none, return.
  - `replace` → edit that result's `targetRange` in the active editor, then
    remove that result (others remain).
  - `copy` → `clipboard.writeText` + status-bar message; keep the result.
  - `close` → remove that result.
- **`remove(id)`:** filter the result out of `results` and fire the change
  event (replaces the old `clear()`).

## Behavior decisions

- **Append, duplicates allowed:** re-running on the same selection adds another
  row; rows on the same line render their lenses together. Users Close what
  they don't want.
- **No "Close all":** per-row Close only (YAGNI).
- **Frozen ranges (unchanged caveat):** edits are not tracked, so stored ranges
  freeze at show time. With multiple rows this is more pronounced — replacing
  one row shifts text under the others, so their ranges/anchors may go stale.
  Accepted, consistent with the persist design.

## Testing (`test/commands/inlineResult.test.ts`)

Rewritten for the collection model:

- `register` still wires only the provider + command (no doc listener).
- `show` adds a row and fires; one result → `provideCodeLenses` returns 4 lenses.
- A single result's action lenses carry `[action, id]` (id is a number); the
  preview lens command is `""`; the row anchors at the selection's line.
- Two `show`s → `provideCodeLenses` returns 8 lenses (2 rows) with distinct ids.
- Long preview truncates with `…`.
- `provideCodeLenses` returns `[]` with no results and only rows for the
  matching document uri.
- `apply("replace", id)` edits that row's range and removes only it.
- `apply("copy", id)` copies and keeps the row.
- `apply("close", id)` removes only that row (the other remains).
- `apply` with an unknown id is a no-op.

## Non-goals

- Edit-tracking (still frozen ranges).
- Dedup of same-range results (append instead).
- A "Close all" command.
- Any change to popup/replace/copy/panel modes.
