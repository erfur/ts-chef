import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

export type StorageScope = "workspace" | "global";

/** Resolve the per-workspace storage directory, or undefined if no folder is open. */
function workspaceStoreDir(): string | undefined {
  const ws = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!ws) return undefined;
  const vscodePath = path.join(ws, ".vscode");
  if (fs.existsSync(vscodePath)) return path.join(vscodePath, "ts-chef");
  return path.join(ws, ".ts-chef");
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJSON<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

function writeJSON(file: string, data: unknown): void {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");
}

export function removeLegacyVariableFiles(
  globalDir: string,
  reportError: (message: string) => void,
): void {
  const dirs = [globalDir, workspaceStoreDir()];
  for (const dir of dirs) {
    if (!dir) continue;
    const file = path.join(dir, "variables.json");
    try {
      fs.rmSync(file, { force: true });
    } catch (error) {
      reportError(`Failed to remove ${file}: ${error}`);
    }
  }
}

// ---- Pipelines ----

export interface PipelineStep {
  opName: string;
  args: unknown[];
}

export interface Pipeline {
  name: string;
  description?: string;
  steps: PipelineStep[];
  raw: string; // original pipe syntax
}

export interface ScopedPipeline extends Pipeline {
  scope: StorageScope;
}

export class PipelineStore {
  constructor(private globalDir: string) {}

  private dir(scope: StorageScope): string | undefined {
    return scope === "global" ? this.globalDir : workspaceStoreDir();
  }

  load(scope: StorageScope): Pipeline[] {
    const dir = this.dir(scope);
    if (!dir) return [];
    return readJSON<Pipeline[]>(path.join(dir, "pipelines.json"), []);
  }

  /** Merged view of both scopes; workspace items first. */
  loadAll(): ScopedPipeline[] {
    const ws = this.load("workspace").map((p) => ({
      ...p,
      scope: "workspace" as const,
    }));
    const gl = this.load("global").map((p) => ({
      ...p,
      scope: "global" as const,
    }));
    return [...ws, ...gl];
  }

  save(scope: StorageScope, pipelines: Pipeline[]): void {
    const dir = this.dir(scope);
    if (!dir) {
      vscode.window.showWarningMessage(
        "ts-chef: open a workspace folder to save pipelines.",
      );
      return;
    }
    ensureDir(dir);
    writeJSON(path.join(dir, "pipelines.json"), pipelines);
  }

  upsert(scope: StorageScope, pipeline: Pipeline): void {
    const list = this.load(scope).filter((p) => p.name !== pipeline.name);
    list.push(pipeline);
    this.save(scope, list);
  }

  delete(scope: StorageScope, name: string): void {
    this.save(
      scope,
      this.load(scope).filter((p) => p.name !== name),
    );
  }
}
