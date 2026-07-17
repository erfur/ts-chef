# No-Input Operation Execution Design

## Goal

Allow operations that do not require source data to run from the Operations view when the active editor has no selection. Generated results should use the existing result presentation setting and insert at the cursor when the user chooses to replace.

## Operation Input Semantics

Add an `inputMode` property to the `Operation` base class with these values:

- `"required"`: source data must be selected before direct execution.
- `"optional"`: selected source data is used when present, but an empty string is valid.
- `"none"`: the operation does not depend on source data.

The property defaults to `"required"`, preserving current behavior for every operation that has not been explicitly audited. This avoids inferring behavior from display names: some `Generate ...` operations consume input, including Generate QR Code, Generate Image, and Generate all hashes/checksums.

The initial annotations are:

- `"none"`: Generate Lorem Ipsum, Generate De Bruijn Sequence, Generate PGP Key Pair, Generate RSA Key Pair, Generate ECDSA Key Pair, Pseudo-Random Number Generator, Pseudo-Random Integer Generator, Get Time, and XKCD Random Number.
- `"optional"`: Generate UUID, Generate HOTP, Generate TOTP, and Numberwang.

Additional operations can opt in after their empty-input behavior is verified.

## Direct Execution Flow

`tschef.applyOperation` resolves the operation before checking the selection. It applies these rules:

1. If there is no active editor, retain the existing warning.
2. If the selection is empty and `inputMode` is `"required"`, retain the existing `Select text first` warning and stop.
3. If the selection is empty and `inputMode` is `"optional"` or `"none"`, execute the operation with an empty string.
4. If text is selected, execute normally for every input mode and use the selection as the result replacement target.

Argument prompting remains unchanged. A cancelled prompt stops execution without editing the document.

Direct operation execution must await the value returned by `runOp` before converting it to display text. This supports asynchronous generators such as key-pair operations while preserving synchronous operation behavior.

## Result Targeting

The command captures a replacement target when execution starts:

- A non-empty selection targets that selection.
- An empty selection targets a zero-length range at the cursor.

The explicit target is passed through all result modes: direct replacement, popup replacement, inline CodeLens, and the result panel. Inline and panel controllers store the supplied target with the result, as they already do with targets derived from the editor selection.

Pipeline and recipe execution do not supply an explicit target. Their existing behavior remains unchanged: an empty selection targets the whole document.

## Errors And Empty Results

Operation errors continue to be logged and shown through the existing error message. Input-free and optional-input operations use the same argument prompts and cancellation behavior as required-input operations.

The existing empty-result protection remains in place. A generated empty result does not replace a non-empty selection. With an empty source selection, an empty result produces no document change.

## Testing

Tests will verify:

- `Operation.inputMode` defaults to `"required"`.
- Representative input-free and optional-input operations carry the intended annotations.
- A required-input operation with no selection is rejected.
- Optional and input-free operations execute with an empty string when no text is selected.
- Direct execution awaits asynchronous operation results.
- Popup, direct-replace, inline, and panel replacement use a supplied cursor target.
- Existing selection replacement and empty-selection pipeline replacement remain unchanged.

## Non-Goals

- Inferring input requirements from operation names or argument definitions.
- Changing Quick Convert, pipeline input selection, recipe execution, or pipeline result defaults.
- Making operations executable without an active editor.
