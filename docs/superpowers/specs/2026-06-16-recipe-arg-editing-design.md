# Design: recipe per-step argument editing + default save scope

**Date:** 2026-06-16
**Status:** Approved
**Builds on:** [2026-06-16-recipe-pane-design.md](2026-06-16-recipe-pane-design.md)

## Problem

Two refinements to the Recipe pane:

1. A recipe step is added with default args and cannot be configured. Steps
   whose operation has arguments should be **expandable** to edit those args
   inline (like the Pipeline Editor).
2. "Save as pipeline" prompts for scope every time. It should use a
   **configured default scope** instead.

## Part A — Per-step argument editing

The Pipeline Editor (`src/panels/pipelinePanel.ts`) already renders per-step arg
editors from each op's `ArgConfig[]`. The recipe webview ports that approach.

### Arg-definition plumbing

`RecipeViewProvider` gains an injected resolver:

```ts
new RecipeViewProvider(
  items: { opName: string; displayName: string }[],
  callbacks: RecipeCallbacks,
  argDefsFor: (opName: string) => ArgConfig[],
)
```

`extension.ts` supplies `argDefsFor` from the registry, memoized, instantiating
each op at most once and only for ops that actually appear in a recipe (no
up-front cost for all ~425 ops).

`postState` now sends `{ type: "state", recipe, defs }`, where
`defs: Record<string, ArgConfig[]>` contains an entry for each distinct opName in
`recipe.steps` (`defs[opName] = argDefsFor(opName)`).

### Webview rendering (ported from `pipelinePanel.ts`)

- Each step row shows an expand chevron (▼/▲) **only when**
  `defs[step.opName]` is non-empty. Per-step `expanded` is client-only UI state
  (a `Set` of indices), not part of the persisted recipe.
- Expanded → an arg row per `ArgConfig`, rendered by type (ported verbatim from
  `renderArgRow`):
  - `boolean` → checkbox; `number` → number input (min/max/step); `option` /
    `argSelector` → `<select>`; `editableOption` / `editableOptionShort` →
    `<select>` mapping option name → `.value`; `toggleString` → text input +
    an encoding `<select>` of `toggleValues`; default → text input.
  - Initial values are read from `step.args[ai]`.
- On `change`/`input`, the value is written back into `step.args[ai]` (ported
  from `handleArgUpdate`, but targeting `step.args` instead of
  `step.argValues`), then the webview posts `edit` with the full recipe.

Adding an op still uses default args (`resolveDefaultArg`, server-side) — now
they are editable afterward. Reorder/remove are unchanged.

## Part B — `defaultPipelineScope` setting

- `package.json`: add `tschef.defaultPipelineScope` (`type: "string"`,
  `enum: ["global", "workspace"]`, `default: "global"`, with enumDescriptions).
- `extension.ts` `onSave`: replace the `pickScope()` prompt with
  `const scope = vscode.workspace.getConfiguration("tschef").get<StorageScope>("defaultPipelineScope", "global")`,
  then `pipeStore.upsert(scope, …)` with no prompt. (`PipelineStore.save`
  already warns and no-ops if `workspace` is chosen with no folder open.)
- Other save flows (variables `setVariable`, the Pipeline Editor panel) keep
  their existing behavior — out of scope.

## Testing

- `test/commands/recipeViewProvider.test.ts` (update for the new constructor
  arg `argDefsFor`, e.g. a jest.fn returning a fixed `ArgConfig[]`):
  - `ready`/`addOp`/`load` post a `state` message that includes a `defs` map
    with an entry for each opName in the recipe (and `argDefsFor` is consulted
    for them).
  - The existing behavior tests still pass (edit/apply/save/addOp/load), now
    asserting the `state` payload shape `{ type: "state", recipe, defs }`.
- The arg-editor *rendering / value round-trip* is client-side webview JS and is
  not unit-tested (consistent with `pipelinePanel.ts`).
- Part B (`onSave` reading the config) is extension glue — covered by
  typecheck/build, not a unit test.

## Non-goals

- No live preview in the recipe pane (Apply is explicit).
- No change to the Pipeline Editor, variables save, or other modes.
- The `defaultPipelineScope` setting governs only the recipe "Save as pipeline"
  action (not variables or the Pipeline Editor's own scope selector).
