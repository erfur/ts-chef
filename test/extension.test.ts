import type { ExtensionContext, TextEditor } from "vscode";
import { activate } from "../src/extension";
import type { PipelineResultSource } from "../src/commands/pipelineResult";
import { createPipelineResultSource } from "../src/commands/resultSource";
import { RecipeViewProvider } from "../src/providers/recipeViewProvider";
import { __setConfig, window } from "./vscode-mock";

jest.mock("../src/generated/opsRegistry", () => ({
  __esModule: true,
  default: [],
}));
jest.mock("../src/logger", () => ({
  initOutputChannel: jest.fn(),
  log: jest.fn(),
}));
jest.mock("../src/storage/store", () => ({
  PipelineStore: jest.fn().mockImplementation(() => ({
    loadAll: jest.fn(() => []),
    upsert: jest.fn(),
  })),
  StorageScope: {},
  removeLegacyVariableFiles: jest.fn(),
}));
jest.mock("../src/providers/pipelinesTreeProvider", () => ({
  PipelinesTreeProvider: jest.fn().mockImplementation(() => ({
    refresh: jest.fn(),
  })),
}));
jest.mock("../src/providers/operationsViewProvider", () => ({
  OperationsViewProvider: jest.fn().mockImplementation(() => ({})),
}));
jest.mock("../src/providers/recipeViewProvider", () => ({
  RecipeViewProvider: jest.fn().mockImplementation(() => ({
    addOp: jest.fn(),
    dispose: jest.fn(),
    load: jest.fn(),
  })),
}));
jest.mock("../src/providers/resultsViewProvider", () => ({
  ResultsViewProvider: jest.fn().mockImplementation(() => ({})),
}));
jest.mock("../src/commands/inlineResult", () => ({
  InlineResultController: jest.fn().mockImplementation(() => ({
    register: jest.fn(),
    show: jest.fn(),
  })),
}));
jest.mock("../src/commands/webviewResult", () => ({
  WebviewResultController: jest.fn().mockImplementation(() => ({
    register: jest.fn(),
    show: jest.fn(),
  })),
}));
const showResult = jest.fn();
jest.mock("../src/commands/resultsController", () => ({
  ResultsController: jest.fn().mockImplementation(() => ({
    register: jest.fn(),
    show: showResult,
  })),
}));
jest.mock("../src/commands/selectionReference", () => ({
  SelectionReferenceTracker: jest.fn().mockImplementation(() => ({
    create: jest.fn(),
    dispose: jest.fn(),
  })),
}));
jest.mock("../src/commands/resultSource", () => ({
  createPipelineResultSource: jest.fn(),
}));

const createSourceMock = createPipelineResultSource as jest.MockedFunction<
  typeof createPipelineResultSource
>;
const RecipeViewProviderMock = RecipeViewProvider as jest.MockedClass<
  typeof RecipeViewProvider
>;

function source(evaluate: PipelineResultSource["evaluate"]): PipelineResultSource {
  return {
    recipe: { name: "recipe", steps: [] },
    evaluate,
    dispose: jest.fn(),
  };
}

function setup(resultSource: PipelineResultSource) {
  createSourceMock.mockReturnValue(resultSource);
  const editor = {
    document: { getText: jest.fn(() => "input") },
    selection: { isEmpty: false },
  } as unknown as TextEditor;
  (window as { activeTextEditor: unknown }).activeTextEditor = editor;
  Object.assign(window, {
    registerWebviewViewProvider: jest.fn(() => ({ dispose: jest.fn() })),
    registerTreeDataProvider: jest.fn(() => ({ dispose: jest.fn() })),
  });
  const context = {
    globalStorageUri: { fsPath: "/tmp/ts-chef-test" },
    subscriptions: [],
  } as unknown as ExtensionContext;

  activate(context);

  return RecipeViewProviderMock.mock.calls[0][1].onApply;
}

beforeEach(() => {
  jest.clearAllMocks();
  showResult.mockReset();
  __setConfig({ pipelineResultAction: "sidebar" });
});

describe("recipe apply result-source ownership", () => {
  test("disposes once when evaluation fails before presentation", async () => {
    const error = new Error("evaluation failed");
    const resultSource = source(jest.fn().mockRejectedValue(error));
    const onApply = setup(resultSource);

    await onApply("recipe", [], []);

    expect(showResult).not.toHaveBeenCalled();
    expect(resultSource.dispose).toHaveBeenCalledTimes(1);
  });

  test("does not dispose again when presentation rejects", async () => {
    const error = new Error("presentation failed");
    const resultSource = source(jest.fn().mockResolvedValue("RESULT"));
    showResult.mockImplementation(() => {
      throw error;
    });
    const onApply = setup(resultSource);

    await onApply("recipe", [], []);

    expect(showResult).toHaveBeenCalled();
    expect(resultSource.dispose).toHaveBeenCalledTimes(1);
  });
});
