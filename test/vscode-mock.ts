/**
 * Minimal `vscode` mock for unit tests. Only the surface used by
 * src/storage/store.ts is implemented. `workspace.workspaceFolders` is
 * settable so tests can simulate an open/closed folder.
 */
export const window = {
  showWarningMessage: jest.fn(),
};

export const workspace: {
  workspaceFolders: { uri: { fsPath: string } }[] | undefined;
} = {
  workspaceFolders: undefined,
};
