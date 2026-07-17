import Dish from "../../src/chef/Dish";
import { Register } from "../../src/chef/operations/Register";

describe("Register", () => {
  const operation = new Register();

  test("stores regex capture groups as recipe registers", async () => {
    const setRegisters = jest.fn();
    const state = {
      progress: 0,
      dish: new Dish("prefix:alpha-beta"),
      opList: [
        {
          ingValues: ["^prefix:([^-]+)-(.+)$", false, false, false],
        },
      ],
      forkOffset: 0,
      numRegisters: 0,
      setRegisters,
    };

    await operation.run(state);

    expect(setRegisters).toHaveBeenCalledWith(0, 0, ["alpha", "beta"]);
    expect(state.numRegisters).toBe(2);
  });

  test("substitutes $R0 and $R1 in subsequent recipe arguments", async () => {
    const state = {
      progress: 0,
      dish: new Dish("prefix:alpha-beta"),
      opList: [
        {
          ingValues: ["^prefix:([^-]+)-(.+)$", false, false, false],
        },
        {
          ingValues: ["$R0/$R1", { string: "$R1:$R0", option: "UTF8" }],
        },
      ],
      forkOffset: 0,
      numRegisters: 0,
      setRegisters: jest.fn(),
    };

    await operation.run(state);

    expect(state.opList[1].ingValues).toEqual([
      "alpha/beta",
      { string: "beta:alpha", option: "UTF8" },
    ]);
  });
});
