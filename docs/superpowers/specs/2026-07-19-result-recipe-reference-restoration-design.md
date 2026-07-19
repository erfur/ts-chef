# Design: restore result references into recipe parameters

**Date:** 2026-07-19
**Status:** Approved
**Builds on:** [2026-07-19-recipe-selection-controls-design.md](2026-07-19-recipe-selection-controls-design.md)

## Problem

Sidebar results retain cloned editor-selection references so their output can be
recomputed while the result remains accessible. Opening a result currently loads
only its materialized recipe snapshot. Recipe parameters therefore lose their
live bindings even though the result still has enough information to restore
them.

## Behavior

Opening an accessible sidebar result restores its retained parameter references
into the Recipe view. Restored `string` and `toggleString` parameters use the
existing bound-field presentation and behavior: their text is read-only, follows
the tracked source text, can reveal its source selection, and can be cleared.

The result and Recipe view own independent reference clones. Deleting the result
after opening it does not unbind the loaded Recipe parameters. Replacing or
disposing the loaded recipe likewise does not affect the result's references or
live recomputation.

## Architecture and data flow

`ResultsController` extends its `loadRecipe` dependency call to include the
selected result source's retained argument references alongside the cloned recipe
snapshot. References remain identified by recipe step index and argument index at
this boundary.

`RecipeViewProvider.load()` replaces its current recipe and bindings as follows:

1. Dispose the existing Recipe bindings.
2. Install the supplied recipe and generate new stable step IDs.
3. Validate each supplied reference against the loaded step, argument index, and
   current argument definition.
4. Clone each valid reference for Recipe ownership, subscribe to its changes, and
   associate it with the new stable step ID and argument index.
5. Materialize current reference text and post the restored bound state.

The result keeps its original retained references. The Recipe view owns and
disposes only the clones created during loading.

## Validation and errors

Only references whose type matches an eligible loaded argument are restored:
`string` references require a `string` argument, and `toggleString` references
require a `toggleString` argument. Missing steps, invalid or non-integer argument
indexes, and type mismatches are ignored without altering other bindings.

Cloning occurs only after validation so ignored entries do not create resources
that require disposal. If loading receives no references, behavior remains the
same as loading an ordinary saved pipeline.

For `toggleString`, materialization replaces only the text and preserves the
encoding option from the loaded recipe snapshot.

## Ownership and lifetime

The sidebar result owns its references until the result is deleted, its input
document closes and removes the result, or the results controller is disposed.
The loaded Recipe view independently owns its cloned bindings until each binding
is cleared or edited, its step is removed, another recipe is loaded, or the
provider is disposed.

Closing a parameter reference's source document preserves the existing frozen
last-value behavior. It does not remove either the result or Recipe binding by
itself unless that document is also the result's input document and therefore
causes the result record to be removed.

## Testing

`test/commands/resultsController.test.ts` will verify that opening a result passes
its retained references with an immutable recipe snapshot to the Recipe view.

`test/commands/recipeViewProvider.test.ts` will verify that loading references:

- Restores plain-string and `toggleString` bindings against newly generated
  stable step IDs.
- Materializes current referenced text while preserving `toggleString` encoding.
- Continues updating restored values when source text changes.
- Ignores missing steps, invalid argument indexes, and argument-type mismatches.
- Clones references so disposal of the result-side originals does not unbind the
  Recipe view.
- Disposes Recipe-owned clones through existing clear, edit, load, step-removal,
  and provider-disposal paths.

Existing tests continue to cover loading saved pipelines without references,
result recomputation, and result reference disposal.

## Non-goals

- Persisting references in saved pipelines or serialized recipe parameters.
- Restoring references from result modes that do not retain an accessible result
  source.
- Sharing a single reference instance between a result and the Recipe view.
- Changing which recipe argument types support selection references.
