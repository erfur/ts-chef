# Results Selection End Boundary Design

## Goal

Prevent a tracked non-empty result selection from expanding or recomputing
when text is inserted exactly at its end. This includes pressing Enter at the
end of the selection and typing ordinary text there.

## Root Cause

`transformTrackedRange` currently treats both boundaries as inclusive for
insertions. Its membership check uses `start <= offset <= end`, and its end
boundary mapper advances when an insertion occurs exactly at `end`. Existing
tests explicitly require this behavior.

As a result, inserting a newline at the end of a selected input adds that
newline to the tracked input, moves the selection onto the new line, and
recomputes the result.

## Range Semantics

Use standard half-open semantics for non-empty tracked ranges: `[start, end)`.

- An insertion at `start` belongs to the tracked input, expands its end, and
  triggers recomputation.
- An insertion strictly between `start` and `end` belongs to the tracked input,
  expands its end, and triggers recomputation.
- An insertion exactly at `end` is outside the tracked input. It does not move
  either boundary and does not trigger recomputation.
- Replacements and deletions keep their existing overlap behavior.
- Edits strictly before or after the range keep their existing movement and
  recomputation behavior.

Zero-length tracked ranges retain their existing special case. An insertion at
the tracked cursor belongs to that result, expands the point into a non-empty
range, and triggers recomputation. This supports optional-input and no-input
results that begin at the cursor.

Whole-document inputs follow the same non-empty half-open rule. Appending text
at the document end is outside the original tracked input and does not
recompute the result. Edits before the end remain tracked.

## Implementation

Change only the pure `transformTrackedRange` helper in
`src/commands/resultsController.ts` and its tests.

The insertion membership predicate distinguishes empty from non-empty ranges:

- Empty: `offset === start`.
- Non-empty: `offset >= start && offset < end`.

The end-boundary mapping uses the same distinction. It includes an insertion
at the end only when the original tracked range is empty; for a non-empty
range, an insertion at `end` contributes no delta to the mapped end.

Keeping membership and mapping aligned prevents a result from suppressing
recomputation while still silently changing its replacement range.

## Testing

Update `test/commands/resultsController.test.ts` to verify:

- Insertion at a non-empty range start still expands and marks the input
  changed.
- Insertion strictly inside still expands and marks the input changed.
- Ordinary text inserted at a non-empty range end leaves the range unchanged
  and reports `changed: false`.
- A newline inserted at a non-empty range end has the same behavior.
- Appending at the end of a whole-document range leaves it unchanged and does
  not recompute.
- Insertion at a zero-length tracked range still expands and recomputes.
- At controller level, an end-boundary insertion does not call the evaluator
  and subsequent Open or Replace uses the original range.

Run the focused controller tests, typecheck, touched-file lint, and the complete
test suite.

## Non-Goals

- Changing insertions at the start or inside a tracked range.
- Changing replacement/deletion overlap semantics.
- Following the user's current editor selection after result creation.
- Changing result view rendering, filtering, actions, or persistence.
