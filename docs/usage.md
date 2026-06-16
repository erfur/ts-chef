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

## Variables

You can use the **Register** operation to save intermediate results into variables (e.g., `$R0`, `$R1`). These can then be passed as arguments into subsequent operations in the same pipeline.
