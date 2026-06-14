import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { PipelineStore, VariableStore, Pipeline } from "../../src/storage/store";
import * as vscode from "vscode";

// `vscode` is the mock from test/vscode-mock.ts (via moduleNameMapper).
const mockVscode = vscode as unknown as {
  workspace: { workspaceFolders?: { uri: { fsPath: string } }[] };
  window: { showWarningMessage: jest.Mock };
};

function mkTmp(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

const samplePipeline = (name: string): Pipeline => ({
  name,
  description: "d",
  raw: "From Base64",
  steps: [{ opName: "FromBase64", args: [] }],
});

describe("scope-aware stores", () => {
  let globalDir: string;
  let wsDir: string;

  beforeEach(() => {
    globalDir = mkTmp("tschef-global-");
    wsDir = mkTmp("tschef-ws-");
    mockVscode.workspace.workspaceFolders = [{ uri: { fsPath: wsDir } }];
    mockVscode.window.showWarningMessage.mockClear();
  });

  afterEach(() => {
    fs.rmSync(globalDir, { recursive: true, force: true });
    fs.rmSync(wsDir, { recursive: true, force: true });
  });

  test("global pipeline save persists and loads tagged global", () => {
    const store = new PipelineStore(globalDir);
    store.upsert("global", samplePipeline("g1"));
    expect(fs.existsSync(path.join(globalDir, "pipelines.json"))).toBe(true);
    const all = store.loadAll();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe("g1");
    expect(all[0].scope).toBe("global");
  });

  test("workspace pipeline save persists under workspace dir tagged workspace", () => {
    const store = new PipelineStore(globalDir);
    store.upsert("workspace", samplePipeline("w1"));
    expect(fs.existsSync(path.join(wsDir, ".ts-chef", "pipelines.json"))).toBe(true);
    const all = store.loadAll();
    expect(all).toHaveLength(1);
    expect(all[0].scope).toBe("workspace");
  });

  test("loadAll merges both scopes, workspace first", () => {
    const store = new PipelineStore(globalDir);
    store.upsert("global", samplePipeline("g1"));
    store.upsert("workspace", samplePipeline("w1"));
    const all = store.loadAll();
    expect(all.map((p) => [p.name, p.scope])).toEqual([
      ["w1", "workspace"],
      ["g1", "global"],
    ]);
  });

  test("same name in both scopes coexist (upsert isolates by scope)", () => {
    const store = new PipelineStore(globalDir);
    store.upsert("global", samplePipeline("X"));
    store.upsert("workspace", samplePipeline("X"));
    const all = store.loadAll();
    expect(all).toHaveLength(2);
    expect(all.map((p) => p.scope).sort()).toEqual(["global", "workspace"]);
  });

  test("delete only affects the target scope", () => {
    const store = new PipelineStore(globalDir);
    store.upsert("global", samplePipeline("X"));
    store.upsert("workspace", samplePipeline("X"));
    store.delete("workspace", "X");
    const all = store.loadAll();
    expect(all).toHaveLength(1);
    expect(all[0].scope).toBe("global");
  });

  test("variable get: workspace overrides global", () => {
    const store = new VariableStore(globalDir);
    store.set("global", "key", "G");
    store.set("workspace", "key", "W");
    expect(store.get("key")).toBe("W");
  });

  test("variable get falls back to global when no workspace value", () => {
    const store = new VariableStore(globalDir);
    store.set("global", "key", "G");
    expect(store.get("key")).toBe("G");
  });

  test("workspace save with no folder open warns and writes nothing", () => {
    mockVscode.workspace.workspaceFolders = undefined;
    const store = new PipelineStore(globalDir);
    store.upsert("workspace", samplePipeline("w1"));
    expect(mockVscode.window.showWarningMessage).toHaveBeenCalled();
    expect(store.loadAll()).toHaveLength(0);
  });

  test("global save with no folder open succeeds", () => {
    mockVscode.workspace.workspaceFolders = undefined;
    const store = new PipelineStore(globalDir);
    store.upsert("global", samplePipeline("g1"));
    expect(store.loadAll()).toHaveLength(1);
    expect(mockVscode.window.showWarningMessage).not.toHaveBeenCalled();
  });
});
