import * as vscode from "vscode";

export type OperationItem = {
  opName: string;
  displayName: string;
  module: string;
};

/**
 * Sidebar webview listing operations grouped by module with an inline
 * as-you-type filter. Matching groups auto-expand while filtering; clicking an
 * operation invokes `tschef.applyOperation` with its opName.
 */
export class OperationsViewProvider implements vscode.WebviewViewProvider {
  constructor(private readonly items: OperationItem[]) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    view.webview.options = { enableScripts: true };
    view.webview.html = this.html();
    view.webview.onDidReceiveMessage(
      (msg: { type?: string; opName?: string }) => {
        if (typeof msg.opName !== "string") return;
        if (msg.type === "apply") {
          vscode.commands.executeCommand("tschef.applyOperation", msg.opName);
        } else if (msg.type === "addToRecipe") {
          vscode.commands.executeCommand("tschef.addToRecipe", msg.opName);
        }
      },
    );
  }

  private html(): string {
    // Escape `<` as `<` so a `</script>` substring in any item field
    // cannot break out of the inline <script> the data is embedded into.
    const data = JSON.stringify(this.items).replace(/</g, "\\u003c");
    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <style>
      body {
        color: var(--vscode-foreground);
        font-family: var(--vscode-font-family);
        padding: 0;
        margin: 0;
      }
      #filter {
        position: sticky;
        top: 0;
        width: 100%;
        box-sizing: border-box;
        padding: 6px 8px;
        border: none;
        outline: none;
        color: var(--vscode-input-foreground);
        background: var(--vscode-input-background);
        border-bottom: 1px solid var(--vscode-panel-border);
      }
      .group-header {
        cursor: pointer;
        padding: 4px 8px;
        font-weight: 600;
        user-select: none;
        opacity: 0.85;
      }
      .group-header:hover {
        background: var(--vscode-list-hoverBackground);
      }
      .op {
        cursor: pointer;
        padding: 3px 8px 3px 22px;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .op:hover {
        background: var(--vscode-list-hoverBackground);
      }
      .op-label {
        flex: 1;
      }
      .op-add {
        opacity: 0.55;
        padding: 0 4px;
      }
      .op-add:hover {
        opacity: 1;
      }
      .count {
        opacity: 0.6;
        font-weight: normal;
        margin-left: 4px;
      }
    </style>
  </head>
  <body>
    <input id="filter" type="text" placeholder="Filter operations…" autofocus />
    <div id="list"></div>
    <script>
      const vscode = acquireVsCodeApi();
      const OPS = ${data};
      const listEl = document.getElementById("list");
      const filterEl = document.getElementById("filter");
      const expanded = new Set();

      function esc(s) {
        return s
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");
      }

      function groupsFor(ql) {
        const byModule = new Map();
        for (const op of OPS) {
          if (
            ql &&
            !op.displayName.toLowerCase().includes(ql) &&
            !op.opName.toLowerCase().includes(ql)
          )
            continue;
          if (!byModule.has(op.module)) byModule.set(op.module, []);
          byModule.get(op.module).push(op);
        }
        return [...byModule.entries()].sort((a, b) =>
          a[0].localeCompare(b[0]),
        );
      }

      function render() {
        const q = filterEl.value.trim().toLowerCase();
        const filtering = q.length > 0;
        const groups = groupsFor(q);
        let html = "";
        for (const [mod, ops] of groups) {
          const open = filtering || expanded.has(mod);
          html +=
            '<div class="group-header" data-mod="' +
            esc(mod) +
            '">' +
            (open ? "▾ " : "▸ ") +
            esc(mod) +
            '<span class="count">' +
            ops.length +
            "</span></div>";
          if (open) {
            ops.sort((a, b) => a.displayName.localeCompare(b.displayName));
            for (const op of ops) {
              html +=
                '<div class="op" data-op="' +
                esc(op.opName) +
                '"><span class="op-label">' +
                esc(op.displayName) +
                '</span><span class="op-add" title="Add to recipe">＋</span></div>';
            }
          }
        }
        listEl.innerHTML = html || '<div class="op">No matches</div>';
      }

      filterEl.addEventListener("input", render);
      listEl.addEventListener("click", (e) => {
        const addEl = e.target.closest(".op-add");
        if (addEl) {
          const row = addEl.closest(".op[data-op]");
          if (row)
            vscode.postMessage({ type: "addToRecipe", opName: row.dataset.op });
          return;
        }
        const opEl = e.target.closest(".op[data-op]");
        if (opEl) {
          vscode.postMessage({ type: "apply", opName: opEl.dataset.op });
          return;
        }
        const hdr = e.target.closest(".group-header");
        if (hdr && !filterEl.value.trim()) {
          const mod = hdr.dataset.mod;
          if (expanded.has(mod)) expanded.delete(mod);
          else expanded.add(mod);
          render();
        }
      });

      render();
    </script>
  </body>
</html>`;
  }
}
