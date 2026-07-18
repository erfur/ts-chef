import { JSDOM } from "jsdom";
import type { WebviewView } from "vscode";
import {
  ResultsViewProvider,
  type ResultsViewState,
} from "../../src/providers/resultsViewProvider";

function makeView() {
  const webview = {
    options: {} as { enableScripts?: boolean },
    html: "",
    onDidReceiveMessage: jest.fn(),
    postMessage: jest.fn(),
  };
  const view = { webview };
  return { view: view as unknown as WebviewView, webview };
}

function setup() {
  const provider = new ResultsViewProvider();
  const { view, webview } = makeView();
  provider.resolveWebviewView(view);
  const onMessage = webview.onDidReceiveMessage.mock.calls[0][0] as (
    message: unknown,
  ) => void;
  return { provider, webview, onMessage };
}

function renderResultsDom(html: string, state: ResultsViewState) {
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
      data: { type: "state", ...state },
    }),
  );

  return { dom, postMessage };
}

beforeEach(() => jest.clearAllMocks());

describe("ResultsViewProvider", () => {
  test("ready posts the latest state", () => {
    const { provider, webview, onMessage } = setup();
    provider.setState({ filter: "all", items: [], totalCount: 0 });
    webview.postMessage.mockClear();

    onMessage({ type: "ready" });

    expect(webview.postMessage).toHaveBeenCalledWith({
      type: "state",
      filter: "all",
      items: [],
      totalCount: 0,
    });
  });

  test("forwards filter, open, and action messages", () => {
    const { provider, onMessage } = setup();
    const received: unknown[] = [];
    provider.onDidMessage((message) => received.push(message));

    onMessage({ type: "filter", filter: "current" });
    onMessage({ type: "open", id: 4 });
    onMessage({ type: "action", action: "copy", id: 4 });

    expect(received).toEqual([
      { type: "filter", filter: "current" },
      { type: "open", id: 4 },
      { type: "action", action: "copy", id: 4 },
    ]);
  });

  test("renders successful and failed results and disables failed output actions", () => {
    const { webview } = setup();
    const { dom } = renderResultsDom(webview.html, {
      filter: "all",
      totalCount: 2,
      items: [
        { id: 1, label: "Success", source: "first.ts", output: "line 1\nline 2" },
        { id: 2, label: "Failure", source: "second.ts", error: "bad input" },
      ],
    });
    const document = dom.window.document;

    expect(document.querySelectorAll(".result")).toHaveLength(2);
    expect(document.querySelector("pre")?.textContent).toBe("line 1\nline 2");
    expect(document.querySelector(".error")?.textContent).toContain("bad input");
    expect(
      document.querySelector<HTMLButtonElement>(
        '[data-action="copy"][data-id="2"]',
      )?.disabled,
    ).toBe(true);
    expect(
      document.querySelector<HTMLButtonElement>(
        '[data-action="delete"][data-id="2"]',
      )?.disabled,
    ).toBe(false);
  });

  test("renders result content as text rather than HTML", () => {
    const { webview } = setup();
    const unsafe = '<img src=x onerror="alert(1)">';
    const { dom } = renderResultsDom(webview.html, {
      filter: "all",
      totalCount: 1,
      items: [
        { id: 1, label: unsafe, source: unsafe, output: unsafe },
        { id: 2, label: "Failure", source: "safe", error: unsafe },
      ],
    });
    const document = dom.window.document;

    expect(document.querySelector("img")).toBeNull();
    expect(document.querySelector("strong")?.textContent).toBe(unsafe);
    expect(document.querySelector("pre")?.textContent).toBe(unsafe);
    expect(document.querySelector(".error")?.textContent).toBe(unsafe);
  });

  test.each([
    [
      { filter: "all", items: [], totalCount: 0 } as ResultsViewState,
      "No results yet.",
    ],
    [
      { filter: "current", items: [], totalCount: 2 } as ResultsViewState,
      "No results in the current tab.",
    ],
  ])("renders the appropriate empty state", (state, expected) => {
    const { webview } = setup();
    const { dom } = renderResultsDom(webview.html, state);

    expect(dom.window.document.querySelector(".empty")?.textContent).toBe(
      expected,
    );
  });

  test("posts filter, open, and action messages from the webview", () => {
    const { webview } = setup();
    const { dom, postMessage } = renderResultsDom(webview.html, {
      filter: "all",
      totalCount: 1,
      items: [{ id: 4, label: "Result", source: "input.ts", output: "ok" }],
    });
    const document = dom.window.document;
    postMessage.mockClear();

    document
      .querySelector<HTMLElement>('[data-filter="current"]')
      ?.click();
    document.querySelector<HTMLElement>('.result[data-id="4"]')?.click();
    document
      .querySelector<HTMLElement>('[data-action="copy"][data-id="4"]')
      ?.click();

    expect(postMessage.mock.calls.map(([message]) => message)).toEqual([
      { type: "filter", filter: "current" },
      { type: "open", id: 4 },
      { type: "action", action: "copy", id: 4 },
    ]);
  });
});
