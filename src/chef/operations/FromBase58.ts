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
import { ALPHABET_BITCOIN_B58, ALPHABET_RIPPLE_B58 } from "./ToBase58";
import OperationError from "../errors/OperationError";

export class FromBase58 extends Operation {
    constructor() {
        super();
        this.name = "From Base58";
        this.module = "Default";
        this.description =
            "Base58 decodes data from a Base58-encoded string (e.g. Bitcoin addresses).";
        this.infoURL = "https://wikipedia.org/wiki/Base58";
        this.inputType = "string";
        this.outputType = "byteArray";
        this.args = [
            { name: "Alphabet", type: "editableOption", value: [
                { name: "Bitcoin: 123456789ABC…XYZabc…xyz", value: ALPHABET_BITCOIN_B58 },
                { name: "Ripple:  rpshnaf39wBUD…", value: ALPHABET_RIPPLE_B58 },
            ]},
            { name: "Remove non-alphabet chars", type: "boolean", value: false },
        ];
    }

    run(input: string, args: unknown[]): number[] {
        const alphabet = (args[0] as string) || ALPHABET_BITCOIN_B58;
        const removeNonAlpha = args[1] as boolean ?? false;

        const map = new Map<string, number>();
        for (let i = 0; i < alphabet.length; i++) map.set(alphabet[i], i);

        let cleaned = input;
        if (removeNonAlpha) cleaned = input.split("").filter(c => map.has(c)).join("");

        if (!cleaned) throw new OperationError("No valid Base58 input found.");

        // Count leading zeros (alphabet[0] chars represent 0x00 bytes)
        let leading = 0;
        for (const ch of cleaned) {
            if (ch === alphabet[0]) leading++;
            else break;
        }

        // Convert base-58 string to big-endian bytes
        const result: number[] = [0];
        for (const ch of cleaned) {
            const val = map.get(ch);
            if (val === undefined) throw new OperationError(`Invalid Base58 character: '${ch}'`);
            let carry = val;
            for (let i = 0; i < result.length; i++) {
                carry += result[i] * 58;
                result[i] = carry & 0xff;
                carry >>= 8;
            }
            while (carry > 0) {
                result.push(carry & 0xff);
                carry >>= 8;
            }
        }

        // Remove trailing zero padding added during decode, reverse to big-endian
        while (result.length > 1 && result[result.length - 1] === 0) result.pop();
        result.reverse();

        return new Array(leading).fill(0).concat(result);
    }
}

export default FromBase58;
