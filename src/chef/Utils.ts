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

// Lazy imports to avoid circular deps - these are called at runtime
let _fromBase64: ((data: string, alph?: string, ret?: string) => string | number[]) | null = null;
let _fromHex: ((data: string, delim?: string) => number[]) | null = null;
let _fromDecimal: ((data: string, delim?: string) => number[]) | null = null;
let _fromBinary: ((data: string) => number[]) | null = null;

import { OperationError } from "./errors/OperationError";

export const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export function isWorkerEnvironment(): boolean {
    return typeof (global as any).importScripts === "function";
}

export class Utils {
    static isWorkerEnvironment = isWorkerEnvironment;

    static chr(o: number): string {
        if (o > 0xffff) {
            o -= 0x10000;
            const high = String.fromCharCode(((o >>> 10) & 0x3ff) | 0xd800);
            o = 0xdc00 | (o & 0x3ff);
            return high + String.fromCharCode(o);
        }
        return String.fromCharCode(o);
    }

    static ord(c: string): number {
        if (c.length === 2) {
            const high = c.charCodeAt(0);
            const low = c.charCodeAt(1);
            if (high >= 0xd800 && high < 0xdc00 && low >= 0xdc00 && low < 0xe000) {
                return (high - 0xd800) * 0x400 + low - 0xdc00 + 0x10000;
            }
        }
        return c.charCodeAt(0);
    }

    /**
     * Map a letter to a number in 0..25.
     * @param c - Character to convert
     * @param permissive - If true, allow case insensitivity; don't throw errors on other chars.
     * @returns Number in 0..25, or -1 if permissive and not a letter
     */
    static a2i(c: string, permissive: boolean = false): number {
        const i = Utils.ord(c);
        if (i >= 65 && i <= 90) {
            return i - 65;
        }
        if (permissive) {
            if (i >= 97 && i <= 122) {
                return i - 97;
            }
            return -1;
        }
        throw new OperationError("a2i called on non-uppercase ASCII character");
    }

    /**
     * Map a number in 0..25 to a letter.
     * @param i - Number to convert
     * @returns Character
     */
    static i2a(i: number): string {
        if (i >= 0 && i < 26) {
            return Utils.chr(i + 65);
        }
        throw new OperationError("i2a called on value outside 0..25");
    }

    static hex(c: string | number, length: number = 2): string {
        const n = typeof c === "string" ? Utils.ord(c) : c;
        return n.toString(16).padStart(length, "0");
    }

    static bin(c: string | number, length: number = 8): string {
        const n = typeof c === "string" ? Utils.ord(c) : c;
        return n.toString(2).padStart(length, "0");
    }

    static truncate(str: string, max: number, suffix: string = "..."): string {
        if (str.length > max) {
            str = str.slice(0, max - suffix.length) + suffix;
        }
        return str;
    }

    static padBytesRight(arr: number[], numBytes: number, padByte: number = 0): number[] {
        const paddedBytes = new Array(numBytes).fill(padByte);
        arr.forEach((b, i) => {
            paddedBytes[i] = b;
        });
        return paddedBytes;
    }

    static charRep(token: string): string {
        const map: Record<string, string> = {
            Space: " ",
            Percent: "%",
            Comma: ",",
            "Semi-colon": ";",
            Colon: ":",
            Tab: "\t",
            "Line feed": "\n",
            CRLF: "\r\n",
            "Forward slash": "/",
            Backslash: "\\",
            "0x": "0x",
            "\\x": "\\x",
            "Nothing (separate chars)": "",
            None: "",
        };
        return map[token] ?? "";
    }

    static regexRep(token: string): RegExp {
        const map: Record<string, RegExp> = {
            Space: /\s+/g,
            Percent: /%/g,
            Comma: /,/g,
            "Semi-colon": /;/g,
            Colon: /:/g,
            "Line feed": /\n/g,
            CRLF: /\r\n/g,
            "Forward slash": /\//g,
            Backslash: /\\/g,
            "0x with comma": /,?0x/g,
            "0x": /0x/g,
            "\\x": /\\x/g,
            None: /\s+/g,
        };
        return map[token] ?? /\s+/g;
    }

    static strToByteArray(str: string): number[] {
        if (!str) return [];
        const byteArray = new Array(str.length);
        for (let i = str.length - 1; i >= 0; i--) {
            const b = str.charCodeAt(i);
            byteArray[i] = b;
            if (b > 255) return Utils.strToUtf8ByteArray(str);
        }
        return byteArray;
    }

    static strToUtf8ByteArray(str: string): number[] {
        if (!str) return [];
        const encoder = new TextEncoder();
        return Array.from(encoder.encode(str));
    }

    static strToCharcode(str: string): number[] {
        if (!str) return [];
        const charcode: number[] = [];
        for (let i = 0; i < str.length; i++) {
            const code = str.codePointAt(i) ?? 0;
            charcode.push(code);
            if (code > 0xffff) i++;
        }
        return charcode;
    }

    static byteArrayToChars(byteArray: number[]): string {
        if (!byteArray || byteArray.length === 0) return "";
        return byteArray.map((b) => String.fromCharCode(b)).join("");
    }

    static byteArrayToUtf8(byteArray: number[]): string {
        const buf = Buffer.from(byteArray);
        return buf.toString("utf8");
    }

    static byteArrayToInt(byteArray: number[], byteorder: string): number {
        let value = 0;
        if (byteorder === "big") {
            for (let i = 0; i < byteArray.length; i++) {
                value = value * 256 + byteArray[i];
            }
        } else {
            for (let i = byteArray.length - 1; i >= 0; i--) {
                value = value * 256 + byteArray[i];
            }
        }
        return value;
    }

    static intToByteArray(value: number, length: number, byteorder: string): number[] {
        const arr = new Array(length);
        if (byteorder === "little") {
            for (let i = 0; i < length; i++) {
                arr[i] = value & 0xff;
                value = value >>> 8;
            }
        } else {
            for (let i = length - 1; i >= 0; i--) {
                arr[i] = value & 0xff;
                value = value >>> 8;
            }
        }
        return arr;
    }

    static strToArrayBuffer(str: string): ArrayBuffer {
        if (!str) return new ArrayBuffer(0);
        const arr = new Uint8Array(str.length);
        for (let i = str.length - 1; i >= 0; i--) {
            const b = str.charCodeAt(i);
            arr[i] = b;
            if (b > 255) return new TextEncoder().encode(str).buffer;
        }
        return arr.buffer;
    }

    static arrayBufferToStr(arrayBuffer: ArrayBuffer, utf8: boolean = true): string {
        const arr = new Uint8Array(arrayBuffer);
        if (utf8) {
            return new TextDecoder("utf-8").decode(arr);
        }
        return Utils.byteArrayToChars(Array.from(arr));
    }

    static parseEscapedChars(str: string): string {
        return str.replace(
            /\\([abfnrtv'"\\]|[0-3][0-7]{2}|[0-7]{1,2}|x[\da-fA-F]{2}|u[\da-fA-F]{4}|u\{[\da-fA-F]{1,6}\})/g,
            (_, a: string) => {
                switch (a[0]) {
                    case "\\":
                        return "\\";
                    case "0":
                    case "1":
                    case "2":
                    case "3":
                    case "4":
                    case "5":
                    case "6":
                    case "7":
                        return String.fromCharCode(parseInt(a, 8));
                    case "a":
                        return String.fromCharCode(7);
                    case "b":
                        return "\b";
                    case "t":
                        return "\t";
                    case "n":
                        return "\n";
                    case "v":
                        return "\v";
                    case "f":
                        return "\f";
                    case "r":
                        return "\r";
                    case '"':
                        return '"';
                    case "'":
                        return "'";
                    case "x":
                        return String.fromCharCode(parseInt(a.slice(1), 16));
                    case "u":
                        if (a[1] === "{") return String.fromCodePoint(parseInt(a.slice(2, -1), 16));
                        return String.fromCharCode(parseInt(a.slice(1), 16));
                    default:
                        return a;
                }
            }
        );
    }

    static escapeRegex(str: string): string {
        return str.replace(/([.*+?^=!:${}()|[\]/\\])/g, "\\$1");
    }

    static expandAlphRange(alphStr: string): string[] {
        const alphArr: string[] = [];
        for (let i = 0; i < alphStr.length; i++) {
            if (i < alphStr.length - 2 && alphStr[i + 1] === "-" && alphStr[i] !== "\\") {
                const start = Utils.ord(alphStr[i]);
                const end = Utils.ord(alphStr[i + 2]);
                for (let j = start; j <= end; j++) {
                    alphArr.push(Utils.chr(j));
                }
                i += 2;
            } else if (i < alphStr.length - 2 && alphStr[i] === "\\" && alphStr[i + 1] === "-") {
                alphArr.push("-");
                i++;
            } else {
                alphArr.push(alphStr[i]);
            }
        }
        return alphArr;
    }

    static printable(str: string, preserveWs: boolean = false): string {
        // Replace non-printable characters with dots
        const re =
            // eslint-disable-next-line no-control-regex
            /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/g;
        const wsRe = /[\x09-\x0d]/g;
        str = str.replace(re, ".");
        if (!preserveWs) str = str.replace(wsRe, ".");
        return str;
    }

    static mod(x: number, y: number): number {
        return ((x % y) + y) % y;
    }

    static gcd(x: number, y: number): number {
        if (!y) return x;
        return Utils.gcd(y, x % y);
    }

    static modInv(x: number, y: number): number {
        x %= y;
        for (let i = 1; i < y; i++) {
            if ((x * i) % 26 === 1) return i;
        }
        return 1;
    }

    static convertToByteArray(str: string, type: string): number[] {
        // Lazy-load to avoid circular dependency
        if (!_fromBase64) _fromBase64 = require("./lib/Base64").fromBase64;
        if (!_fromHex) _fromHex = require("./lib/Hex").fromHex;
        if (!_fromDecimal) _fromDecimal = require("./lib/Decimal").fromDecimal;
        if (!_fromBinary) _fromBinary = require("./lib/Binary").fromBinary;

        switch (type.toLowerCase()) {
            case "binary":
                return _fromBinary!(str);
            case "hex":
                return _fromHex!(str);
            case "decimal":
                return _fromDecimal!(str);
            case "base64":
                return _fromBase64!(str, undefined, "byteArray") as number[];
            case "utf8":
                return Utils.strToUtf8ByteArray(str);
            case "latin1":
            default:
                return Utils.strToByteArray(str);
        }
    }

    static convertToByteString(str: string, type: string): string {
        if (!_fromBase64) _fromBase64 = require("./lib/Base64").fromBase64;
        if (!_fromHex) _fromHex = require("./lib/Hex").fromHex;
        if (!_fromDecimal) _fromDecimal = require("./lib/Decimal").fromDecimal;
        if (!_fromBinary) _fromBinary = require("./lib/Binary").fromBinary;

        switch (type.toLowerCase()) {
            case "binary":
                return Utils.byteArrayToChars(_fromBinary!(str));
            case "hex":
                return Utils.byteArrayToChars(_fromHex!(str));
            case "decimal":
                return Utils.byteArrayToChars(_fromDecimal!(str));
            case "base64":
                return Utils.byteArrayToChars(
                    _fromBase64!(str, undefined, "byteArray") as number[]
                );
            case "utf8":
                return new TextEncoder()
                    .encode(str)
                    .reduce((a, b) => a + String.fromCharCode(b), "");
            case "latin1":
            default:
                return str;
        }
    }

    static stripHtmlTags(str: string): string {
        return str.replace(/<[^>]*>/g, "");
    }

    static escapeHtml(str: string): string {
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#x27;");
    }

    static *chunked<T>(iterable: Iterable<T>, chunksize: number): Generator<T[]> {
        const iterator = iterable[Symbol.iterator]();
        while (true) {
            const res: T[] = [];
            let next = iterator.next();
            while (!next.done && res.length < chunksize) {
                res.push(next.value);
                next = iterator.next();
            }
            if (res.length) yield res;
            if (next.done) break;
        }
    }

    static parseCSV(
        data: string,
        cellDelims: string[] = [","],
        lineDelims: string[] = ["\n", "\r"]
    ): string[][] {
        let b,
            next,
            renderNext = false,
            inString = false,
            cell = "",
            line: string[] = [];
        const lines: string[][] = [];

        // Remove BOM, often present in Excel CSV files
        if (data.length && data.charCodeAt(0) === 0xfeff) {
            data = data.slice(1);
        }

        for (let i = 0; i < data.length; i++) {
            b = data[i];
            next = data[i + 1] || "";
            if (renderNext) {
                cell += b;
                renderNext = false;
            } else if (b === '"' && !inString) {
                inString = true;
            } else if (b === '"' && inString) {
                if (next === '"') {
                    renderNext = true;
                } else {
                    inString = false;
                }
            } else if (!inString && cellDelims.indexOf(b) >= 0) {
                line.push(cell);
                cell = "";
            } else if (!inString && lineDelims.indexOf(b) >= 0) {
                line.push(cell);
                cell = "";
                lines.push(line);
                line = [];
                // Skip next byte if it is also a line delim (e.g. \r\n)
                if (lineDelims.indexOf(next) >= 0 && next !== b) {
                    i++;
                }
            } else {
                cell += b;
            }
        }

        if (line.length) {
            line.push(cell);
            lines.push(line);
        }

        return lines;
    }
}

export default Utils;
