import * as vscode from "vscode";
import { PipelineStore, ScopedPipeline } from "../storage/store";

class PipelineNode extends vscode.TreeItem {
  constructor(public readonly pipeline: ScopedPipeline) {
    super(pipeline.name, vscode.TreeItemCollapsibleState.None);
    const scopeLabel = pipeline.scope === "global" ? "Global" : "Workspace";
    const desc = pipeline.description ?? pipeline.raw.slice(0, 50);
    this.description = `${scopeLabel} · ${desc}`;
    this.tooltip = pipeline.raw;
    this.contextValue = `pipeline-${pipeline.scope}`;
    this.iconPath = new vscode.ThemeIcon("symbol-event");
    this.command = {
      command: "tschef.runSavedPipeline",
      title: "Run Pipeline",
      arguments: [pipeline.name, pipeline.scope],
    };
  }
}

export class PipelinesTreeProvider
  implements vscode.TreeDataProvider<PipelineNode>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private store: PipelineStore) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }
  getTreeItem(e: PipelineNode): vscode.TreeItem {
    return e;
  }
  getChildren(): PipelineNode[] {
    return this.store.loadAll().map((p) => new PipelineNode(p));
  }
}
