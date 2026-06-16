import { OperationsViewProvider } from "../../src/providers/operationsViewProvider";
import { commands } from "../vscode-mock";
import type { WebviewView } from "vscode";

const ITEMS = [
  { opName: "FromBase64", displayName: "From Base64", module: "Encoding" },
  { opName: "MD5", displayName: "MD5", module: "Hashing" },
];

function makeView() {
  const webview = {
    options: {} as { enableScripts?: boolean },
    html: "",
    onDidReceiveMessage: jest.fn(),
    postMessage: jest.fn(),
  };
  return { view: { webview } as unknown as WebviewView, webview };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("OperationsViewProvider", () => {
  test("resolveWebviewView enables scripts and renders an input + the ops", () => {
    const p = new OperationsViewProvider(ITEMS);
    const { view, webview } = makeView();

    p.resolveWebviewView(view);

    expect(webview.options.enableScripts).toBe(true);
    expect(webview.html).toContain("<input");
    expect(webview.html).toContain("From Base64");
    expect(webview.html).toContain("FromBase64");
    expect(webview.html).toContain("MD5");
  });

  test("an 'apply' message runs tschef.applyOperation with the opName", () => {
    const p = new OperationsViewProvider(ITEMS);
    const { view, webview } = makeView();
    p.resolveWebviewView(view);

    const onMessage = webview.onDidReceiveMessage.mock.calls[0][0];
    onMessage({ type: "apply", opName: "FromBase64" });

    expect(commands.executeCommand).toHaveBeenCalledWith(
      "tschef.applyOperation",
      "FromBase64",
    );
  });

  test("a non-apply message is ignored", () => {
    const p = new OperationsViewProvider(ITEMS);
    const { view, webview } = makeView();
    p.resolveWebviewView(view);

    const onMessage = webview.onDidReceiveMessage.mock.calls[0][0];
    onMessage({ type: "somethingElse" });

    expect(commands.executeCommand).not.toHaveBeenCalled();
  });
});
