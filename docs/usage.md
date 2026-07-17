# Usage Guide

`ts-chef` is designed to be intuitive and non-intrusive. There are two primary ways to interact with it.

## 1. Quick Convert Selection

1.  Select any text or data blob in your editor.
2.  Right-click and select **ts-chef: Quick Convert Selection**.
3.  Choose from a list of automatically suggested transformations based on the data format.

## 2. Pipeline Editor (Recipes)

For complex multi-step transformations:

1.  Open the command palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).
2.  Type **ts-chef: Open Pipeline Editor**.
3.  Search for and add operations to your pipeline.
4.  Configure arguments for each step.
5.  Click **Bake** to see the final output and optionally replace your selection.

## Pipeline result action

When you run a pipeline from a command (**ts-chef: Run Pipeline on Selection** or **ts-chef: Run Saved Pipeline**), ts-chef shows the result in a notification with **Replace** and **Copy** buttons by default. Set `tschef.pipelineResultAction` to change this default:

- `popup` (default) — ask each time with Replace/Copy buttons.
- `replace` — replace the selection (or the whole document if nothing is selected) with the result.
- `copy` — copy the result to the clipboard.
- `inline` — show the result in a CodeLens row above the selection, with Replace/Copy/Close actions (stays open until you close it).
- `panel` — show the full multi-line result in a webview panel beside the editor, with Replace/Copy/Close actions (stays open until you close it).

## Recipe registers

Use the **Register** operation to capture intermediate results into recipe-local registers such as `$R0` and `$R1`. Later operations in the same recipe can reference those registers in their arguments.
