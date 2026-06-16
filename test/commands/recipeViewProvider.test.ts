import { RecipeViewProvider } from "../../src/providers/recipeViewProvider";
import type { WebviewView } from "vscode";

const ITEMS = [
  { opName: "FromBase64", displayName: "From Base64", module: "Encoding" },
];

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
  const p = new RecipeViewProvider(ITEMS, { onApply, onSave });
  const v = makeView();
  p.resolveWebviewView(v.view);
  const onMessage = v.webview.onDidReceiveMessage.mock.calls[0][0] as (
    m: unknown,
  ) => void;
  return { p, v, onApply, onSave, onMessage };
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

  test("ready posts the empty recipe state", () => {
    const { v, onMessage } = setup();
    onMessage({ type: "ready" });
    expect(v.webview.postMessage).toHaveBeenCalledWith({
      type: "state",
      recipe: { name: "", steps: [] },
    });
  });

  test("edit updates the canonical recipe; save passes it to onSave", () => {
    const { onMessage, onSave } = setup();
    const steps = [{ opName: "FromBase64", args: [] }];
    onMessage({ type: "edit", name: "r1", steps });
    onMessage({ type: "save" });
    expect(onSave).toHaveBeenCalledWith("r1", steps);
  });

  test("addOp appends a step and posts state", () => {
    const { p, v } = setup();
    v.webview.postMessage.mockClear();
    p.addOp({ opName: "FromBase64", args: [] });
    expect(v.webview.postMessage).toHaveBeenCalledWith({
      type: "state",
      recipe: { name: "", steps: [{ opName: "FromBase64", args: [] }] },
    });
  });

  test("load replaces the recipe, reveals the view, and posts state", () => {
    const { p, v } = setup();
    v.webview.postMessage.mockClear();
    p.load({ name: "p", steps: [{ opName: "MD5", args: [] }] });
    expect(v.show).toHaveBeenCalled();
    expect(v.webview.postMessage).toHaveBeenCalledWith({
      type: "state",
      recipe: { name: "p", steps: [{ opName: "MD5", args: [] }] },
    });
  });

  test("edit coerces missing name/steps to empty defaults", () => {
    const { onMessage, onSave } = setup();
    onMessage({ type: "edit" });
    onMessage({ type: "save" });
    expect(onSave).toHaveBeenCalledWith("", []);
  });

  test("apply passes the current steps to onApply", () => {
    const { onMessage, onApply } = setup();
    const steps = [{ opName: "FromBase64", args: [] }];
    onMessage({ type: "edit", name: "", steps });
    onMessage({ type: "apply" });
    expect(onApply).toHaveBeenCalledWith(steps);
  });
});
