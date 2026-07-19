# Restore Selection End Modifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore dynamic tracked-result updates for text inserted at a selection's end while excluding the newline and all text after it.

**Architecture:** Keep all boundary semantics in the pure `transformTrackedRange` helper. For an insertion at a non-empty range's end, map and report only the prefix before the first CR or LF; `ResultsController` will continue consuming the helper's range and `changed` result without modification.

**Tech Stack:** TypeScript, VS Code extension APIs, Jest, ESLint

## Global Constraints

- Include only the prefix before the first `\r` or `\n` for an insertion exactly at a non-empty tracked range's end.
- Preserve the complete existing behavior for insertions at the start, strictly inside, and at empty tracked ranges.
- Keep range movement and `changed` detection aligned so recomputation, Open, and Replace use the same input.
- Do not modify `src/generated/opsRegistry.ts`; it contains a pre-existing unrelated worktree change.

---

## File Structure

- Modify `src/commands/trackedRange.ts`: define the end-insertion prefix rule inside the existing pure range transform.
- Modify `test/commands/resultsController.test.ts`: cover pure transform semantics and observable controller recomputation/action ranges.

### Task 1: Restore End-Boundary Text Tracking

**Files:**
- Modify: `src/commands/trackedRange.ts:7-44`
- Test: `test/commands/resultsController.test.ts:202-312`
- Test: `test/commands/resultsController.test.ts:1019-1048`
- Test: `test/commands/resultsController.test.ts:1150-1165`

**Interfaces:**
- Consumes: `transformTrackedRange(start: number, end: number, changes: readonly OffsetChange[])`
- Produces: the existing `{ start: number; end: number; changed: boolean }` result with newline-aware end-boundary insertion semantics

- [ ] **Step 1: Write failing pure transform tests**

In the first `test.each` table in `test/commands/resultsController.test.ts`, change the existing `insert text at end` expected values and add newline variants immediately after it:

```typescript
    [
      "insert text at end",
      5,
      9,
      [{ rangeOffset: 9, rangeLength: 0, text: "X" }],
      5,
      10,
      true,
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
    [
      "insert carriage return at end",
      5,
      9,
      [{ rangeOffset: 9, rangeLength: 0, text: "\r" }],
      5,
      9,
      false,
    ],
    [
      "insert CRLF at end",
      5,
      9,
      [{ rangeOffset: 9, rangeLength: 0, text: "\r\n" }],
      5,
      9,
      false,
    ],
    [
      "insert text followed by newline at end",
      5,
      9,
      [{ rangeOffset: 9, rangeLength: 0, text: "abc\nxyz" }],
      5,
      12,
      true,
    ],
    [
      "insert newline followed by text at end",
      5,
      9,
      [{ rangeOffset: 9, rangeLength: 0, text: "\nxyz" }],
      5,
      9,
      false,
    ],
```

In the second transform table, replace the document-end row with:

```typescript
    [
      "tracks text inserted at document end",
      0,
      10,
      [{ rangeOffset: 10, rangeLength: 0, text: "X" }],
      0,
      11,
      true,
    ],
```

- [ ] **Step 2: Write failing controller regression tests**

Insert this test immediately before the existing newline end-boundary controller test:

```typescript
  test.each([
    ["text", "X", "cdeX", 6],
    ["text before a newline", "XY\nZ", "cdeXY", 7],
  ])(
    "tracks %s inserted at a non-empty end boundary",
    async (_name, inserted, expectedInput, expectedEnd) => {
      jest.useFakeTimers();
      const document = makeDocument("source.txt", "abcdefghij");
      const { editor } = makeEditor(document);
      const { editor: shown, editBuilder } = makeEditor(document);
      window.showTextDocument.mockResolvedValue(shown);
      const recipe = source("Recipe");
      const { controller, change, emit, lastState } = setup(10);
      controller.show(editor, "result", target(2, 5), recipe);
      const id = lastState().items[0].id;

      change(document, [
        { rangeOffset: 5, rangeLength: 0, text: inserted },
      ]);
      await jest.advanceTimersByTimeAsync(10);

      expect(recipe.evaluate).toHaveBeenCalledWith(expectedInput);
      await emit({ type: "open", id });
      expect(shown.selection).toEqual(
        expect.objectContaining({
          anchor: document.positionAt(2),
          active: document.positionAt(expectedEnd),
        }),
      );

      await emit({ type: "action", action: "replace", id });
      expect(editBuilder.replace).toHaveBeenCalledWith(
        expect.objectContaining({
          start: document.positionAt(2),
          end: document.positionAt(expectedEnd),
        }),
        expectedInput,
      );
    },
  );
```

Keep the existing `keeps an insertion at a non-empty end boundary outside the result` test unchanged; it is the pure-newline regression guard.

Replace `keeps document-end appends outside a whole-document result` with:

```typescript
  test("tracks text but not newlines appended to a whole-document result", async () => {
    jest.useFakeTimers();
    const document = makeDocument("source.txt", "abcdefghij");
    const { editor } = makeEditor(document, 0, 10);
    const recipe = source("Recipe");
    const { controller, change } = setup(10);
    controller.show(editor, "initial", target(0, 10), recipe);

    change(document, [{ rangeOffset: 10, rangeLength: 0, text: "X" }]);
    await jest.advanceTimersByTimeAsync(10);
    change(document, [{ rangeOffset: 11, rangeLength: 0, text: "\n" }]);
    await jest.advanceTimersByTimeAsync(10);
    change(document, [{ rangeOffset: 0, rangeLength: 0, text: "Y" }]);
    await jest.advanceTimersByTimeAsync(10);

    expect(recipe.evaluate).toHaveBeenCalledTimes(2);
    expect(recipe.evaluate).toHaveBeenNthCalledWith(1, "abcdefghijX");
    expect(recipe.evaluate).toHaveBeenNthCalledWith(2, "YabcdefghijX");
  });
```

- [ ] **Step 3: Run the focused suite and verify RED**

Run:

```bash
npm test -- --runInBand test/commands/resultsController.test.ts
```

Expected: FAIL because `transformTrackedRange` returns end `9` and `changed: false` for ordinary end-boundary text, the controller does not evaluate it, and the whole-document append is ignored. Confirm the existing pure-newline test still passes.

- [ ] **Step 4: Implement the minimal newline-aware boundary transform**

Replace the body of `transformTrackedRange` in `src/commands/trackedRange.ts` with:

```typescript
  const sorted = [...changes].sort((a, b) => a.rangeOffset - b.rangeOffset);
  const empty = start === end;
  const prefixLength = (text: string): number => {
    const newline = text.search(/[\r\n]/);
    return newline === -1 ? text.length : newline;
  };
  const mapBoundary = (offset: number, includeInsertion: boolean): number => {
    let delta = 0;
    for (const change of sorted) {
      const changeStart = change.rangeOffset;
      const changeEnd = changeStart + change.rangeLength;
      if (change.rangeLength === 0 && changeStart === offset) {
        if (includeInsertion)
          delta += empty ? change.text.length : prefixLength(change.text);
        continue;
      }
      if (changeEnd <= offset) {
        delta += change.text.length - change.rangeLength;
        continue;
      }
      if (changeStart >= offset) break;
      return changeStart + delta + (includeInsertion ? change.text.length : 0);
    }
    return offset + delta;
  };
  const changed = sorted.some((change) => {
    const changeEnd = change.rangeOffset + change.rangeLength;
    if (change.rangeLength !== 0)
      return change.rangeOffset < end && changeEnd > start;
    if (empty) return change.rangeOffset === start;
    if (change.rangeOffset >= start && change.rangeOffset < end) return true;
    return change.rangeOffset === end && prefixLength(change.text) > 0;
  });
  return {
    start: mapBoundary(start, false),
    end: mapBoundary(end, true),
    changed,
  };
```

Do not change `ResultsController`; its existing event handler already updates offsets and schedules evaluation from this return value.

- [ ] **Step 5: Run the focused suite and verify GREEN**

Run:

```bash
npm test -- --runInBand test/commands/resultsController.test.ts
```

Expected: PASS with all `resultsController` tests green and no warnings.

- [ ] **Step 6: Run static verification**

Run:

```bash
npm run typecheck
npx eslint src/commands/trackedRange.ts test/commands/resultsController.test.ts
git diff --check
```

Expected: all commands exit `0` with no TypeScript, ESLint, or whitespace errors.

- [ ] **Step 7: Run the complete test suite**

Run:

```bash
npm test -- --runInBand
```

Expected: all test suites and tests pass with no unexpected warnings.

- [ ] **Step 8: Review and commit the implementation**

Review only the intended files:

```bash
git status --short
git diff -- src/commands/trackedRange.ts test/commands/resultsController.test.ts
```

Confirm `src/generated/opsRegistry.ts` remains unstaged, then commit:

```bash
git add src/commands/trackedRange.ts test/commands/resultsController.test.ts
git commit -m "fix: restore selection end modifications"
```
