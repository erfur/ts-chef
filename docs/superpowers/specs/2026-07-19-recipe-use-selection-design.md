# Design: assign editor selection to recipe string arguments

**Date:** 2026-07-19
**Status:** Approved
**Builds on:** [2026-06-16-recipe-arg-editing-design.md](2026-06-16-recipe-arg-editing-design.md)

## Problem

Recipe operation arguments can be edited inline, but copying selected editor
text into a string argument requires manual copy and paste. Each plain string
or `toggleString` argument should provide a direct way to use the active editor
selection.

## User interface

Each plain `string` or `toggleString` argument gets a compact **Use selection**
button immediately after its text input. For `toggleString`, the encoding
selector remains after the button. The button does not appear for number,
option, editable option, argument selector, boolean, or unsupported specialized
arguments.

## Data flow

1. The button click posts a `useSelection` webview message containing the step
   and argument indexes.
2. `RecipeViewProvider` validates that the indexes identify a current recipe
   step and a `string` or `toggleString` argument, then invokes a callback
   supplied by `extension.ts`.
3. The callback reads the active text editor's current selection. It returns no
   value when there is no active editor or the selection is empty.
4. For a non-empty selection, the provider assigns the selected text directly
   to a `string` argument. For `toggleString`, it replaces only the `.string`
   field and preserves the existing `.option` encoding. It then posts refreshed
   recipe state, and the webview rerenders with the assigned value.

Selection text is requested at click time so it cannot become stale and no
editor-selection event subscription is needed.

## Error handling

Missing editors, empty selections, stale indexes, and ineligible argument
targets are no-ops. Existing argument values remain unchanged and no warning is
shown for these expected conditions.

## Testing

`test/commands/recipeViewProvider.test.ts` will cover:

- A **Use selection** button is rendered for plain `string` and `toggleString`
  arguments.
- Unsupported specialized argument types do not receive the button.
- Clicking the button sends the expected step and argument indexes.
- A non-empty callback result updates the canonical recipe and posted state.
- Assigning a `toggleString` replaces its string value while preserving its
  encoding option.
- Missing or empty selection results leave the recipe unchanged.
- Invalid or ineligible targets are ignored.

The existing recipe argument editing, apply, save, reorder, and remove behavior
remains unchanged.

## Non-goals

- Using the whole document when the editor selection is empty.
- Adding selection buttons to specialized argument controls other than
  `toggleString`.
- Tracking selection changes continuously.
- Changing Pipeline Editor argument controls.
