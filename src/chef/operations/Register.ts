/*
 * -----------------------------------------------------------------------------
 * Project:     ts-chef
 * Model:       Qwen 3.5 Coder Next (Local)
 * Version:     1.0.0
 * Author:      Michael Weiss
 * Source:      Ported from GCHQ's CyberChef (JavaScript)
 * License:     Apache License 2.0
 * Description: TypeScript implementation of CyberChef modules.
 * Note:        First Port done by Local Model, Cleanup and fixes by Author
 * -----------------------------------------------------------------------------
 */

import { Operation } from "../Operation";
import XRegExp from "xregexp";
import Dish from "../Dish";
import { isWorkerEnvironment } from "../Utils";

/**
 * Register operation
 */
export class Register extends Operation {

    /**
     * Register constructor
     */
    constructor() {
        super();

        this.name = "Register";
        this.flowControl = true;
        this.module = "Regex";
        this.description = "Extract data from the input and store it in registers which can then be passed into subsequent operations as arguments. Regular expression capture groups are used to select the data to extract.<br><br>To use registers in arguments, refer to them using the notation <code>$Rn</code> where n is the register number, starting at 0.<br><br>For example:<br>Input: <code>Test</code><br>Extractor: <code>(.*)</code><br>Argument: <code>$R0</code> becomes <code>Test</code><br><br>Registers can be escaped in arguments using a backslash. e.g. <code>\\$R0</code> would become <code>$R0</code> rather than <code>Test</code>.";
        this.infoURL = "https://wikipedia.org/wiki/Regular_expression#Syntax";
        this.inputType = "string";
        this.outputType = "string";
        this.args = [
            {
                "name": "Extractor",
                "type": "binaryString",
                "value": "([\\s\\S]*)"
            },
            {
                "name": "Case insensitive",
                "type": "boolean",
                "value": true
            },
            {
                "name": "Multiline matching",
                "type": "boolean",
                "value": false
            },
            {
                "name": "Dot matches all",
                "type": "boolean",
                "value": false
            }
        ];
    }

    /**
     * @param {Object} state - The current state of the recipe.
     * @param {number} state.progress - The current position in the recipe.
     * @param {Dish} state.dish - The Dish being operated on.
     * @param {Operation[]} state.opList - The list of operations in the recipe.
     * @returns {Object} The updated state of the recipe.
     */
    async run(state: { progress: number; dish: { get(type: number): Promise<string> }; opList: Array<{ ingValues: unknown[]; disabled?: boolean }>; forkOffset: number; numRegisters: number }) {
        const ings = state.opList[state.progress].ingValues;
        const [extractorStr, i, m, s] = ings;

        let modifiers = "";
        if (i) modifiers += "i";
        if (m) modifiers += "m";
        if (s) modifiers += "s";

        const extractor = new XRegExp(extractorStr, modifiers),
            input = await state.dish.get(Dish.STRING),
            registers = input.match(extractor);

        if (!registers) return state;

        if (isWorkerEnvironment()) {
            (self as unknown as { setRegisters: (...args: unknown[]) => void }).setRegisters(state.forkOffset + state.progress, state.numRegisters, registers.slice(1));
        }

        /**
         * Replaces references to registers (e.g. $R0) with the contents of those registers.
         *
         * @param {string} str
         * @returns {string}
         */
        function replaceRegister(str: string): string {
            // Replace references to registers ($Rn) with contents of registers
            return str.replace(/(\\*)\$R(\d{1,2})/g, (match: string, slashes: string, regNum: string) => {
                const index = parseInt(regNum, 10) + 1;
                if (!registers || index <= state.numRegisters || index >= state.numRegisters + registers.length)
                    return match;
                if (slashes.length % 2 !== 0) return match.slice(1); // Remove escape
                return slashes + registers[index - state.numRegisters];
            });
        }

        // Step through all subsequent ops and replace registers in args with extracted content
        for (let i = state.progress + 1; i < state.opList.length; i++) {
            if (state.opList[i].disabled) continue;

            let args = state.opList[i].ingValues;
            args = args.map((arg: unknown) => {
                if (typeof arg !== "string" && typeof arg !== "object") return arg;

                if (typeof arg === "object" && arg !== null && "string" in arg && typeof (arg as { string: unknown }).string === "string") {
                    (arg as { string: string }).string = replaceRegister((arg as { string: string }).string);
                    return arg;
                }
                return typeof arg === "string" ? replaceRegister(arg) : arg;
            });
            state.opList[i].ingValues = args;
        }

        state.numRegisters += registers.length - 1;
        return state;
    }

}

export default Register;