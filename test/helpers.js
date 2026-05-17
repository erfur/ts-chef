/** Shared test helpers */

function strToAB(str) {
    const buf = Buffer.from(str, "utf-8");
    const ab = new ArrayBuffer(buf.length);
    new Uint8Array(ab).set(buf);
    return ab;
}

function abToStr(ab) {
    return Buffer.from(new Uint8Array(ab)).toString("utf-8");
}

function byteArrToStr(arr) {
    return Buffer.from(arr).toString("utf-8");
}

function hexToAB(hex) {
    const buf = Buffer.from(hex, "hex");
    const ab = new ArrayBuffer(buf.length);
    new Uint8Array(ab).set(buf);
    return ab;
}

module.exports = { strToAB, abToStr, byteArrToStr, hexToAB };
