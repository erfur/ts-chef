# Usage Guide

`vschef` is designed to be intuitive and non-intrusive. There are two primary ways to interact with it.

## 1. Quick Convert Selection

1.  Select any text or data blob in your editor.
2.  Right-click and select **vschef: Quick Convert Selection**.
3.  Choose from a list of automatically suggested transformations based on the data format.

## 2. Build A Recipe

For complex multi-step transformations:

1. Open the **vschef** activity-bar view.
2. Search for operations in **Operations** and add them to **Recipe**.
3. Configure arguments for each step.
4. Run the recipe against the current editor selection.
5. Save it globally or to the workspace when you want to reuse it.

## Pipeline result action

When you run a pipeline from a command (**vschef: Run Pipeline on Selection** or **vschef: Run Saved Pipeline**), vschef shows the result in a notification with **Replace** and **Copy** buttons by default. Set `vschef.pipelineResultAction` to change this default:

- `popup` (default) — ask each time with Replace/Copy buttons.
- `replace` — replace the selection (or the whole document if nothing is selected) with the result.
- `copy` — copy the result to the clipboard.
- `inline` — show the result in a CodeLens row above the selection, with Replace/Copy/Close actions (stays open until you close it).
- `panel` — show the full multi-line result in a webview panel beside the editor, with Replace/Copy/Close actions (stays open until you close it).
- `sidebar` — keep a live result in the Results view; results update when their tracked input changes and can be filtered by current/all tabs.

## Recipe registers

Use the **Register** operation to capture intermediate results into recipe-local registers such as `$R0` and `$R1`. Later operations in the same recipe can reference those registers in their arguments.
