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

const BASE62_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export class ToBase62 extends Operation {
    constructor() {
        super();
        this.name = "To Base62";
        this.module = "Default";
        this.description =
            "Base62 encodes data using digits and letters without special characters.";
        this.inputType = "ArrayBuffer";
        this.outputType = "string";
        this.args = [
            { name: "Alphabet", type: "string", value: BASE62_ALPHABET },
        ];
    }

    run(input: ArrayBuffer, args: unknown[]): string {
        const alphabet = (args[0] as string) || BASE62_ALPHABET;
        const bytes = Array.from(new Uint8Array(input));

        let leading = 0;
        for (const b of bytes) { if (b === 0) leading++; else break; }

        const digits: number[] = [0];
        for (const byte of bytes) {
            let carry = byte;
            for (let i = 0; i < digits.length; i++) {
                carry += digits[i] * 256;
                digits[i] = carry % 62;
                carry = (carry / 62) | 0;
            }
            while (carry > 0) { digits.push(carry % 62); carry = (carry / 62) | 0; }
        }

        return alphabet[0].repeat(leading) + digits.reverse().map(d => alphabet[d]).join("");
    }
}

export default ToBase62;
