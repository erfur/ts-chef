# Design: assign editor selection to recipe string arguments

**Date:** 2026-07-19
**Status:** Approved
**Builds on:** [2026-06-16-recipe-arg-editing-design.md](2026-06-16-recipe-arg-editing-design.md)

## Problem

Recipe operation arguments can be edited inline, but copying selected editor
text into a string argument requires manual copy and paste. Each plain string
argument should provide a direct way to use the active editor selection.

## User interface

Each argument rendered by the default plain-string case gets a compact **Use
selection** button beside its text input. The button does not appear for
`toggleString`, number, option, editable option, argument selector, or boolean
arguments.

## Data flow

1. The button click posts a `useSelection` webview message containing the step
   and argument indexes.
2. `RecipeViewProvider` validates that the indexes identify a current recipe
   step and a plain string argument, then invokes a new callback supplied by
   `extension.ts`.
3. The callback reads the active text editor's current selection. It returns no
   value when there is no active editor or the selection is empty.
4. For a non-empty selection, the provider assigns the selected text to the
   argument in its canonical recipe and posts refreshed recipe state. The
   webview rerenders with the assigned value.

Selection text is requested at click time so it cannot become stale and no
editor-selection event subscription is needed.

## Error handling

Missing editors, empty selections, stale indexes, and non-string argument
targets are no-ops. Existing argument values remain unchanged and no warning is
shown for these expected conditions.

## Testing

`test/commands/recipeViewProvider.test.ts` will cover:

- A **Use selection** button is rendered for a plain string argument.
- Specialized argument types, including `toggleString`, do not receive the
  button.
- Clicking the button sends the expected step and argument indexes.
- A non-empty callback result updates the canonical recipe and posted state.
- Missing or empty selection results leave the recipe unchanged.
- Invalid or non-string targets are ignored.

The existing recipe argument editing, apply, save, reorder, and remove behavior
remains unchanged.

## Non-goals

- Using the whole document when the editor selection is empty.
- Adding selection buttons to specialized argument controls.
- Tracking selection changes continuously.
- Changing Pipeline Editor argument controls.
