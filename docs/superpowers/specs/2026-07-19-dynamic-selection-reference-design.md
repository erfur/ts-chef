# Design: dynamic recipe selection references

**Date:** 2026-07-19
**Status:** Approved
**Builds on:** [2026-07-19-recipe-use-selection-design.md](2026-07-19-recipe-use-selection-design.md)

## Problem

The Recipe pane's **Use selection** action currently copies selected text into
an argument. Later edits to that source text do not affect the argument or a
live Results sidebar item. The action should instead bind the argument to the
original selected range so edits inside that range update live results.

## Scope

- References bind to the original document range selected when the button is
  clicked.
- Document edits transform the tracked range. Changing the editor's active
  selection does not move it.
- Plain `string` and `toggleString` arguments support references.
- Only Results sidebar items recompute dynamically from reference changes.
  Other result modes resolve references once when applied.
- References are runtime-only. Saved pipelines contain current text values,
  never document or range metadata.

## Architecture

### Tracked selection

Add an ephemeral tracked-selection abstraction containing:

- The referenced `TextDocument` while it remains open.
- Start and end offsets transformed by text-document changes.
- The last resolved text, retained after the document closes.
- A change event emitted only when an edit changes text inside the tracked
  range, not when an edit merely shifts the range.

Range transformation should reuse the existing `transformTrackedRange`
semantics from `ResultsController`, extracted if necessary so recipe and result
tracking share one implementation. Closing a referenced document freezes the
last text and detaches the document; it is not an error.

### Recipe bindings

`PipelineStep.args` continue to contain ordinary operation values. Selection
references are stored separately in `RecipeViewProvider`, keyed by a client-only
stable step ID and argument index. Stable IDs travel with webview step state so
bindings follow steps through reordering without entering persisted pipeline
data.

- Adding or loading steps assigns fresh stable IDs.
- Reordering carries IDs with their steps.
- Removing a step disposes its bindings.
- A manual edit message identifies its argument target and disposes that
  target's binding before accepting the normal value.
- Loading another recipe disposes all existing bindings.

When a tracked reference changes, the provider materializes its current text
into the corresponding normal argument value and reposts recipe state so the
visible field stays current. For `toggleString`, only `.string` changes and
`.option` remains unchanged.

### Execution source

Applying a recipe creates a result source from cloned recipe steps and cloned
selection bindings. The source evaluator materializes every binding into a
fresh step clone immediately before calling `runPipeline`:

- `string` receives the reference text directly.
- `toggleString.string` receives the text while `toggleString.option` remains
  unchanged.

Initial execution uses the same evaluator, ensuring all result modes use
current reference text. The source exposes its cloned bindings to the Results
sidebar without exposing them in its serializable recipe snapshot.

`ResultsController` subscribes to each source binding. A binding text-change
event schedules the existing debounced recomputation. Input-range and argument-
reference changes share the existing generation guard, so stale asynchronous
evaluations cannot overwrite newer output. Deleting a result, closing its input
document, or disposing the controller disposes its binding subscriptions.

## User Behavior

1. The user selects a non-empty editor range and clicks **Use selection** for a
   supported argument.
2. The field shows the range's current text and remains bound to that range.
3. Editing text inside the original range updates the field. If a Results
   sidebar item exists for an applied recipe, it recomputes after the existing
   debounce interval.
4. Editing text before the range shifts its offsets but does not recompute when
   the referenced text is unchanged. Unrelated document edits do nothing.
5. Typing into the recipe parameter removes its binding and restores normal
   value behavior.

The existing button remains the bind action; no unlink button or live preview
is added. Manual editing is the unlink mechanism.

## Save And Close Behavior

Saving a recipe materializes each binding's latest text into cloned ordinary
steps before invoking the existing pipeline store. No reference metadata is
persisted.

If a referenced document closes, each binding keeps its last resolved text and
stops updating. Existing recipe fields and live results retain that value. If
the same document is also a live result's input document, the Results sidebar
keeps its existing behavior of removing that result when the input closes.

## Validation And Errors

Missing active editors, empty selections, invalid step or argument targets,
ineligible argument types, and stale binding IDs are silent no-ops. Reference
objects are never passed to operations or pipeline storage.

## Testing

### Tracked selection

- Edits inside the range update text and emit a change.
- Edits before the range shift offsets without emitting a text change.
- Unrelated edits do not affect the range or emit.
- Closing the document freezes the latest text.

### Recipe provider

- Binding is available only for `string` and `toggleString`.
- References follow stable step IDs through reorder.
- Removing/loading steps disposes bindings.
- Manual argument edits unlink only their target binding.
- Reference changes update displayed ordinary values.
- `toggleString` updates preserve `.option`.
- Saving receives fully materialized steps with no reference metadata.

### Result source and controller

- Initial and repeated evaluation materialize current reference text.
- Referenced-range text changes schedule one debounced recomputation.
- Offset-only shifts and unrelated edits do not recompute.
- Closing a reference document retains the final value.
- Result deletion, input-document close, and controller disposal remove
  reference subscriptions.
- Existing generation guards still reject stale asynchronous results.

## Non-goals

- Following changes to the editor's active selection.
- Persisting references in saved pipelines.
- Adding a Recipe pane live preview.
- Dynamically updating popup, replace, copy, inline, or panel results.
- Supporting argument types other than `string` and `toggleString`.
