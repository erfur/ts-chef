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
import { toBinary } from "../lib/Binary";

export class CetaceanCipherEncode extends Operation {
    constructor() {
        super();
        this.name = "Cetacean Cipher Encode";
        this.module = "Ciphers";
        this.description =
            "Converts any input into Cetacean Cipher. e.g. hi becomes EEEEEEEEEeeEeEEEEEEEEEEEEeeEeEEe";
        this.infoURL = "https://hitchhikers.fandom.com/wiki/Dolphins";
        this.inputType = "string";
        this.outputType = "string";
        this.args = [];
    }

    run(input: string, _args: unknown[]): string {
        const result: string[] = [];

        for (const character of input) {
            if (character === " ") {
                result.push(character);
            } else {
                const binaryStr = toBinary(character.charCodeAt(0), "None", 16);
                result.push(binaryStr.split("").map((b) => (b === "1" ? "e" : "E")).join(""));
            }
        }

        return result.join("");
    }
}

export default CetaceanCipherEncode;
