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
import { createCipheriv } from "crypto";
import { fromHex } from "../lib/Hex";

export class TripleDESEncrypt extends Operation {
    constructor() {
        super();
        this.name = "Triple DES Encrypt";
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
            { name: "Input", type: "option", value: ["Raw", "Hex"] },
            { name: "Output", type: "option", value: ["Hex", "Raw"] },
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

        let cipher;
        try {
            cipher = mode === "ecb" ? createCipheriv(alg, keyBytes, "") : createCipheriv(alg, keyBytes, ivBytes);
        } catch (err) {
            throw new OperationError("Encryption error: " + String(err));
        }

        const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);

        if (outputType === "Hex") {
            const hexStr = encrypted.toString("hex");
            return new TextEncoder().encode(hexStr).buffer as ArrayBuffer;
        }
        return encrypted.buffer.slice(encrypted.byteOffset, encrypted.byteOffset + encrypted.byteLength) as ArrayBuffer;
    }
}

export default TripleDESEncrypt;
