import { RecipeViewProvider } from "../../src/providers/recipeViewProvider";
import type { WebviewView } from "vscode";
import type { ArgConfig } from "../../src/chef/Operation";
import { JSDOM } from "jsdom";

const ITEMS = [
  { opName: "FromBase64", displayName: "From Base64", module: "Encoding" },
];

const ARG_DEFS = [
  { name: "Value", type: "string", value: "" },
  { name: "Alphabet", type: "toggleString", value: "" },
  { name: "Separator", type: "binaryShortString", value: "" },
] as ArgConfig[];

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

function setup(selection?: string) {
  const onApply = jest.fn();
  const onSave = jest.fn();
  const getSelection = jest.fn(() => selection);
  const argDefsFor = jest.fn((op: string): ArgConfig[] =>
    op === "FromBase64" ? ARG_DEFS : [],
  );
  const p = new RecipeViewProvider(
    ITEMS,
    { onApply, onSave, getSelection },
    argDefsFor,
  );
  const v = makeView();
  p.resolveWebviewView(v.view);
  const onMessage = v.webview.onDidReceiveMessage.mock.calls[0][0] as (
    m: unknown,
  ) => Promise<void>;
  return {
    p,
    v,
    onApply,
    onSave,
    getSelection,
    argDefsFor,
    onMessage,
  };
}

function renderRecipeDom(html: string) {
  const postMessage = jest.fn();
  const dom = new JSDOM(html, {
    runScripts: "dangerously",
    beforeParse(window) {
      Object.defineProperty(window, "acquireVsCodeApi", {
        value: () => ({ postMessage }),
      });
    },
  });

  dom.window.dispatchEvent(
    new dom.window.MessageEvent("message", {
      data: {
        type: "state",
        recipe: {
          name: "r1",
          steps: [{ opName: "FromBase64", args: ["", "", ""] }],
        },
        defs: { FromBase64: ARG_DEFS },
      },
    }),
  );

  return { dom, postMessage };
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
    const { dom } = renderRecipeDom(v.webview.html);

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

  test("renders use-selection only beside plain string arguments", () => {
    const { v } = setup();
    const { dom } = renderRecipeDom(v.webview.html);

    const buttons = dom.window.document.querySelectorAll("[data-use-selection]");
    expect(buttons).toHaveLength(1);
    expect(buttons[0].closest(".arg-row")?.textContent).toContain("Value");
    expect(buttons[0].closest(".arg-row")?.textContent).not.toContain(
      "Alphabet",
    );
    const separatorRow = Array.from(
      dom.window.document.querySelectorAll(".arg-row"),
    ).find((row) => row.textContent?.includes("Separator"));
    expect(separatorRow?.querySelector('input[type="text"]')).not.toBeNull();
    expect(separatorRow?.querySelector("[data-use-selection]")).toBeNull();
  });

  test("requests the current selection for the clicked argument", () => {
    const { v } = setup();
    const { dom, postMessage } = renderRecipeDom(v.webview.html);
    postMessage.mockClear();

    dom.window.document
      .querySelector<HTMLElement>("[data-use-selection]")
      ?.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));

    expect(postMessage).toHaveBeenCalledWith({
      type: "useSelection",
      step: 0,
      arg: 0,
    });
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

  test("assigns a non-empty selection to a plain string argument", async () => {
    const { v, onMessage, getSelection } = setup("selected text");
    const steps = [{ opName: "FromBase64", args: ["old", "Hex"] }];
    await onMessage({ type: "edit", name: "decode", steps });
    v.webview.postMessage.mockClear();

    await onMessage({ type: "useSelection", step: 0, arg: 0 });

    expect(getSelection).toHaveBeenCalledTimes(1);
    expect(steps[0].args[0]).toBe("selected text");
    expect(v.webview.postMessage).toHaveBeenCalledWith({
      type: "state",
      recipe: { name: "decode", steps },
      defs: { FromBase64: ARG_DEFS },
    });
  });

  test.each([undefined, ""])(
    "leaves the argument unchanged when selection is %p",
    async (selection) => {
      const { v, onMessage } = setup(selection);
      const steps = [{ opName: "FromBase64", args: ["old", "Hex"] }];
      await onMessage({ type: "edit", name: "decode", steps });
      v.webview.postMessage.mockClear();

      await onMessage({ type: "useSelection", step: 0, arg: 0 });

      expect(steps[0].args[0]).toBe("old");
      expect(v.webview.postMessage).not.toHaveBeenCalled();
    },
  );

  test.each([
    { step: 2, arg: 0 },
    { step: 0, arg: 1 },
  ])("ignores invalid or specialized target $step:$arg", async (target) => {
    const { v, onMessage, getSelection } = setup("selected text");
    const steps = [{ opName: "FromBase64", args: ["old", "Hex"] }];
    await onMessage({ type: "edit", name: "decode", steps });
    v.webview.postMessage.mockClear();

    await onMessage({ type: "useSelection", ...target });

    expect(getSelection).not.toHaveBeenCalled();
    expect(steps[0].args).toEqual(["old", "Hex"]);
    expect(v.webview.postMessage).not.toHaveBeenCalled();
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

  test("apply passes the current recipe name and steps", () => {
    const { onMessage, onApply } = setup();
    const steps = [{ opName: "FromBase64", args: [] }];
    onMessage({ type: "edit", name: "decode", steps });
    onMessage({ type: "apply" });
    expect(onApply).toHaveBeenCalledWith("decode", steps);
  });
});
