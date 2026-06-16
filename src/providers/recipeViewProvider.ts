import * as vscode from "vscode";
import type { PipelineStep } from "../storage/store";

type Recipe = { name: string; steps: PipelineStep[] };

export type RecipeCallbacks = {
  onApply: (steps: PipelineStep[]) => void | Promise<void>;
  onSave: (name: string, steps: PipelineStep[]) => void | Promise<void>;
};

/**
 * Sidebar webview holding one working "recipe" (a single pipeline). Operations
 * are appended via `addOp` (the Operations pane's ＋), reordered/removed in the
 * webview, applied to the selection, and saved into the pipelines list. The
 * controller holds the canonical recipe so it survives hide/show and loads.
 */
export class RecipeViewProvider implements vscode.WebviewViewProvider {
  private view: vscode.WebviewView | undefined;
  private recipe: Recipe = { name: "", steps: [] };

  constructor(
    private readonly items: { opName: string; displayName: string }[],
    private readonly callbacks: RecipeCallbacks,
  ) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = { enableScripts: true };
    view.webview.html = this.html();
    view.webview.onDidReceiveMessage(
      async (msg: { type?: string; name?: string; steps?: PipelineStep[] }) => {
        switch (msg.type) {
          case "ready":
            this.postState();
            break;
          case "edit":
            this.recipe = {
              name: msg.name ?? "",
              steps: Array.isArray(msg.steps) ? msg.steps : [],
            };
            break;
          case "apply":
            await this.callbacks.onApply(this.recipe.steps);
            break;
          case "save":
            await this.callbacks.onSave(this.recipe.name, this.recipe.steps);
            break;
        }
      },
    );
  }

  /** Append an operation step to the working recipe. */
  addOp(step: PipelineStep): void {
    this.recipe.steps.push(step);
    this.postState();
  }

  /** Replace the working recipe with a saved pipeline and reveal the pane. */
  load(pipeline: { name: string; steps: PipelineStep[] }): void {
    this.recipe = { name: pipeline.name, steps: [...pipeline.steps] };
    this.view?.show?.(false);
    this.postState();
  }

  private postState(): void {
    this.view?.webview.postMessage({ type: "state", recipe: this.recipe });
  }

  private html(): string {
    const names: Record<string, string> = {};
    for (const it of this.items) names[it.opName] = it.displayName;
    const namesData = JSON.stringify(names).replace(/</g, "\\u003c");
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
      #name {
        width: 100%;
        box-sizing: border-box;
        padding: 6px 8px;
        border: none;
        outline: none;
        color: var(--vscode-input-foreground);
        background: var(--vscode-input-background);
        border-bottom: 1px solid var(--vscode-panel-border);
      }
      #steps {
        padding: 4px 0;
      }
      .step {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 3px 8px;
        cursor: grab;
      }
      .step:hover {
        background: var(--vscode-list-hoverBackground);
      }
      .idx {
        opacity: 0.6;
        min-width: 1.4em;
        text-align: right;
      }
      .label {
        flex: 1;
      }
      .rm {
        cursor: pointer;
        opacity: 0.7;
      }
      .rm:hover {
        opacity: 1;
      }
      .empty {
        padding: 8px;
        opacity: 0.6;
      }
      .actions {
        display: flex;
        gap: 6px;
        padding: 8px;
        border-top: 1px solid var(--vscode-panel-border);
      }
      button {
        flex: 1;
        color: var(--vscode-button-foreground);
        background: var(--vscode-button-background);
        border: none;
        padding: 5px 8px;
        cursor: pointer;
        border-radius: 2px;
      }
      button:hover {
        background: var(--vscode-button-hoverBackground);
      }
    </style>
  </head>
  <body>
    <input id="name" type="text" placeholder="Recipe name…" />
    <div id="steps"></div>
    <div class="actions">
      <button id="apply">Apply to selection</button>
      <button id="save">Save as pipeline</button>
    </div>
    <script>
      const vscode = acquireVsCodeApi();
      const NAMES = ${namesData};
      const nameEl = document.getElementById("name");
      const stepsEl = document.getElementById("steps");
      let steps = [];
      let dragIdx = -1;

      function esc(s) {
        return String(s)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
      }
      function label(op) {
        return NAMES[op] || op;
      }

      function render() {
        if (!steps.length) {
          stepsEl.innerHTML =
            '<div class="empty">Empty recipe — add operations with ＋ from the Operations pane.</div>';
          return;
        }
        let html = "";
        steps.forEach((s, i) => {
          html +=
            '<div class="step" draggable="true" data-i="' +
            i +
            '"><span class="idx">' +
            (i + 1) +
            '</span><span class="label">' +
            esc(label(s.opName)) +
            '</span><span class="rm" data-rm="' +
            i +
            '" title="Remove">✕</span></div>';
        });
        stepsEl.innerHTML = html;
      }

      function emitEdit() {
        vscode.postMessage({ type: "edit", name: nameEl.value, steps });
      }

      nameEl.addEventListener("input", emitEdit);
      document
        .getElementById("apply")
        .addEventListener("click", () => vscode.postMessage({ type: "apply" }));
      document
        .getElementById("save")
        .addEventListener("click", () => vscode.postMessage({ type: "save" }));

      stepsEl.addEventListener("click", (e) => {
        const rm = e.target.closest("[data-rm]");
        if (rm) {
          steps.splice(Number(rm.dataset.rm), 1);
          render();
          emitEdit();
        }
      });
      stepsEl.addEventListener("dragstart", (e) => {
        const el = e.target.closest(".step");
        if (el) dragIdx = Number(el.dataset.i);
      });
      stepsEl.addEventListener("dragover", (e) => e.preventDefault());
      stepsEl.addEventListener("drop", (e) => {
        e.preventDefault();
        const el = e.target.closest(".step");
        if (!el || dragIdx < 0) return;
        const to = Number(el.dataset.i);
        const moved = steps.splice(dragIdx, 1)[0];
        steps.splice(to, 0, moved);
        dragIdx = -1;
        render();
        emitEdit();
      });

      window.addEventListener("message", (e) => {
        const msg = e.data;
        if (msg.type === "state") {
          nameEl.value = msg.recipe.name || "";
          steps = Array.isArray(msg.recipe.steps) ? msg.recipe.steps : [];
          render();
        }
      });

      vscode.postMessage({ type: "ready" });
      render();
    </script>
  </body>
</html>`;
  }
}
