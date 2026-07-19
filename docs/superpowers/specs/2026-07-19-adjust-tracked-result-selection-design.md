# Adjust Tracked Result Selection Design

## Goal

Allow a user to extend or shrink a Results sidebar item's tracked input with
VS Code's normal mouse selection controls. Opening a result selects its current
input; subsequent Shift-click or Shift-drag changes retarget that result and
refresh its output.

## User Behavior

1. The user opens a Results sidebar row. The extension reveals and selects that
   row's tracked input as it does today.
2. That row becomes the active selection target.
3. Any later non-empty primary selection in the same document replaces the
   row's tracked input. This includes extending or shrinking with Shift-click
   or Shift-drag, as well as making a different non-empty selection.
4. The result recomputes through the existing debounce and generation guards.
5. The row remains the active target until another Results row is opened.

An empty selection is ignored, so an ordinary click does not accidentally
replace the tracked input with a cursor. Opening another row transfers the
active-target role even when the new row is in another document.

## Architecture

`ResultsController` owns an optional reference to the active `ResultRecord`.
Its existing registration lifecycle adds a
`vscode.window.onDidChangeTextEditorSelection` subscription. The handler acts
only when all of these conditions hold:

- The active record still belongs to the controller.
- The event editor's document is the active record's document.
- The event's primary selection is non-empty.
- The selection's start and end offsets differ from the stored offsets.

When those checks pass, the controller replaces `startOffset` and `endOffset`
with the selection's normalized boundaries and calls the existing `schedule`
method. The existing debounce timer, generation counter, evaluator, and view
publication remain unchanged.

After `open` successfully reveals the row's document, it assigns the row as the
active record immediately before setting the editor selection to the current
tracked range. A row whose document cannot be revealed does not become active.
The equality check prevents the programmatic reselection from causing an
unnecessary recomputation if VS Code emits a selection event.

Removing the active row, removing its document, or disposing the controller
clears the active reference. Opening any other row replaces it. Selection
events from unrelated documents are ignored rather than clearing it, matching
the requirement that the link lasts until another row opens.

## Components

### Results Controller

- Stores which result was most recently opened.
- Observes editor selection changes.
- Converts a valid changed selection to document offsets.
- Reuses the existing scheduling and cleanup paths.

### Results View

No rendering or message changes are required. Clicking a result row already
sends the `open` message needed to select and activate its tracked input.

### Tracked Range Transform

No changes are required. Once retargeted, later document edits continue to
transform the new offsets through `transformTrackedRange` with the current
half-open boundary semantics.

## Error And Edge Handling

- Empty selections leave the previous tracked range unchanged.
- Multi-cursor events use the primary selection only, consistent with
  `TextEditor.selection`.
- Selection changes in another document do nothing.
- Re-selecting the exact stored range does not schedule evaluation.
- A stale active record is ignored and cleared through normal record cleanup.
- Evaluation failures continue to use the existing result error state.

## Testing

Controller tests will verify that:

- Opening a row makes it the active selection target.
- Extending its editor selection updates offsets and recomputes with the larger
  input.
- Shrinking its editor selection updates offsets and recomputes with the
  smaller input.
- Re-selecting the unchanged range does not recompute.
- Empty selections and selections in unrelated documents are ignored.
- Opening another row transfers selection tracking to that row.
- Deleting the active row, closing its document, and disposing the controller
  stop it from reacting to selection changes.
- Open and Replace actions use the adjusted range.

The focused controller suite, typecheck, touched-file lint, and complete test
suite will be run.

## Non-Goals

- Adding a separate reselect or confirm button.
- Tracking empty selections or secondary cursors.
- Retargeting recipe argument selection references.
- Persisting the adjusted range across extension restarts.
- Changing range behavior in result modes other than the Results sidebar.
