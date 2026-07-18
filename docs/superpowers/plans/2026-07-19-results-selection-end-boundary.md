# Results Selection End Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep insertions exactly at the end of a tracked non-empty result selection outside that selection and prevent them from recomputing the result.

**Architecture:** Preserve the existing offset-based tracking architecture and change only the pure `transformTrackedRange` boundary semantics. Non-empty ranges become half-open for insertions, while zero-length ranges keep their current cursor-expansion special case.

**Tech Stack:** TypeScript 5, VS Code Extension API 1.85, Jest 29 with `ts-jest`.

## Global Constraints

- Treat non-empty tracked ranges as half-open `[start, end)` for insertions.
- Keep insertions at `start` and strictly inside the range tracked.
- Keep insertions at a zero-length tracked cursor tracked.
- Keep replacements, deletions, and edits before/after the range unchanged.
- Appending at the end of a whole-document tracked range must stay outside it.
- Do not change result rendering, filtering, actions, persistence, or current-tab behavior.
- Do not modify or stage the unrelated existing change in `src/generated/opsRegistry.ts`.

## File Map

- Modify `src/commands/resultsController.ts`: align insertion membership and end-boundary mapping with half-open non-empty ranges.
- Modify `test/commands/resultsController.test.ts`: replace inclusive-end expectations and add pure/controller regressions.

---

### Task 1: Make Non-Empty End Boundaries Exclusive

**Files:**
- Modify: `src/commands/resultsController.ts:41-78`
- Test: `test/commands/resultsController.test.ts:150-327,572-734`

**Interfaces:**
- Consumes: existing `transformTrackedRange(start, end, changes)` callers and `OffsetChange` event data.
- Produces: the same `{ start: number; end: number; changed: boolean }` return type with half-open insertion semantics for non-empty ranges.

- [ ] **Step 1: Change pure range expectations and add newline coverage**

In the first `transformTrackedRange` table, replace the `insert at end` row with these two rows:

```ts
[
  "insert text at end",
  5,
  9,
  [{ rangeOffset: 9, rangeLength: 0, text: "X" }],
  5,
  9,
  false,
],
[
  "insert newline at end",
  5,
  9,
  [{ rangeOffset: 9, rangeLength: 0, text: "\n" }],
  5,
  9,
  false,
],
```

In the second table, replace `tracks an insertion at document end` with:

```ts
[
  "leaves an insertion at document end outside",
  0,
  10,
  [{ rangeOffset: 10, rangeLength: 0, text: "X" }],
  0,
  10,
  false,
],
```

Do not change the existing `insert at start`, `edit inside`, or `expands a point for an insertion there` rows; they are regression coverage for behavior that must remain.

- [ ] **Step 2: Add a failing controller-level end-boundary test**

Add after `moves action ranges for edits strictly before without recomputing`:

```ts
test("keeps an insertion at a non-empty end boundary outside the result", async () => {
  const document = makeDocument("source.txt", "abcdefghij");
  const { editor } = makeEditor(document);
  const { editor: shown, editBuilder } = makeEditor(document);
  window.showTextDocument.mockResolvedValue(shown);
  const recipe = source("Recipe");
  const { controller, change, emit, lastState } = setup(10);
  controller.show(editor, "result", target(2, 5), recipe);
  const id = lastState().items[0].id;

  change(document, [{ rangeOffset: 5, rangeLength: 0, text: "\n" }]);
  await emit({ type: "open", id });

  expect(recipe.evaluate).not.toHaveBeenCalled();
  expect(shown.selection).toEqual(
    expect.objectContaining({
      anchor: document.positionAt(2),
      active: document.positionAt(5),
    }),
  );

  await emit({ type: "action", action: "replace", id });
  expect(editBuilder.replace).toHaveBeenCalledWith(
    expect.objectContaining({
      start: document.positionAt(2),
      end: document.positionAt(5),
    }),
    "result",
  );
});
```

- [ ] **Step 3: Update the whole-document controller test**

Rename `recomputes a whole-document result for every content edit` to `keeps document-end appends outside a whole-document result`. Keep both changes, then replace its final assertions with:

```ts
expect(recipe.evaluate).toHaveBeenCalledTimes(1);
expect(recipe.evaluate).toHaveBeenCalledWith("Yabcdefghij");
```

This proves the append at offset 10 did not schedule a run or join the tracked range, while the later insertion at offset 0 remained tracked.

- [ ] **Step 4: Run focused tests and verify RED**

Run: `npm test -- --runInBand test/commands/resultsController.test.ts`

Expected: FAIL in the new/updated end-boundary assertions because the current helper maps the end to include inserted text and reports `changed: true`.

- [ ] **Step 5: Implement aligned half-open insertion semantics**

In `transformTrackedRange`, add an empty-range flag after sorting:

```ts
const empty = start === end;
```

Replace the exact-boundary insertion branch in `mapBoundary` with:

```ts
if (change.rangeLength === 0 && changeStart === offset) {
  if (includeInsertion && empty) delta += change.text.length;
  continue;
}
```

Replace the insertion branch of the `changed` predicate with:

```ts
return change.rangeLength === 0
  ? empty
    ? change.rangeOffset === start
    : change.rangeOffset >= start && change.rangeOffset < end
  : change.rangeOffset < end && changeEnd > start;
```

No other transform or controller code changes are needed. For a non-empty insertion at `start`, mapping the end still sees that insertion before `end` and expands normally. For an empty range, both boundaries equal the insertion offset and only the end includes it.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run: `npm test -- --runInBand test/commands/resultsController.test.ts`

Expected: PASS with all controller tests green.

- [ ] **Step 7: Run complete verification**

Run: `npm run typecheck && npx eslint src/commands/resultsController.ts test/commands/resultsController.test.ts && npm test -- --runInBand`

Expected: typecheck exits 0, touched-file lint has no errors, and all test suites pass. Existing non-failing warnings may remain.

- [ ] **Step 8: Format, inspect, and commit**

Run: `npx prettier --write src/commands/resultsController.ts test/commands/resultsController.test.ts && git diff --check && git status --short`

Confirm `src/generated/opsRegistry.ts` remains unstaged and unchanged by this task.

```bash
git add src/commands/resultsController.ts test/commands/resultsController.test.ts
git commit -m "fix: keep result end insertions outside selection"
```

- [ ] **Step 9: Request code review**

Invoke `superpowers:requesting-code-review` against commit `338ba51` through the implementation commit. Resolve Critical or Important findings and rerun Step 7 before completion.
