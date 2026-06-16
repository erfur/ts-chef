/**
 * Minimal `vscode` mock for unit tests. Implements the surface used by
 * src/storage/store.ts and src/commands/pipelineResult.ts.
 *
 * `workspace.workspaceFolders` is settable so tests can simulate an
 * open/closed folder. Values returned by
 * `workspace.getConfiguration(...).get(key, default)` are settable via
 * `__setConfig`.
 */
export const window = {
  showWarningMessage: jest.fn(),
  showErrorMessage: jest.fn(),
  showInformationMessage: jest.fn(),
  setStatusBarMessage: jest.fn(),
};

let configValues: Record<string, unknown> = {};

/** Test helper: set the values returned by getConfiguration(...).get(). */
export function __setConfig(values: Record<string, unknown>): void {
  configValues = values;
}

export const workspace: {
  workspaceFolders: { uri: { fsPath: string } }[] | undefined;
  getConfiguration: (section?: string) => {
    get: <T>(key: string, defaultValue: T) => T;
  };
} = {
  workspaceFolders: undefined,
  getConfiguration: () => ({
    get: <T>(key: string, defaultValue: T): T =>
      key in configValues ? (configValues[key] as T) : defaultValue,
  }),
};

export const env = {
  clipboard: {
    writeText: jest.fn(),
  },
};

export class Position {
  constructor(
    public readonly line: number,
    public readonly character: number,
  ) {}
}

export class Selection {
  constructor(
    public readonly anchor: unknown,
    public readonly active: unknown,
  ) {}
}
