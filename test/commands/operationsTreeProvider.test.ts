import { OperationsTreeProvider } from "../../src/providers/operationsTreeProvider";
import { TreeItemCollapsibleState } from "../vscode-mock";
import type { TreeItem, Command } from "vscode";

const ITEMS = [
  { opName: "FromBase64", displayName: "From Base64", module: "Encoding" },
  { opName: "ToBase64", displayName: "To Base64", module: "Encoding" },
  { opName: "MD5", displayName: "MD5", module: "Hashing" },
];

describe("OperationsTreeProvider", () => {
  test("top level returns one collapsed group per module, sorted, with counts", () => {
    const p = new OperationsTreeProvider(ITEMS);
    const groups = p.getChildren() as TreeItem[];

    expect(groups.map((g) => g.label)).toEqual(["Encoding", "Hashing"]);
    expect(groups[0].collapsibleState).toBe(TreeItemCollapsibleState.Collapsed);
    expect(groups[0].description).toBe("2");
    expect(groups[1].description).toBe("1");
  });

  test("expanding a group returns its op leaves sorted, with the apply command", () => {
    const p = new OperationsTreeProvider(ITEMS);
    const [encoding] = p.getChildren();
    const leaves = p.getChildren(encoding) as TreeItem[];

    expect(leaves.map((l) => l.label)).toEqual(["From Base64", "To Base64"]);
    expect(leaves[0].collapsibleState).toBe(TreeItemCollapsibleState.None);
    const cmd = leaves[0].command as Command;
    expect(cmd.command).toBe("tschef.applyOperation");
    expect(cmd.arguments).toEqual(["FromBase64"]);
  });

  test("leaves whose needsInput is true show a hint", () => {
    const p = new OperationsTreeProvider(ITEMS, (op) => op === "FromBase64");
    const [encoding] = p.getChildren();
    const leaves = p.getChildren(encoding) as TreeItem[];
    const fromB64 = leaves.find((l) => l.label === "From Base64") as TreeItem;
    const toB64 = leaves.find((l) => l.label === "To Base64") as TreeItem;

    expect(fromB64.description).toBe("needs input");
    expect(toB64.description).toBeUndefined();
  });

  test("setFilter narrows ops, omits empty groups, and expands matches", () => {
    const p = new OperationsTreeProvider(ITEMS);
    p.setFilter("base64");
    const groups = p.getChildren() as TreeItem[];

    expect(groups.map((g) => g.label)).toEqual(["Encoding"]);
    expect(groups[0].collapsibleState).toBe(TreeItemCollapsibleState.Expanded);
    const leaves = p.getChildren(groups[0]) as TreeItem[];
    expect(leaves.map((l) => l.label)).toEqual(["From Base64", "To Base64"]);
  });

  test("an empty filter restores all groups, collapsed", () => {
    const p = new OperationsTreeProvider(ITEMS);
    p.setFilter("base64");
    p.setFilter("");
    const groups = p.getChildren() as TreeItem[];

    expect(groups.map((g) => g.label)).toEqual(["Encoding", "Hashing"]);
    expect(groups[0].collapsibleState).toBe(TreeItemCollapsibleState.Collapsed);
  });

  test("filter also matches opName, not just displayName", () => {
    const p = new OperationsTreeProvider(ITEMS);
    p.setFilter("md5");
    const groups = p.getChildren() as TreeItem[];
    expect(groups.map((g) => g.label)).toEqual(["Hashing"]);
  });

  test("empty items yields no groups", () => {
    expect(new OperationsTreeProvider([]).getChildren()).toEqual([]);
  });

  test("a leaf node has no children", () => {
    const p = new OperationsTreeProvider(ITEMS);
    const [encoding] = p.getChildren();
    const [leaf] = p.getChildren(encoding);
    expect(p.getChildren(leaf)).toEqual([]);
  });
});
