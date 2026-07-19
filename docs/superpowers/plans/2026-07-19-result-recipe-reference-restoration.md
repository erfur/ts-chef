# Result Recipe Reference Restoration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore live input references into Recipe parameters when an accessible sidebar result is opened.

**Architecture:** Extend `RecipeViewProvider.load()` to accept result argument references, validate them against the loaded recipe, and clone them into provider-owned bindings associated with newly generated stable step IDs. Pass the retained result references through `ResultsController` and the extension callback without transferring ownership, so deleting either the result or loaded recipe cannot break the other.

**Tech Stack:** TypeScript, VS Code extension APIs, Jest

## Global Constraints

- Selection references remain runtime-only and never enter `PipelineStep.args` or saved pipeline data.
- Only matching `string` and `toggleString` parameters restore references.
- The result and Recipe view own independent reference clones.
- Deleting a result after opening it must not unbind the loaded Recipe parameters.
- Replacing or disposing the loaded recipe must not affect result recomputation or result-owned references.
- A restored `toggleString` reference changes only its text and preserves the loaded encoding option.
- Invalid step indexes, argument indexes, and argument-type mismatches are silent no-ops.
- Loading a saved pipeline without references retains its existing behavior.
- Do not add a shared reference registry or serialize reference metadata.

---

### Task 1: Restore Provider-Owned Bindings During Recipe Load

**Files:**
- Modify: `src/providers/recipeViewProvider.ts:229-235`
- Test: `test/commands/recipeViewProvider.test.ts:29-47,802-814,824-852,1009-1054`

**Interfaces:**
- Consumes: `PipelineArgReference[]`, where each entry contains `stepIndex`, `argIndex`, `type`, and a result-owned `SelectionReference`.
- Produces: `RecipeViewProvider.load(pipeline: { name: string; steps: PipelineStep[] }, references?: PipelineArgReference[]): void`.
- Ownership: every accepted entry is cloned with `reference.clone()`; the provider stores and disposes only the clone.

- [ ] **Step 1: Add a failing test for restoring independently owned references**

Add this test after the existing `load replaces the recipe` case in `test/commands/recipeViewProvider.test.ts`:

```ts
test("load restores cloned string and toggleString references", async () => {
  const stringSource = fakeReference("source string");
  const stringClone = fakeReference("restored string");
  const toggleSource = fakeReference("source key");
  const toggleClone = fakeReference("restored key");
  (stringSource.reference.clone as jest.Mock).mockReturnValue(
    stringClone.reference,
  );
  (toggleSource.reference.clone as jest.Mock).mockReturnValue(
    toggleClone.reference,
  );
  const { p, v, onMessage } = setup();

  p.load(
    {
      name: "restored",
      steps: [
        {
          opName: "FromBase64",
          args: ["snapshot", { string: "snapshot key", option: "UTF8" }, ""],
        },
      ],
    },
    [
      {
        stepIndex: 0,
        argIndex: 0,
        type: "string",
        reference: stringSource.reference,
      },
      {
        stepIndex: 0,
        argIndex: 1,
        type: "toggleString",
        reference: toggleSource.reference,
      },
    ],
  );

  const state = lastPostedState(v);
  expect(stringSource.reference.clone).toHaveBeenCalledTimes(1);
  expect(toggleSource.reference.clone).toHaveBeenCalledTimes(1);
  expect(state.recipe.steps[0].args).toEqual([
    "restored string",
    { string: "restored key", option: "UTF8" },
    "",
  ]);
  expect(state.boundArgs).toEqual([
    { stepId: state.stepIds[0], arg: 0 },
    { stepId: state.stepIds[0], arg: 1 },
  ]);

  stringSource.reference.dispose();
  toggleSource.reference.dispose();
  stringClone.setText("latest string");
  toggleClone.setText("latest key");
  stringClone.fire();
  toggleClone.fire();
  await onMessage({ type: "apply" });

  expect(lastPostedState(v).recipe.steps[0].args).toEqual([
    "latest string",
    { string: "latest key", option: "UTF8" },
    "",
  ]);
  expect(stringClone.reference.dispose).not.toHaveBeenCalled();
  expect(toggleClone.reference.dispose).not.toHaveBeenCalled();

  p.load({ name: "replacement", steps: [] });
  expect(stringClone.reference.dispose).toHaveBeenCalledTimes(1);
  expect(toggleClone.reference.dispose).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Add failing validation tests**

Add this parameterized test beside the restoration test:

```ts
test.each([
  ["missing step", 1, 0, "string"],
  ["negative step", -1, 0, "string"],
  ["fractional step", 0.5, 0, "string"],
  ["missing argument", 0, 9, "string"],
  ["fractional argument", 0, 0.5, "string"],
  ["mismatched type", 0, 0, "toggleString"],
] as const)(
  "load ignores a reference with %s",
  (_label, stepIndex, argIndex, type) => {
    const source = fakeReference("ignored");
    const { p, v } = setup();

    p.load(
      {
        name: "loaded",
        steps: [{ opName: "FromBase64", args: ["snapshot"] }],
      },
      [
        {
          stepIndex,
          argIndex,
          type,
          reference: source.reference,
        },
      ],
    );

    expect(source.reference.clone).not.toHaveBeenCalled();
    expect(lastPostedState(v)).toMatchObject({
      recipe: {
        name: "loaded",
        steps: [{ opName: "FromBase64", args: ["snapshot"] }],
      },
      boundArgs: [],
    });
  },
);
```

- [ ] **Step 3: Run the provider tests and verify RED**

Run:

```bash
npx jest test/commands/recipeViewProvider.test.ts --runInBand
```

Expected: TypeScript compilation fails because `RecipeViewProvider.load()` accepts only one argument.

- [ ] **Step 4: Implement reference restoration in `RecipeViewProvider.load()`**

Replace the current method with:

```ts
/** Replace the working recipe with a saved pipeline and reveal the pane. */
load(
  pipeline: { name: string; steps: PipelineStep[] },
  references: PipelineArgReference[] = [],
): void {
  this.disposeBindings();
  this.recipe = { name: pipeline.name, steps: [...pipeline.steps] };
  this.stepIds = pipeline.steps.map(() => this.nextStepId());

  for (const candidate of references) {
    if (
      !Number.isInteger(candidate.stepIndex) ||
      !Number.isInteger(candidate.argIndex)
    )
      continue;
    const step = this.recipe.steps[candidate.stepIndex];
    const stepId = this.stepIds[candidate.stepIndex];
    const argDef = step && this.argDefsFor(step.opName)[candidate.argIndex];
    if (!step || !stepId || argDef?.type !== candidate.type) continue;
    if (candidate.type !== "string" && candidate.type !== "toggleString")
      continue;

    const reference = candidate.reference.clone();
    const binding: RecipeBinding = {
      type: candidate.type,
      reference,
      subscription: reference.onDidChange(() => {
        this.materializeBinding(stepId, candidate.argIndex, binding);
        this.postState();
      }),
    };
    this.bindings.set(
      this.bindingKey(stepId, candidate.argIndex),
      binding,
    );
    this.materializeBinding(stepId, candidate.argIndex, binding);
  }

  this.view?.show?.(false);
  this.postState();
}
```

This validates before cloning, keeps references out of the recipe value, and reuses the provider's existing materialization, subscription, and disposal paths.

- [ ] **Step 5: Run the provider tests and verify GREEN**

Run:

```bash
npx jest test/commands/recipeViewProvider.test.ts --runInBand
```

Expected: all `RecipeViewProvider` tests pass, including saved-pipeline loading with the default empty reference list.

- [ ] **Step 6: Commit provider restoration**

```bash
git add src/providers/recipeViewProvider.ts test/commands/recipeViewProvider.test.ts
git commit -m "feat: restore recipe parameter references"
```

---

### Task 2: Pass Retained Result References Into Recipe Load

**Files:**
- Modify: `src/commands/resultsController.ts:27-29,272-286`
- Modify: `src/extension.ts:169-174`
- Test: `test/commands/resultsController.test.ts:527-562`

**Interfaces:**
- Consumes: `RenderedResultSource.references?: PipelineArgReference[]` retained by an accessible sidebar result.
- Produces: `ResultsDependencies.loadRecipe(recipe: { name: string; steps: PipelineStep[] }, references?: PipelineArgReference[]): void`.
- Calls: `RecipeViewProvider.load(recipe, references)` from Task 1; that method clones accepted references and does not take ownership of the supplied instances.

- [ ] **Step 1: Add a failing controller test for reference handoff**

Update the expectation in `opens the source range and loads an immutable recipe snapshot` to include the empty reference list:

```ts
expect(loadRecipe).toHaveBeenCalledWith(
  {
    name: "Original",
    steps: [{ opName: "From Hex", args: [{ alphabet: "standard" }] }],
  },
  [],
);
```

Then add this test after it:

```ts
test("opening a result loads its retained parameter references", async () => {
  const dynamic = sourceWithReference();
  const document = makeDocument("source.txt");
  const { editor } = makeEditor(document);
  window.showTextDocument.mockResolvedValue(makeEditor(document).editor);
  const { controller, emit, lastState, loadRecipe } = setup();
  controller.show(editor, "result", target(2, 6), dynamic.source);

  await emit({ type: "open", id: lastState().items[0].id });

  expect(loadRecipe).toHaveBeenCalledWith(
    {
      name: "Recipe",
      steps: [{ opName: "From Hex", args: [{ alphabet: "standard" }] }],
    },
    dynamic.source.references,
  );
  expect(dynamic.source.dispose).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the controller test and verify RED**

Run:

```bash
npx jest test/commands/resultsController.test.ts --runInBand
```

Expected: both changed expectations fail because `loadRecipe` receives only the recipe snapshot.

- [ ] **Step 3: Extend the dependency interface and pass references on open**

Import `PipelineArgReference` beside `RenderedResultSource`:

```ts
import type {
  PipelineArgReference,
  RenderedResultSource,
} from "./pipelineResult";
```

Change the dependency signature to:

```ts
type ResultsDependencies = {
  loadRecipe: (
    recipe: { name: string; steps: PipelineStep[] },
    references?: PipelineArgReference[],
  ) => void;
```

Change the final statement in `open()` to preserve the immutable recipe snapshot while passing the result-owned reference array unchanged:

```ts
this.dependencies.loadRecipe(
  structuredClone(item.source.recipe),
  item.source.references ?? [],
);
```

- [ ] **Step 4: Wire the references through `extension.ts`**

Change the dependency callback to:

```ts
loadRecipe: (recipe, references) => {
  vscode.commands.executeCommand("tschef.recipeView.focus");
  recipeView.load(recipe, references);
},
```

Do not clone references in the extension callback. `RecipeViewProvider.load()` is the ownership boundary and clones each accepted reference itself.

- [ ] **Step 5: Run focused tests and type checking**

Run:

```bash
npx jest test/commands/resultsController.test.ts test/commands/recipeViewProvider.test.ts --runInBand
npm run typecheck
```

Expected: both Jest suites pass and TypeScript exits with code 0.

- [ ] **Step 6: Run project verification**

Run:

```bash
npm test -- --runInBand
npm run lint
```

Expected: the full Jest suite passes and ESLint exits with code 0.

- [ ] **Step 7: Commit result handoff**

```bash
git add src/commands/resultsController.ts src/extension.ts test/commands/resultsController.test.ts
git commit -m "feat: retain recipe references from results"
```
