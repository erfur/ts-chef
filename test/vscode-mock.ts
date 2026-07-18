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
  showTextDocument: jest.fn(),
  onDidChangeActiveTextEditor: jest.fn<
    { dispose: () => void },
    [listener: (editor: unknown) => void]
  >(() => ({ dispose: jest.fn() })),
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
  onDidCloseTextDocument: jest.Mock;
} = {
  workspaceFolders: undefined,
  getConfiguration: () => ({
    get: <T>(key: string, defaultValue: T): T =>
      key in configValues ? (configValues[key] as T) : defaultValue,
  }),
  onDidChangeTextDocument: jest.fn(() => ({ dispose: jest.fn() })),
  onDidCloseTextDocument: jest.fn<
    { dispose: () => void },
    [listener: (document: unknown) => void]
  >(() => ({ dispose: jest.fn() })),
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
    start: { line: number; character: number },
    end: { line: number; character: number },
  );
  constructor(
    startLine: number,
    startCharacter: number,
    endLine: number,
    endCharacter: number,
  );
  constructor(
    startOrLine: number | { line: number; character: number },
    endOrCharacter: number | { line: number; character: number },
    endLine?: number,
    endCharacter?: number,
  ) {
    if (typeof startOrLine === "number") {
      this.start = { line: startOrLine, character: endOrCharacter as number };
      this.end = { line: endLine as number, character: endCharacter as number };
    } else {
      this.start = startOrLine;
      this.end = endOrCharacter as { line: number; character: number };
    }
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

export const TreeItemCollapsibleState = {
  None: 0,
  Collapsed: 1,
  Expanded: 2,
};

export class TreeItem {
  label: string;
  collapsibleState: number | undefined;
  description?: string | boolean;
  tooltip?: string;
  iconPath?: unknown;
  command?: unknown;
  contextValue?: string;
  constructor(label: string, collapsibleState?: number) {
    this.label = label;
    this.collapsibleState = collapsibleState;
  }
}

export class ThemeIcon {
  constructor(public readonly id: string) {}
}
