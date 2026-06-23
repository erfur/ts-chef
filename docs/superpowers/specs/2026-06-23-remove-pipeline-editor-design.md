# Remove Pipeline Editor Design

## Scope

Remove only the standalone Pipeline Editor webview feature. Keep recipe-based pipeline creation, saved pipeline storage, the Pipelines sidebar, saved pipeline execution, direct text pipeline execution, and result presentation behavior.

## Current Feature Boundary

The standalone editor is exposed through the `tschef.openPipelineEditor` command in `package.json` and registered in `src/extension.ts`. Its implementation lives in `src/panels/pipelinePanel.ts`. The rest of the pipeline system is shared by the Recipe view, saved pipeline tree, and command-based execution.

## Approach

Delete `src/panels/pipelinePanel.ts` and remove all references to `PipelinePanel`. Remove the `tschef.openPipelineEditor` contributed command from `package.json` and remove its command registration from `src/extension.ts`.

No compatibility command or deprecation shim will be added. The feature is intentionally removed, and the Recipe view remains the supported UI for building and saving pipelines.

## Preserved Behavior

The following must continue to work:

- `tschef.runPipeline`
- `tschef.runSavedPipeline`
- `tschef.runSavedPipelinePicker`
- `tschef.loadRecipe`
- Recipe view apply/save workflows
- Pipelines sidebar display and refresh
- `tschef.pipelineResultAction` behavior
- `tschef.defaultPipelineScope` behavior

## Testing

Run the existing test suite and typecheck after implementation. Update tests only where they refer to the removed editor command or messages that mention the Pipeline Editor as the way to create saved pipelines.

## Out Of Scope

Do not remove pipeline storage, pipeline parsing/execution, saved pipeline commands, result presentation, or recipe functionality.
