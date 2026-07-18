import pkg from "../package.json";

describe("package contributions", () => {
  test("does not contribute the standalone pipeline editor command", () => {
    const commands = pkg.contributes.commands.map((command) => command.command);

    expect(commands).not.toContain("tschef.openPipelineEditor");
    expect(commands).toContain("tschef.runPipeline");
    expect(commands).toContain("tschef.runSavedPipelinePicker");
  });

  test("does not contribute saved-variable commands or view", () => {
    const commands = pkg.contributes.commands.map((command) => command.command);
    const views = pkg.contributes.views["tschef-sidebar"].map(
      (view) => view.id,
    );

    expect(commands).not.toContain("tschef.setVariable");
    expect(commands).not.toContain("tschef.showVariables");
    expect(commands).not.toContain("tschef.addVariable");
    expect(views).not.toContain("tschef.variablesView");
  });

  test("contributes the Results view and sidebar result action", () => {
    const views = pkg.contributes.views["tschef-sidebar"];
    const setting =
      pkg.contributes.configuration.properties["tschef.pipelineResultAction"];

    expect(views).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "tschef.resultsView",
          name: "Results",
          type: "webview",
        }),
      ]),
    );
    expect(setting.enum).toContain("sidebar");
    expect(setting.default).toBe("popup");
  });
});
