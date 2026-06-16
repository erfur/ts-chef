# Design: Recipe sidebar pane

**Date:** 2026-06-16
**Status:** Approved

## Problem

Users want a persistent sidebar pane that holds one working "recipe" (a single
pipeline), built by adding operations from the Operations pane, named, applied
to the selection, saved into the pipelines list, and re-loaded from there.

## Constraint that shaped the design

Drag-and-drop between two webviews is not supported (isolated iframes), and the
Operations pane is a webview (for its inline filter) while the Recipe pane needs
an inline name input (also a webview). So operations are added to the recipe via
a **＋ button** on each operation row (not cross-pane drag). Reordering *within*
the recipe uses real drag-and-drop (works inside one webview).

## Components

### `tschef.recipeView` (new webview view)

Added to `tschef-sidebar` as the **2nd** view (after Operations), declared
`"type": "webview"`. Registered with `retainContextWhenHidden: true` so the
working recipe survives hide/show.

### `RecipeViewProvider` (`src/providers/recipeViewProvider.ts`, new)

`implements vscode.WebviewViewProvider`. Holds the **canonical** working recipe:
`{ name: string; steps: PipelineStep[] }` (`PipelineStep = { opName: string; args: unknown[] }`), default `{ name: "", steps: [] }` — the "temporary recipe".

Constructed with injected callbacks (keeps it decoupled/testable, mirroring the
`presentPipelineResult` render map):

```ts
type RecipeCallbacks = {
  onApply: (steps: PipelineStep[]) => void | Promise<void>;
  onSave: (name: string, steps: PipelineStep[]) => void | Promise<void>;
};
new RecipeViewProvider(callbacks: RecipeCallbacks)
```

- `resolveWebviewView(view)`: store the view; `webview.options = { enableScripts: true }`; set `webview.html`; subscribe `onDidReceiveMessage`.
- Methods called from the extension:
  - `addOp(step: PipelineStep)`: push to `recipe.steps`; post `state`.
  - `load(pipeline: { name: string; steps: PipelineStep[] })`: set `recipe = { name, steps }`; reveal the view (`view.show(false)` if resolved); post `state`.
- Message protocol:
  - webview → ext: `{ type: "ready" }` (→ post current `state`); `{ type: "edit", name, steps }` (user renamed / reordered / removed → replace canonical `recipe`); `{ type: "apply" }` (→ `callbacks.onApply(recipe.steps)`); `{ type: "save" }` (→ `callbacks.onSave(recipe.name, recipe.steps)`).
  - ext → webview: `{ type: "state", recipe }`.
- `postState()`: if a webview is resolved, `postMessage({ type: "state", recipe })`.

Because the controller is canonical, `load` works even when the pane was never
opened: the `loadRecipe` command reveals the pane first; on first resolve the
webview's `ready` message pulls the just-set state.

### Recipe webview HTML

Themed with VS Code CSS variables: a name `<input>` (empty by default), the
ordered step list (each row: index, operation display label, a ⠿ drag handle to
reorder within the pane, a ✕ remove button), and two buttons — **Apply to
selection** and **Save as pipeline**. On any user edit (rename / reorder /
remove) it posts `edit` with the full current `{ name, steps }`; the buttons post
`apply` / `save`; on load it posts `ready` and renders incoming `state`. Step
labels are looked up from the embedded op list (opName → displayName) so rows
show friendly names; HTML-escape all interpolated text; when embedding the
op-list JSON, replace `<` with the `<` escape sequence (matching
`operationsViewProvider`, to avoid a `</script>` breakout).

### Operations pane ＋ button

Each operation row in `operationsViewProvider` gains a ＋ control that posts
`{ type: "addToRecipe", opName }`. The provider's message handler routes it via
`vscode.commands.executeCommand("tschef.addToRecipe", opName)`. Row-label click
still applies-now (unchanged).

### `extension.ts` wiring

- Construct `RecipeViewProvider` with:
  - `onApply(steps)`: `editor = activeTextEditor` (warn if none); `text = resolveVars(getText(selection) || getText(), varStore)`; `result = runPipeline(text, steps)`; `await presentPipelineResult(editor, result, "Recipe", { inline, panel })` (honors `pipelineResultAction`); try/catch → `showErrorMessage`.
  - `onSave(name, steps)`: warn if `name` empty or `steps` empty; `scope = await pickScope()` (cancel → return); `raw = steps.map(s => s.opName).join(" | ")`; `pipeStore.upsert(scope, { name, steps, raw })`; `pipeTree.refresh()`; info message.
  - Register via `registerWebviewViewProvider("tschef.recipeView", recipeView, { webviewOptions: { retainContextWhenHidden: true } })`.
- Command `tschef.addToRecipe(opName)`: `entry = registry.find(...)` (return if none); `step = { opName, args: entry.factory().args.map((a) => resolveDefaultArg(a)) }`; `recipeView.addOp(step)`; reveal via `executeCommand("tschef.recipeView.focus")`.
- Command `tschef.loadRecipe(node)`: the node is the `PipelineNode` from the tree (carries `.pipeline: ScopedPipeline`); `executeCommand("tschef.recipeView.focus")`; `recipeView.load(node.pipeline)`. (Guard: if `node?.pipeline` is missing, return.)

### Pipelines tree — "Load into Recipe" inline button

`PipelineNode.contextValue` is already `pipeline-<scope>`. Add a
`view/item/context` inline button for `tschef.loadRecipe`
(`when: "view == tschef.pipelinesView && viewItem =~ /^pipeline-/"`,
`group: "inline"`).

### `package.json`

- `views.tschef-sidebar`: add `{ "id": "tschef.recipeView", "name": "Recipe", "type": "webview", "contextualTitle": "tschef Recipe" }` as the 2nd entry.
- `commands`: add `tschef.loadRecipe` (title "tschef: Load Pipeline into Recipe", icon `$(arrow-right)`). `tschef.addToRecipe` stays internal (arg-taking).
- `menus.view/item/context`: add the `tschef.loadRecipe` inline button (above).

## Testing

`test/commands/recipeViewProvider.test.ts` (inject `onApply`/`onSave` jest.fns,
fake `WebviewView` with `webview.{options,html,onDidReceiveMessage,postMessage}`
+ `show`):

- `resolveWebviewView` enables scripts; html contains a name `<input>` and
  "Apply"/"Save".
- `ready` → posts `{ type: "state", recipe: { name: "", steps: [] } }`.
- `edit` updates the canonical recipe; a following `save` calls `onSave` with the
  edited name + steps.
- `addOp(step)` posts `state` whose recipe.steps include the new op.
- `load(pipeline)` sets name+steps, posts `state`, and calls `view.show`.
- `apply` calls `onApply` with the current steps.

Extend `test/commands/operationsViewProvider.test.ts`: an `addToRecipe` message
calls `executeCommand("tschef.addToRecipe", opName)`.

Mock additions: none required for the recipe test beyond a fake view; `commands`
already exists. (Client-side webview JS is not unit-tested, as with the other
webviews.)

## Deliberate v1 non-goals

- **No inline per-step argument editing** — operations are added with default
  args (`resolveDefaultArg`); use the full Pipeline Editor for arg tuning.
- One working recipe (no multi-recipe tabs/management).
- No description field on save (name only); scope chosen via the existing
  `pickScope` quick pick at save time.
- Apply uses selection-or-whole-document, like `runPipeline`.
