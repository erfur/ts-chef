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
import { OperationError } from "../errors/OperationError";
import { createDecipheriv } from "crypto";
import { fromHex } from "../lib/Hex";

export class TripleDESDecrypt extends Operation {
    constructor() {
        super();
        this.name = "Triple DES Decrypt";
        this.module = "Ciphers";
        this.description =
            "Triple DES applies DES three times to each data block for stronger encryption.";
        this.infoURL = "https://wikipedia.org/wiki/Triple_DES";
        this.inputType = "ArrayBuffer";
        this.outputType = "ArrayBuffer";
        this.args = [
            { name: "Key", type: "toggleString", value: "", toggleValues: ["Hex", "UTF8", "Latin1", "Base64"] },
            { name: "IV", type: "toggleString", value: "", toggleValues: ["Hex", "UTF8", "Latin1", "Base64"] },
            { name: "Mode", type: "option", value: ["CBC", "CFB", "OFB", "CTR", "ECB"] },
            { name: "Input", type: "option", value: ["Hex", "Raw"] },
            { name: "Output", type: "option", value: ["Raw", "Hex"] },
        ];
    }

    run(input: ArrayBuffer, args: unknown[]): ArrayBuffer {
        const keyObj = args[0] as { string: string; option: string };
        const ivObj = args[1] as { string: string; option: string };
        const mode = (args[2] as string).toLowerCase();
        const inputType = args[3] as string;
        const outputType = args[4] as string;

        let keyBytes: Buffer;
        let ivBytes: Buffer;

        if (keyObj.option === "Hex") {
            keyBytes = Buffer.from(fromHex(keyObj.string));
        } else {
            keyBytes = Buffer.from(keyObj.string, "latin1");
        }
        if (ivObj.option === "Hex") {
            ivBytes = Buffer.from(fromHex(ivObj.string));
        } else {
            ivBytes = Buffer.from(ivObj.string, "latin1");
        }

        if (keyBytes.length !== 16 && keyBytes.length !== 24) {
            throw new OperationError("Key must be 16 or 24 bytes (128 or 192 bits)");
        }
        if (mode !== "ecb" && ivBytes.length !== 8) {
            throw new OperationError("IV must be 8 bytes for Triple DES");
        }

        const algMap: Record<string, string> = {
            cbc: "des-ede3-cbc", cfb: "des-ede3-cfb", ofb: "des-ede3-ofb",
            ctr: "des-ede3-ctr", ecb: "des-ede3-ecb",
        };
        const alg = algMap[mode] ?? "des-ede3-cbc";

        let data: Buffer;
        if (inputType === "Hex") {
            data = Buffer.from(fromHex(new TextDecoder().decode(input)));
        } else {
            data = Buffer.from(new Uint8Array(input));
        }

        let decipher;
        try {
            decipher = mode === "ecb" ? createDecipheriv(alg, keyBytes, "") : createDecipheriv(alg, keyBytes, ivBytes);
        } catch (err) {
            throw new OperationError("Decryption error: " + String(err));
        }

        let decrypted: Buffer;
        try {
            decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
        } catch (err) {
            throw new OperationError("Decryption failed: " + String(err));
        }

        if (outputType === "Hex") {
            const hexStr = decrypted.toString("hex");
            return new TextEncoder().encode(hexStr).buffer as ArrayBuffer;
        }
        return decrypted.buffer.slice(decrypted.byteOffset, decrypted.byteOffset + decrypted.byteLength) as ArrayBuffer;
    }
}

export default TripleDESDecrypt;
