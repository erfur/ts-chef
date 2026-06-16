import * as vscode from "vscode";

export type OperationItem = {
  opName: string;
  displayName: string;
  module: string;
};

class GroupNode extends vscode.TreeItem {
  constructor(
    public readonly module: string,
    public readonly ops: OperationItem[],
    expanded: boolean,
  ) {
    super(
      module,
      expanded
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.Collapsed,
    );
    this.description = `${ops.length}`;
    this.contextValue = "operation-group";
  }
}

class OperationNode extends vscode.TreeItem {
  constructor(
    public readonly op: OperationItem,
    needsInput: boolean,
  ) {
    super(op.displayName, vscode.TreeItemCollapsibleState.None);
    if (needsInput) this.description = "needs input";
    this.tooltip = op.opName;
    this.iconPath = new vscode.ThemeIcon("symbol-method");
    this.contextValue = "operation";
    this.command = {
      command: "tschef.applyOperation",
      title: "Apply Operation",
      arguments: [op.opName],
    };
  }
}

/**
 * Lists operations grouped by module, with a filter. Clicking an operation
 * leaf fires `tschef.applyOperation` with its opName.
 */
export class OperationsTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private filter = "";

  constructor(
    private readonly items: OperationItem[],
    private readonly needsInput: (opName: string) => boolean = () => false,
  ) {}

  setFilter(text: string): void {
    this.filter = text.toLowerCase();
    this._onDidChangeTreeData.fire();
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: vscode.TreeItem): vscode.TreeItem[] {
    if (element) {
      if (element instanceof GroupNode) {
        return element.ops.map(
          (op) => new OperationNode(op, this.needsInput(op.opName)),
        );
      }
      return [];
    }

    const matched = this.filter
      ? this.items.filter(
          (o) =>
            o.displayName.toLowerCase().includes(this.filter) ||
            o.opName.toLowerCase().includes(this.filter),
        )
      : this.items;

    const byModule = new Map<string, OperationItem[]>();
    for (const o of matched) {
      const mod = o.module || "Other";
      if (!byModule.has(mod)) byModule.set(mod, []);
      byModule.get(mod)!.push(o);
    }

    const expanded = this.filter.length > 0;
    return Array.from(byModule.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(
        ([mod, ops]) =>
          new GroupNode(
            mod,
            ops
              .slice()
              .sort((a, b) => a.displayName.localeCompare(b.displayName)),
            expanded,
          ),
      ) as vscode.TreeItem[];
  }
}
