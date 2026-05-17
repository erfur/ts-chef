"use strict";
/**
 * Round-trip tests for Base32/45/58/62/85/92.
 */
const { strToAB, byteArrToStr } = require("./helpers");

const SAMPLES = ["hello", "hello world", "a", "abc", "0123456789"];

function abEncodeDecode(ToOp, FromOp, toArgs, fromArgs, sample) {
    const enc = new ToOp().run(strToAB(sample), toArgs);
    expect(typeof enc).toBe("string");
    expect(enc).not.toContain("undefined");
    const dec = new FromOp().run(enc, fromArgs);
    return byteArrToStr(dec);
}

function byteEncodeDecode(ToOp, FromOp, toArgs, fromArgs, sample) {
    const bytes = Array.from(Buffer.from(sample, "utf-8"));
    const enc = new ToOp().run(bytes, toArgs);
    expect(typeof enc).toBe("string");
    expect(enc).not.toContain("undefined");
    const dec = new FromOp().run(enc, fromArgs);
    return byteArrToStr(dec);
}

// ── Base32 ────────────────────────────────────────────────────────────────────
describe("Base32 round-trips", () => {
    const { ToBase32 }   = require("../dist/chef/operations/ToBase32");
    const { FromBase32 } = require("../dist/chef/operations/FromBase32");

    test.each(SAMPLES)("%p", (s) => {
        expect(abEncodeDecode(ToBase32, FromBase32, ["A-Z2-7=", true], ["A-Z2-7=", true], s)).toBe(s);
    });
    test("output is valid Base32 charset", () => {
        const enc = new ToBase32().run(strToAB("hello"), ["A-Z2-7=", true]);
        expect(enc).toMatch(/^[A-Z2-7=]+$/);
    });
});

// ── Base45 ────────────────────────────────────────────────────────────────────
describe("Base45 round-trips", () => {
    const { ToBase45 }   = require("../dist/chef/operations/ToBase45");
    const { FromBase45 } = require("../dist/chef/operations/FromBase45");

    test.each(SAMPLES)("%p", (s) => {
        expect(abEncodeDecode(ToBase45, FromBase45, [], [], s)).toBe(s);
    });
});

// ── Base58 ────────────────────────────────────────────────────────────────────
describe("Base58 round-trips", () => {
    const { ToBase58 }   = require("../dist/chef/operations/ToBase58");
    const { FromBase58 } = require("../dist/chef/operations/FromBase58");

    test.each(SAMPLES)("Bitcoin: %p", (s) => {
        expect(byteEncodeDecode(ToBase58, FromBase58, ["Bitcoin"], ["Bitcoin"], s)).toBe(s);
    });
    test("Ripple alphabet", () => {
        expect(byteEncodeDecode(ToBase58, FromBase58, ["Ripple"], ["Ripple"], "hello")).toBe("hello");
    });
    test("output is alphanumeric without 0OIl", () => {
        const enc = new ToBase58().run(Array.from(Buffer.from("hello")), ["Bitcoin"]);
        expect(enc).toMatch(/^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/);
    });
});

// ── Base62 ────────────────────────────────────────────────────────────────────
describe("Base62 round-trips", () => {
    const { ToBase62 }   = require("../dist/chef/operations/ToBase62");
    const { FromBase62 } = require("../dist/chef/operations/FromBase62");

    test.each(SAMPLES)("%p", (s) => {
        expect(byteEncodeDecode(ToBase62, FromBase62, [], [], s)).toBe(s);
    });
    test("output is alphanumeric only", () => {
        const enc = new ToBase62().run(Array.from(Buffer.from("hello")), []);
        expect(enc).toMatch(/^[A-Za-z0-9]+$/);
    });
});

// ── Base85 ────────────────────────────────────────────────────────────────────
describe("Base85 round-trips", () => {
    const { ToBase85 }   = require("../dist/chef/operations/ToBase85");
    const { FromBase85 } = require("../dist/chef/operations/FromBase85");

    test.each(["ASCII85", "RFC 1924", "Z85"])("alphabet %s: hello", (alph) => {
        const enc = new ToBase85().run(strToAB("hello"), [alph, false]);
        const dec = new FromBase85().run(enc, [alph, false]);
        expect(byteArrToStr(dec)).toBe("hello");
    });
    test("ASCII85 longer string", () => {
        const s = "The quick brown fox";
        const enc = new ToBase85().run(strToAB(s), ["ASCII85", false]);
        expect(byteArrToStr(new FromBase85().run(enc, ["ASCII85", false]))).toBe(s);
    });
    test("ASCII85 delimiters", () => {
        const enc = new ToBase85().run(strToAB("hello"), ["ASCII85", true]);
        expect(enc).toMatch(/^<~.*~>$/);
        expect(byteArrToStr(new FromBase85().run(enc, ["ASCII85", true]))).toBe("hello");
    });
});

// ── Base92 ────────────────────────────────────────────────────────────────────
describe("Base92 round-trips", () => {
    const { ToBase92 }   = require("../dist/chef/operations/ToBase92");
    const { FromBase92 } = require("../dist/chef/operations/FromBase92");

    const BASE92_SAMPLES = [...SAMPLES, "The quick brown fox jumps over the lazy dog"];

    test.each(BASE92_SAMPLES)("%p", (s) => {
        const enc = new ToBase92().run(strToAB(s), []);
        expect(enc).not.toContain("undefined");
        expect(byteArrToStr(new FromBase92().run(enc, []))).toBe(s);
    });

    test("empty string", () => {
        expect(new ToBase92().run(strToAB(""), [])).toBe("");
        expect(byteArrToStr(new FromBase92().run("", []))).toBe("");
    });

    test("no undefined in long output", () => {
        const enc = new ToBase92().run(strToAB("A".repeat(100)), []);
        expect(enc).not.toContain("undefined");
        expect(enc.length).toBeGreaterThan(0);
    });
});
