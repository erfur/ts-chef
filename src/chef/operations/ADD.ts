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
import { Utils } from "../Utils";
import { bitOp, add, BITWISE_OP_DELIMS } from "../lib/BitwiseOp";

interface ToggleStringArg {
    string: string;
    option: string;
}

export class ADD extends Operation {
    constructor() {
        super();
        this.name = "ADD";
        this.module = "Default";
        this.description = "ADD the input with the given key (e.g. fe023da5), MOD 255";
        this.infoURL = "https://wikipedia.org/wiki/Bitwise_operation#Bitwise_operators";
        this.inputType = "byteArray";
        this.outputType = "byteArray";
        this.args = [
            {
                name: "Key",
                type: "toggleString",
                value: "",
                toggleValues: BITWISE_OP_DELIMS,
            },
        ];
    }

    run(input: number[], args: ToggleStringArg[]): number[] {
        const key = Utils.convertToByteArray(args[0].string || "", args[0].option);
        return bitOp(input, key, add);
    }

    highlight(
        pos: Array<{ start: number; end: number }>,
        _args: unknown[]
    ): Array<{ start: number; end: number }> {
        return pos;
    }

    highlightReverse(
        pos: Array<{ start: number; end: number }>,
        _args: unknown[]
    ): Array<{ start: number; end: number }> {
        return pos;
    }
}

export default ADD;
