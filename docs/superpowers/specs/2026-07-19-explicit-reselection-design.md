# Explicit Reselection Design

## Goal

Require an explicit user action to retarget a Results sidebar item or an
existing recipe parameter selection reference. Changing the editor selection
alone must never change either tracked range.

## Results Behavior

Each Results sidebar row gains a **Reselect** action alongside Popup, Copy,
Replace, and Delete. Clicking it uses the active editor's current selection as
the row's new input only when:

- The active editor shows that result's source document.
- The primary selection is non-empty.

When valid, the controller stores the selection's normalized start and end
offsets and schedules evaluation through the existing debounce and generation
guards. The result output or error then updates through the existing
recomputation path.

When invalid, the tracked range and output remain unchanged. The extension
shows a warning explaining that the user must make a non-empty selection in
the result's source document.

Clicking a result row continues to reveal and select its current tracked range
and load its recipe. It does not arm the result or cause later selection
changes to retarget it.

## Recipe Reference Behavior

An unbound string or toggle-string parameter continues to show **Use current
editor selection**. A bound parameter keeps all existing controls and gains
**Reselect current editor selection**:

- Clicking the bound field reveals the existing referenced range.
- **Clear** materializes the current referenced text and removes the binding.
- **Reselect** immediately replaces the binding with a reference to the active
  editor's current non-empty selection.

Recipe reselection has the same document semantics as initial reference
creation: it may reference any active text document. If there is no active
editor or its primary selection is empty, the existing binding remains
unchanged. Existing selection acquisition behavior remains responsible for
any user feedback.

The replacement reference continues to track text edits in its document and
to update the parameter value. Changing the editor selection without pressing
**Reselect** does not affect it.

## Architecture

### Results Controller

Remove `activeSelectionTarget` and the
`vscode.window.onDidChangeTextEditorSelection` subscription. Add `reselect` to
the result action protocol and handle it in `ResultsController` by reading
`vscode.window.activeTextEditor`, validating its document and selection, and
updating the selected result's offsets before calling the existing `schedule`
method.

No new selection-listener state or arming mode is introduced. Result removal,
document closing, disposal, row opening, document-edit range transformation,
and asynchronous race protection retain their existing behavior.

### Results View

Render **Reselect** as a normal row action and post the existing action message
shape with `action: "reselect"`. Reselection remains available when a result is
in an error state because a new input may recover it. Popup, Copy, and Replace
remain disabled for failed results; Delete and Reselect remain enabled.

### Recipe View

Reuse the existing `useSelection` message for initial selection and
reselection. The handler already obtains the current selection reference,
disposes any prior binding only after a valid replacement is available,
installs the new subscription, materializes its text, and publishes state.

Rendering adds the existing use-selection control beside bound parameters,
with a reselection-specific title and accessible label. The reveal and clear
interactions remain unchanged. No new recipe message type or reference tracker
API is needed.

## Error And Edge Handling

- Empty selections never replace a result range or recipe reference.
- A result cannot be reselected from a different document.
- A recipe reference may be reselected from any active text document.
- Failed result rows permit reselection so valid input can recover them.
- Multi-cursor editors use `TextEditor.selection`, the primary selection.
- Stale or unknown result IDs and recipe targets continue to be ignored.
- Selection changes caused by row navigation or reference reveal do not
  retarget anything.
- Document edits continue to transform tracked ranges and trigger the existing
  dynamic value or output updates.

## Testing

Controller tests will remove expectations for automatic retargeting and verify
that:

- Arbitrary editor selection changes do not affect a result.
- Reselecting from the source document updates the range and recomputes.
- Open and Replace use the explicitly reselected range.
- Empty and wrong-document selections preserve the prior range and warn.
- Reselection remains available for a result currently showing an error.

Results view tests will verify that **Reselect** renders, posts the expected
action, and remains enabled for failed rows.

Recipe view tests will verify that a bound parameter renders accessible Reveal,
Reselect, and Clear interactions; clicking Reselect posts `useSelection`; a
valid current selection replaces and disposes the previous binding; and an
invalid selection leaves the previous binding intact.

The focused controller, results view, recipe view, and selection reference
suites will run, followed by typecheck, lint, and the complete test suite.

## Non-Goals

- Arming a result or recipe parameter for the next editor selection.
- Retargeting from an empty selection or secondary cursor.
- Changing result row navigation or reference reveal behavior.
- Persisting results or live recipe references across extension restarts.
- Changing how document edits update already tracked ranges.
