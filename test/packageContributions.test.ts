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
});
