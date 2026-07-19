import pkg from "../package.json";

describe("package identity", () => {
  test("uses the vschef Marketplace identity", () => {
    expect(pkg).toMatchObject({
      name: "vschef",
      displayName: "vschef",
      publisher: "erfur",
      author: {
        name: "Furkan Er",
        email: "mail@erfur.dev",
        url: "https://github.com/erfur",
      },
      repository: {
        type: "git",
        url: "https://github.com/erfur/vschef.git",
      },
      bugs: { url: "https://github.com/erfur/vschef/issues" },
      homepage: "https://github.com/erfur/vschef#readme",
    });
  });
});

describe("package contributions", () => {
  test("does not contribute the standalone pipeline editor command", () => {
    const commands = pkg.contributes.commands.map((command) => command.command);

    expect(commands).not.toContain("vschef.openPipelineEditor");
    expect(commands).toContain("vschef.runPipeline");
    expect(commands).toContain("vschef.runSavedPipelinePicker");
  });

  test("does not contribute saved-variable commands or view", () => {
    const commands = pkg.contributes.commands.map((command) => command.command);
    const views = pkg.contributes.views["vschef-sidebar"].map(
      (view) => view.id,
    );

    expect(commands).not.toContain("vschef.setVariable");
    expect(commands).not.toContain("vschef.showVariables");
    expect(commands).not.toContain("vschef.addVariable");
    expect(views).not.toContain("vschef.variablesView");
  });

  test("contributes the Results view and sidebar result action", () => {
    const views = pkg.contributes.views["vschef-sidebar"];
    const setting =
      pkg.contributes.configuration.properties["vschef.pipelineResultAction"];

    expect(views).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "vschef.resultsView",
          name: "Results",
          type: "webview",
        }),
      ]),
    );
    expect(setting.enum).toContain("sidebar");
    expect(setting.default).toBe("popup");
  });
});
