# Design: recipe selection reference controls

**Date:** 2026-07-19
**Status:** Approved
**Builds on:** [2026-07-19-dynamic-selection-reference-design.md](2026-07-19-dynamic-selection-reference-design.md)

## Problem

Recipe parameters bound to editor selections still look and behave like ordinary
editable text fields. Clicking one focuses the recipe field instead of returning
to the source selection, and the only way to remove a binding is to manually edit
the value. The text-labeled **Use selection** action also occupies unnecessary
space in the narrow Recipe pane.

## User interface

Eligible unbound `string` and `toggleString` parameters show an icon-only **Use
Selection** button beside the text input. The button retains an accessible
`title` and `aria-label`; it has no visible text. It uses a compact inline link
SVG, while the clear action uses an inline X SVG. Both use `currentColor` so they
follow the active VS Code theme without loading an external icon font.

After a parameter is bound to an editor selection:

- Its text input is read-only and visually identifiable as referenced.
- Clicking the text input asks VS Code to reveal the source document and select
  the complete tracked range instead of focusing the parameter for editing.
- The **Use Selection** action is replaced by an icon-only **Clear Selection
  Reference** button with an accessible `title` and `aria-label`.
- Clearing removes only that parameter's binding and keeps the latest
  materialized text as the ordinary editable value.

For `toggleString`, the encoding selector remains editable while the referenced
text input is read-only. Clearing or revealing the text reference does not alter
the selected encoding.

## Architecture and data flow

`RecipeViewProvider` remains authoritative for runtime bindings. Its posted
webview state adds a list of bound targets identified by stable step ID and
argument index. Reference metadata does not enter `PipelineStep.args` and is not
saved with pipelines.

The webview uses that target list when rendering argument rows:

1. An unbound eligible target renders its normal text input and icon-only bind
   action.
2. A bound target renders a read-only text input and icon-only clear action.
3. Clicking a bound input posts a `revealSelection` message with its stable step
   ID and argument index.
4. Clicking its clear action posts a `clearSelection` message with the same
   target identifiers.

The provider validates both messages against the current stable IDs and binding
map. Reveal delegates to an asynchronous `reveal()` operation on the tracked
selection reference, which opens or focuses its source editor, reveals the range,
and assigns that full range as the active selection. Clear first materializes the
latest referenced text, then disposes and removes the binding, and finally posts
refreshed state.

The tracked reference owns source-document and transformed-range knowledge. The
webview receives no URI or range details, preserving the existing host/webview
boundary.

## Closed source documents

A closed source document remains represented by its frozen last value, as it is
today. Clicking the bound field is a silent no-op because there is no open source
editor to reveal. The clear action remains available and converts the frozen
value into an ordinary editable parameter.

## Validation and errors

Malformed messages, unknown step IDs, invalid argument indexes, ineligible
argument types, and targets without an active binding are silent no-ops. Reveal
failure does not clear or alter the binding. Clear affects only the requested
binding and preserves its current value.

## Testing

`test/commands/recipeViewProvider.test.ts` will cover:

- Eligible unbound fields render icon-only Use Selection controls with
  accessible labels.
- Bound state posted by the provider identifies current stable step and argument
  targets.
- Bound plain-string and `toggleString` text inputs are read-only and render an
  icon-only clear control.
- Clicking a bound input sends the expected reveal request.
- Clearing disposes only the requested binding, retains its current text, and
  restores ordinary editing and the bind control.
- `toggleString` reveal and clear behavior preserves its encoding option.
- Invalid, stale, and unbound reveal or clear targets are ignored.
- Existing reorder, step removal, recipe loading, and provider disposal behavior
  still keeps binding state and subscriptions consistent.

Tracked-selection tests will cover revealing an open source document by
selecting its transformed range and treating a closed source document as a
no-op.

## Non-goals

- Persisting selection references in saved pipelines.
- Changing which argument types support selection references.
- Changing the source range when the user changes the editor's active selection.
- Restoring the parameter value that existed before binding.
- Adding visible button labels or a separate binding status label.
