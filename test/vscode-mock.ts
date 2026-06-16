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
  activeTextEditor: undefined as unknown,
  createWebviewPanel: jest.fn(),
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
  onDidChangeTextDocument: jest.Mock;
} = {
  workspaceFolders: undefined,
  getConfiguration: () => ({
    get: <T>(key: string, defaultValue: T): T =>
      key in configValues ? (configValues[key] as T) : defaultValue,
  }),
  onDidChangeTextDocument: jest.fn(() => ({ dispose: jest.fn() })),
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

export const languages = {
  registerCodeLensProvider: jest.fn(() => ({ dispose: jest.fn() })),
};

export const commands = {
  registerCommand: jest.fn<
    { dispose: () => void },
    [string, (...args: any[]) => any]
  >(() => ({ dispose: jest.fn() })),
  executeCommand: jest.fn(),
};

export class EventEmitter<T> {
  private listeners: ((e: T) => void)[] = [];
  event = (listener: (e: T) => void) => {
    this.listeners.push(listener);
    return { dispose: () => {} };
  };
  fire(data?: T): void {
    for (const l of this.listeners) l(data as T);
  }
  dispose(): void {
    this.listeners = [];
  }
}

export class Range {
  readonly start: { line: number; character: number };
  readonly end: { line: number; character: number };
  constructor(
    startLine: number,
    startCharacter: number,
    endLine: number,
    endCharacter: number,
  ) {
    this.start = { line: startLine, character: startCharacter };
    this.end = { line: endLine, character: endCharacter };
  }
}

export class CodeLens {
  constructor(
    public readonly range: unknown,
    public readonly command?: unknown,
  ) {}
}

export const ViewColumn = {
  Active: -1,
  Beside: -2,
};
