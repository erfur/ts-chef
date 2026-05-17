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

export class BitShiftLeft extends Operation {
    constructor() {
        super();
        this.name = "Bit shift left";
        this.module = "Default";
        this.description =
            "Shifts the bits in each byte towards the left by the specified amount.";
        this.infoURL = "https://wikipedia.org/wiki/Bitwise_operation#Bit_shifts";
        this.inputType = "ArrayBuffer";
        this.outputType = "ArrayBuffer";
        this.args = [
            {
                name: "Amount",
                type: "number",
                value: 1,
            },
        ];
    }

    run(input: ArrayBuffer, args: number[]): ArrayBuffer {
        const amount = args[0];
        const data = new Uint8Array(input);
        return data.map((b) => (b << amount) & 0xff).buffer;
    }

    highlight(pos: Array<{ start: number; end: number }>, _args: unknown[]): Array<{ start: number; end: number }> {
        return pos;
    }

    highlightReverse(pos: Array<{ start: number; end: number }>, _args: unknown[]): Array<{ start: number; end: number }> {
        return pos;
    }
}

export default BitShiftLeft;
