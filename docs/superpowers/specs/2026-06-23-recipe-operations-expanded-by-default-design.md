# Recipe Operations Expanded By Default Design

## Goal

Recipe pane operations that have editable arguments render expanded by default in all normal recipe states: after adding an operation, loading a saved recipe, removing a step, or reordering steps.

## Scope

- Change only the Recipe webview behavior in `src/providers/recipeViewProvider.ts`.
- Keep recipe persistence, apply/save callbacks, pipeline step shape, and operation execution unchanged.
- Operations without arguments continue to render as simple rows with no argument controls.

## Approach

The Recipe webview already receives argument definitions in each `state` message and uses them during render. Instead of storing default expansion state in the local `expanded` set, rendering should treat every argument-bearing step as open. This makes add, load, reorder, and remove behavior consistent without changing extension-side state.

## Testing

Add or update `test/commands/recipeViewProvider.test.ts` to assert the generated webview script renders argument-bearing steps as open by default. The test should inspect the generated HTML because the behavior lives inside the embedded webview script.

## Risks

Always-expanded argument controls can make long recipes taller. This matches the requested default and avoids hidden configuration fields for recipes with editable operations.
