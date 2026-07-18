# Results Sidebar Design

## Goal

Add a `sidebar` pipeline result action that keeps live results in a Results
view. Each result remains associated with its source input and recipe so users
can return to it, inspect it, copy it, replace its input, or delete it.

## Scope

The new mode applies to result-producing flows that already use
`presentPipelineResult`: direct operations, the working recipe, typed
pipelines, and saved pipelines. Quick Convert remains unchanged because it
directly replaces a selection instead of using result presentation.

Results live only for the current extension session. A result is removed when
its source document closes or when the user deletes or replaces it. Results
are not restored after VS Code restarts.

## Result Action And View Contribution

Add `sidebar` as the sixth value of `tschef.pipelineResultAction`, described as
showing a live result in the ts-chef Results view. The default remains
`popup`.

Contribute a scripted `tschef.resultsView` webview under the ts-chef sidebar,
beneath the Recipe view. The view uses VS Code theme variables and default
typography.

The header contains an **All tabs / Current tab** toggle. **All tabs** is the
initial setting. Results are displayed newest first. Each compact row shows:

- The recipe, pipeline, or operation label.
- The source filename.
- A whitespace-preserving output preview, or an inline error.
- Popup, Copy, Replace, and Delete actions.

The view has separate empty states for no results and no results in the active
tab.

## Architecture

Introduce a dedicated `ResultsController` that owns result records and their
lifecycle. Introduce a `ResultsViewProvider` that renders serialized state and
forwards user messages to the controller. The provider does not own editor,
document, range, or execution state.

Extend result presentation so a renderer can receive optional source context:

- A cloned recipe snapshot containing its name and pipeline steps.
- An evaluator that can rerun that exact snapshot for a new input string.
- A display label.

The existing popup, replace, copy, inline, and panel modes preserve their
behavior. Only the `sidebar` renderer requires source context.

Each controller record contains:

- A stable numeric ID.
- The source document URI and document reference.
- A tracked input range represented as document offsets.
- The current output or current error.
- The display label and source filename.
- A deep-cloned recipe `{ name, steps }`.
- The evaluator used for recomputation.
- A generation counter for asynchronous race protection.

Direct operations contribute a one-step unnamed recipe with the prompted
arguments. The working recipe contributes its current name and steps. Saved
pipelines contribute their saved name and steps. Typed pipelines contribute
their parsed steps with an empty recipe name. Clicking any of these results
therefore loads an editable equivalent into the Recipe view.

## Source Range Tracking

The controller subscribes to text document changes. It transforms stored
start and end offsets using each change's original range and replacement text:

- Changes strictly before a result shift both boundaries.
- Changes wholly within or crossing the result adjust its end boundary and
  mark it for recomputation.
- Insertions at either boundary count as input edits so typing at an edge is
  included in the tracked input.
- Changes strictly after a result do not affect it.

Multiple changes in one event are normalized against their original document
offsets before applying cumulative deltas. The transformed offsets are clamped
to the new document length.

An empty selection used by a no-input or optional-input direct operation stays
a zero-length replacement target. Unrelated document edits do not recompute
that result. Pipeline and recipe execution with no selection retains existing
semantics: the whole document is the input and replacement target, so every
document content edit intersects it and triggers recomputation.

## Dynamic Recalculation

An edit intersecting tracked input schedules a short debounced rerun. Results
in the same document may recompute independently. Before starting a run, the
controller increments that result's generation. Completion updates the record
only if its generation is still current, preventing a slower stale run from
overwriting a newer result.

On success, the current output replaces the previous output and any error is
cleared. On failure, the row stays and displays the error inline. A later valid
edit reruns the evaluator and can recover the row. Dynamic errors are logged
but do not produce repeated notification popups.

Recipe snapshots do not change when the Recipe view is subsequently edited.
Only source input modifications dynamically update an existing result.

## Filtering And Navigation

The controller subscribes to active-editor changes and republishes view state
when **Current tab** filtering is active. Current-tab results are those whose
source URI equals the active text editor document URI. Focusing the Results
view does not clear the last active text editor association.

Clicking a result row:

1. Opens or reveals its source document in its existing editor column.
2. Sets the editor selection to the result's current tracked range.
3. Reveals and focuses that selection.
4. Loads the result's cloned recipe into the Recipe view.

Action buttons stop row-click propagation and therefore do not implicitly
load or navigate unless their own behavior requires it.

## Result Actions

- **Popup:** send the current output to the existing reusable ts-chef result
  panel. Opening another result continues to reuse that one panel/tab.
- **Copy:** write the current output to the clipboard and show the existing
  copied status message.
- **Replace:** remove the result from controller state first, reveal its source
  editor, replace the current tracked range with the output, and leave it
  deleted. Removing first prevents the replacement edit from triggering the
  result's evaluator against its own output.
- **Delete:** remove only that result and refresh the view.

Popup, Copy, and Replace are disabled while a result is in an error state.
Delete and row navigation remain available.

If a source document closes, all of its results are removed. If document close
races with navigation or replacement, the controller reports one warning and
does not attempt an edit against the closed document.

## Integration

`extension.ts` constructs and registers the results controller and provider,
adds a `sidebar` renderer beside the existing inline and panel renderers, and
passes recipe context from each relevant execution path.

The Recipe view apply callback includes both the current recipe name and its
steps so the result captures the complete recipe. The existing `load` method
remains the entry point used when a result row loads its snapshot.

The existing result panel remains reusable. The Results controller invokes it
for Popup rather than introducing another panel implementation.

## Error Handling

Initial execution errors retain the current command behavior: they are logged
and shown as command errors, and no sidebar row is created. Errors from later
dynamic recomputation are held within the existing row and logged without a
notification storm.

Unknown result IDs and messages are ignored. Closed or unavailable source
documents are handled defensively with a warning for explicit navigation or
replacement actions.

## Testing

Tests cover:

- Package contributions for the Results view and `sidebar` configuration.
- Result creation with cloned range, output, evaluator, and recipe metadata.
- Newest-first ordering, All tabs default, Current tab filtering, and active
  editor refresh.
- Offset movement for edits before a range, recomputation for intersecting and
  boundary edits, suppression for unrelated edits, whole-document tracking,
  and zero-length no-input behavior.
- Debouncing, stale-generation suppression, inline error state, and recovery.
- Source-document close cleanup.
- Row navigation, tracked selection activation, and recipe loading.
- Popup panel reuse, copy, replace-then-delete, and per-result deletion.
- Results webview rendering, both empty states, output and error rows, toggle
  messages, action messages, and disabled actions for errors.
- Context wiring for direct operations, working recipes, typed pipelines, and
  saved pipelines.
- Regression coverage for all existing result modes.

## Non-Goals

- Persisting or restoring results across extension sessions.
- Changing Quick Convert behavior.
- Updating a result when its cloned recipe is edited after creation.
- Creating one popup panel per result.
- Sharing storage with the existing inline CodeLens controller.
