export function removeEXIF(data: ArrayBuffer | Uint8Array): ArrayBuffer {
    // Stub: returns input unchanged
    if (data instanceof ArrayBuffer) return data;
    return data.buffer;
}
