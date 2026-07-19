# Restore Selection End Modifications Design

## Goal

Restore dynamic updates to Results ranges and recipe parameter selection
references when text is inserted exactly at the end of a tracked non-empty
selection, while keeping newline insertions outside the tracked input.

## Root Cause

Commit `3cd09ff` changed all insertions at a non-empty tracked range's end from
inclusive to exclusive. That prevented a newline at the end from moving the
selection onto a new line, but it also disabled the previous behavior for
ordinary text modifications.

The range transform currently ignores every zero-length change whose offset is
equal to the end of a non-empty range. It therefore neither advances the end
offset nor reports a Results or selection-reference change for ordinary text
typed there.

## Boundary Semantics

For an insertion exactly at the end of a non-empty tracked range:

- Include ordinary text in the tracked input, advance the end offset, and mark
  the range as changed.
- Exclude a pure newline insertion, leaving the range and consumer unchanged.
- For mixed inserted text, include only the prefix before the first `\r` or
  `\n`. For example, inserting `abc\nxyz` advances the end through `abc` and
  excludes the newline and `xyz`.
- If the inserted text starts with `\r` or `\n`, include nothing and leave the
  result unchanged.

Existing behavior remains unchanged for insertions at the start, insertions
strictly inside the range, replacements, deletions, edits before or after the
range, and insertions at an empty tracked range.

Whole-document tracked inputs use the same rule at the document end. An
ordinary append updates the result, while a newline or the newline-delimited
suffix of a mixed append remains outside the original tracked input.

## Implementation

Change only the pure `transformTrackedRange` helper in
`src/commands/trackedRange.ts` and add coverage for both consumers.

When a zero-length change occurs exactly at a non-empty range's end, derive the
length of the inserted prefix before the first CR or LF. Use that prefix length
consistently for both end-boundary mapping and the `changed` result:

- A positive prefix length advances the end and reports `changed: true`.
- A zero prefix length leaves the end unchanged and reports `changed: false`.

Keeping boundary movement and change detection aligned ensures the evaluator,
Open action, Replace action, and tracked recipe parameter references all use
the same dynamically updated input. Changes at all other offsets continue
through the existing transform logic.

## Error And Edge Handling

- Treat both LF and CR as newline boundaries, which also handles CRLF by
  stopping at its first character.
- Do not split or rewrite document changes; only determine how much of an
  end-boundary insertion belongs to the tracked range.
- Preserve current sorting and multi-change behavior.
- Preserve clamping to the current document length in `ResultsController`.

## Testing

Pure transform tests will verify:

- Ordinary text inserted at a non-empty end boundary expands the range and
  reports a change.
- LF, CR, and CRLF inserted at the end leave the range unchanged.
- Mixed text and newline insertion includes only the text prefix.
- Text beginning with a newline is excluded completely.
- Existing start, interior, empty-range, replacement, deletion, and movement
  behavior remains intact.

Controller tests will verify:

- Ordinary text inserted at the end triggers recomputation with the expanded
  tracked text.
- A pure newline at the end does not trigger recomputation.
- Mixed text and newline recomputes using only the included prefix.
- Open and Replace use the expanded range after an ordinary text insertion.
- Whole-document text appends update dynamically while newline suffixes remain
  outside the tracked range.

Selection-reference tests will verify:

- Ordinary text inserted at the end expands `reference.text` and emits once.
- Mixed text and newline includes only the prefix before the first newline and
  emits once.
- A pure newline remains outside `reference.text` and does not emit.

Run the focused controller and selection-reference tests, typecheck,
touched-file lint, and complete test suite.

## Non-Goals

- Changing selection retargeting through editor selection events.
- Including text after the first newline in an end-boundary insertion.
- Changing result view rendering, filtering, actions, or persistence.
