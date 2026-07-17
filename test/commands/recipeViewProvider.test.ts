import { RecipeViewProvider } from "../../src/providers/recipeViewProvider";
import type { WebviewView } from "vscode";
import type { ArgConfig } from "../../src/chef/Operation";
import { JSDOM } from "jsdom";

const ITEMS = [
  { opName: "FromBase64", displayName: "From Base64", module: "Encoding" },
];

const ARG_DEFS = [
  { name: "Alphabet", type: "toggleString" },
] as unknown as ArgConfig[];

function makeView() {
  const webview = {
    options: {} as { enableScripts?: boolean },
    html: "",
    onDidReceiveMessage: jest.fn(),
    postMessage: jest.fn(),
  };
  const view = { webview, show: jest.fn() };
  return { view: view as unknown as WebviewView, webview, show: view.show };
}

function setup() {
  const onApply = jest.fn();
  const onSave = jest.fn();
  const argDefsFor = jest.fn((op: string): ArgConfig[] =>
    op === "FromBase64" ? ARG_DEFS : [],
  );
  const p = new RecipeViewProvider(ITEMS, { onApply, onSave }, argDefsFor);
  const v = makeView();
  p.resolveWebviewView(v.view);
  const onMessage = v.webview.onDidReceiveMessage.mock.calls[0][0] as (
    m: unknown,
  ) => void;
  return { p, v, onApply, onSave, argDefsFor, onMessage };
}

function renderRecipeDom(html: string) {
  const dom = new JSDOM(html, {
    runScripts: "dangerously",
    beforeParse(window) {
      Object.defineProperty(window, "acquireVsCodeApi", {
        value: () => ({ postMessage: jest.fn() }),
      });
    },
  });

  dom.window.dispatchEvent(
    new dom.window.MessageEvent("message", {
      data: {
        type: "state",
        recipe: { name: "r1", steps: [{ opName: "FromBase64", args: [""] }] },
        defs: { FromBase64: ARG_DEFS },
      },
    }),
  );

  return dom;
}

beforeEach(() => jest.clearAllMocks());

describe("RecipeViewProvider", () => {
  test("resolveWebviewView enables scripts and renders name input + buttons", () => {
    const { v } = setup();
    expect(v.webview.options.enableScripts).toBe(true);
    expect(v.webview.html).toContain('id="name"');
    expect(v.webview.html).toContain("Apply to selection");
    expect(v.webview.html).toContain("Save as pipeline");
  });

  test("uses VS Code default typography for all recipe fields", () => {
    const { v } = setup();

    expect(v.webview.html).toContain("font-size: var(--vscode-font-size);");
    expect(v.webview.html).toMatch(
      /input,\s*select,\s*button\s*{\s*font: inherit;/,
    );
    expect(v.webview.html).not.toContain("font-size: 11px;");
  });

  test("renders argument-bearing steps open by default while honoring collapse state", () => {
    const { v } = setup();
    const dom = renderRecipeDom(v.webview.html);

    expect(dom.window.document.querySelector(".step-args")).not.toBeNull();
    expect(
      dom.window.document.querySelector("[data-toggle]")?.textContent,
    ).toBe("▲");

    dom.window.document
      .querySelector<HTMLElement>("[data-toggle]")
      ?.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));

    expect(dom.window.document.querySelector(".step-args")).toBeNull();
    expect(
      dom.window.document.querySelector("[data-toggle]")?.textContent,
    ).toBe("▼");

    dom.window.dispatchEvent(
      new dom.window.MessageEvent("message", {
        data: {
          type: "state",
          recipe: { name: "r1", steps: [{ opName: "FromBase64", args: [""] }] },
          defs: { FromBase64: ARG_DEFS },
        },
      }),
    );

    expect(dom.window.document.querySelector(".step-args")).not.toBeNull();
  });

  test("ready posts the empty recipe state with an empty defs map", () => {
    const { v, onMessage } = setup();
    onMessage({ type: "ready" });
    expect(v.webview.postMessage).toHaveBeenCalledWith({
      type: "state",
      recipe: { name: "", steps: [] },
      defs: {},
    });
  });

  test("edit updates the canonical recipe; save passes it to onSave", () => {
    const { onMessage, onSave } = setup();
    const steps = [{ opName: "FromBase64", args: [] }];
    onMessage({ type: "edit", name: "r1", steps });
    onMessage({ type: "save" });
    expect(onSave).toHaveBeenCalledWith("r1", steps);
  });

  test("edit coerces missing name/steps to empty defaults", () => {
    const { onMessage, onSave } = setup();
    onMessage({ type: "edit" });
    onMessage({ type: "save" });
    expect(onSave).toHaveBeenCalledWith("", []);
  });

  test("addOp appends a step and posts state including the op's arg defs", () => {
    const { p, v, argDefsFor } = setup();
    v.webview.postMessage.mockClear();
    p.addOp({ opName: "FromBase64", args: [] });
    expect(argDefsFor).toHaveBeenCalledWith("FromBase64");
    expect(v.webview.postMessage).toHaveBeenCalledWith({
      type: "state",
      recipe: { name: "", steps: [{ opName: "FromBase64", args: [] }] },
      defs: { FromBase64: ARG_DEFS },
    });
  });

  test("load replaces the recipe, reveals the view, and posts state with defs", () => {
    const { p, v } = setup();
    v.webview.postMessage.mockClear();
    p.load({ name: "p", steps: [{ opName: "MD5", args: [] }] });
    expect(v.show).toHaveBeenCalled();
    expect(v.webview.postMessage).toHaveBeenCalledWith({
      type: "state",
      recipe: { name: "p", steps: [{ opName: "MD5", args: [] }] },
      defs: { MD5: [] },
    });
  });

  test("apply passes the current steps to onApply", () => {
    const { onMessage, onApply } = setup();
    const steps = [{ opName: "FromBase64", args: [] }];
    onMessage({ type: "edit", name: "", steps });
    onMessage({ type: "apply" });
    expect(onApply).toHaveBeenCalledWith(steps);
  });
});
