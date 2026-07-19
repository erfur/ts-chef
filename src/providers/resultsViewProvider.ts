import * as vscode from "vscode";

export type ResultFilter = "all" | "current";
export type ResultAction =
  | "popup"
  | "copy"
  | "replace"
  | "reselect"
  | "delete";

export type ResultViewItem = {
  id: number;
  label: string;
  source: string;
  output?: string;
  error?: string;
};

export type ResultsViewState = {
  filter: ResultFilter;
  items: ResultViewItem[];
  totalCount: number;
};

export type ResultsViewMessage =
  | { type: "filter"; filter: ResultFilter }
  | { type: "open"; id: number }
  | { type: "action"; action: ResultAction; id: number };

export class ResultsViewProvider implements vscode.WebviewViewProvider {
  private view: vscode.WebviewView | undefined;
  private state: ResultsViewState = {
    filter: "all",
    items: [],
    totalCount: 0,
  };
  private readonly messages = new vscode.EventEmitter<ResultsViewMessage>();
  readonly onDidMessage = this.messages.event;

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = { enableScripts: true };
    view.webview.html = this.html();
    view.webview.onDidReceiveMessage((message) => {
      if (message?.type === "ready") this.postState();
      else if (message?.type === "filter") {
        if (message.filter === "all" || message.filter === "current")
          this.messages.fire(message);
      } else if (
        (message?.type === "open" || message?.type === "action") &&
        Number.isInteger(message.id)
      ) {
        this.messages.fire(message);
      }
    });
  }

  setState(state: ResultsViewState): void {
    this.state = state;
    this.postState();
  }

  dispose(): void {
    this.messages.dispose();
  }

  private postState(): void {
    this.view?.webview.postMessage({ type: "state", ...this.state });
  }

  private html(): string {
    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
body { color: var(--vscode-foreground); background: var(--vscode-sideBar-background);
  font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); margin: 0; }
button { font: inherit; }
.filters { display: flex; gap: 4px; padding: 6px 8px; border-bottom: 1px solid var(--vscode-panel-border); }
.filters button[aria-pressed="true"] { color: var(--vscode-button-foreground); background: var(--vscode-button-background); }
.result { padding: 7px 8px; border-bottom: 1px solid var(--vscode-panel-border); cursor: pointer; }
.result:hover { background: var(--vscode-list-hoverBackground); }
.meta { display: flex; justify-content: space-between; gap: 8px; }
.source { opacity: .7; }
pre { white-space: pre-wrap; word-break: break-word; max-height: 8em; overflow: auto; margin: 5px 0; }
.error { color: var(--vscode-errorForeground); white-space: pre-wrap; margin: 5px 0; }
.actions { display: flex; gap: 4px; }
.actions button { color: var(--vscode-button-secondaryForeground); background: var(--vscode-button-secondaryBackground); border: 0; cursor: pointer; }
.actions button:disabled { opacity: .45; cursor: default; }
.empty { padding: 10px 8px; opacity: .7; }
</style></head><body>
<div class="filters"><button data-filter="all">All tabs</button><button data-filter="current">Current tab</button></div>
<div id="results"></div>
<script>
const vscode = acquireVsCodeApi();
const results = document.getElementById("results");
const esc = (value) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function render(state) {
  document.querySelectorAll("[data-filter]").forEach((button) =>
    button.setAttribute("aria-pressed", String(button.dataset.filter === state.filter)));
  if (!state.items.length) {
    const text = state.filter === "current" && state.totalCount
      ? "No results in the current tab." : "No results yet.";
    results.innerHTML = '<div class="empty">' + text + "</div>";
    return;
  }
  results.innerHTML = state.items.map((item) => {
    const failed = item.error != null;
    const body = failed
      ? '<div class="error">' + esc(item.error) + "</div>"
      : "<pre>" + esc(item.output || "") + "</pre>";
    const disabled = failed || item.output == null ? " disabled" : "";
    const action = (name, label) => '<button data-action="' + name + '" data-id="' + item.id + '"' +
      (name === "delete" || name === "reselect" ? "" : disabled) + ">" + label + "</button>";
    return '<div class="result" data-id="' + item.id + '"><div class="meta"><strong>' +
      esc(item.label) + '</strong><span class="source">' + esc(item.source) + "</span></div>" + body +
      '<div class="actions">' + action("popup", "Popup") + action("copy", "Copy") +
      action("reselect", "Reselect") + action("replace", "Replace") +
      action("delete", "Delete") + "</div></div>";
  }).join("");
}
document.querySelectorAll("[data-filter]").forEach((button) => button.addEventListener("click", () =>
  vscode.postMessage({ type: "filter", filter: button.dataset.filter })));
results.addEventListener("click", (event) => {
  const action = event.target.closest("[data-action]");
  if (action) {
    event.stopPropagation();
    vscode.postMessage({ type: "action", action: action.dataset.action, id: Number(action.dataset.id) });
    return;
  }
  const row = event.target.closest(".result");
  if (row) vscode.postMessage({ type: "open", id: Number(row.dataset.id) });
});
window.addEventListener("message", (event) => { if (event.data.type === "state") render(event.data); });
vscode.postMessage({ type: "ready" });
</script></body></html>`;
  }
}
