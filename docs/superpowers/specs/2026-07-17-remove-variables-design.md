# Remove Saved Variables Design

## Goal

Remove the extension-level saved variables feature, including its sidebar, commands, persistence model, and input substitution. Preserve the separate CyberChef-compatible `Register` operation and its `$R0`, `$R1`, and subsequent recipe-register behavior.

Existing saved-variable files must be deleted automatically when the updated extension activates.

## Runtime And UI

Remove all saved-variable entry points and supporting code:

- Remove the `tschef.variablesView` sidebar contribution and its title action.
- Remove the `tschef.setVariable`, `tschef.showVariables`, and `tschef.addVariable` command contributions and handlers.
- Delete `VariablesTreeProvider` and stop registering it during activation.
- Remove `Variable`, `ScopedVariable`, and `VariableStore` from the storage layer.
- Remove `$name` and `{{name}}` input preprocessing. Recipe application, individual operation application, Quick Convert, ad hoc pipeline execution, and saved-pipeline execution will pass editor input directly to the operation engine.

The pipeline persistence model remains scope-aware. `StorageScope`, `PipelineStore`, and saved-pipeline behavior are not changed.

The operation-engine `Register` operation remains available. Its recipe-local `$R0` register handling is independent of saved variables and will not change.

## Legacy Data Cleanup

Add a narrowly scoped cleanup function called during extension activation. It will inspect the two locations previously used by `VariableStore`:

- `<globalStorageUri>/variables.json`
- The active workspace's legacy ts-chef storage directory: `.vscode/ts-chef/variables.json` when `.vscode` already exists, otherwise `.ts-chef/variables.json`

For each location, delete only `variables.json`. Do not delete its parent directory or any unrelated files. A missing file is a successful no-op. A deletion failure is logged and does not prevent extension activation.

The cleanup runs on every activation rather than recording migration state. This keeps the migration stateless and also removes a legacy file recreated by an older extension version. As with the old storage implementation, only the first folder of the active workspace is relevant; unopened workspaces cannot be modified.

## Tests

- Remove tests that exercise `VariableStore` behavior while retaining all `PipelineStore` coverage.
- Add legacy-cleanup tests for global storage and workspace storage.
- Verify cleanup tolerates missing files and preserves unrelated files and parent directories.
- Extend package-contribution tests to assert that the three variable commands and the Variables view are absent.
- Existing operation tests continue to cover operation-engine behavior; the `Register` operation remains in the generated registry and operation exports.

Verification will run formatting, type checking, focused affected tests, and the complete test suite.

## Documentation

Remove current saved-variable claims from `README.md`. Keep the `docs/usage.md` Variables section because it describes the separate `Register` operation and recipe-local registers; retitle it if needed to make that distinction explicit.

Historical design specifications and implementation plans remain unchanged because they record prior project decisions rather than define current behavior.

## Non-Goals

- Removing or changing the `Register` operation.
- Changing `$R0` recipe-register substitution.
- Migrating saved variables into another feature.
- Deleting parent storage directories or files other than `variables.json`.
- Searching for and deleting variable files in workspaces that are not currently open.
