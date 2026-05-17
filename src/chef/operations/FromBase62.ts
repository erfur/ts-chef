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
import OperationError from "../errors/OperationError";

const BASE62_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export class FromBase62 extends Operation {
    constructor() {
        super();
        this.name = "From Base62";
        this.module = "Default";
        this.description =
            "Base62 decodes data from a Base62-encoded string (digits and letters, no special characters).";
        this.inputType = "string";
        this.outputType = "byteArray";
        this.args = [
            { name: "Alphabet", type: "string", value: BASE62_ALPHABET },
        ];
    }

    run(input: string, args: unknown[]): number[] {
        const alphabet = (args[0] as string) || BASE62_ALPHABET;
        if (alphabet.length !== 62) throw new OperationError(`Base62 alphabet must be exactly 62 characters, got ${alphabet.length}.`);

        const map = new Map<string, number>();
        for (let i = 0; i < alphabet.length; i++) map.set(alphabet[i], i);

        const cleaned = input.trim();
        if (!cleaned) throw new OperationError("Empty input.");

        let leading = 0;
        for (const ch of cleaned) {
            if (ch === alphabet[0]) leading++;
            else break;
        }

        const result: number[] = [0];
        for (const ch of cleaned) {
            const val = map.get(ch);
            if (val === undefined) throw new OperationError(`Invalid Base62 character: '${ch}'`);
            let carry = val;
            for (let i = 0; i < result.length; i++) {
                carry += result[i] * 62;
                result[i] = carry & 0xff;
                carry >>= 8;
            }
            while (carry > 0) {
                result.push(carry & 0xff);
                carry >>= 8;
            }
        }

        while (result.length > 1 && result[result.length - 1] === 0) result.pop();
        result.reverse();

        return new Array(leading).fill(0).concat(result);
    }
}

export default FromBase62;
