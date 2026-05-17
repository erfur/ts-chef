export function isImage(buf: Uint8Array | ArrayBuffer): string | false {
    const arr = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf;
    if (arr.length < 4) return false;
    
    // JPEG
    if (arr[0] === 0xff && arr[1] === 0xd8 && arr[2] === 0xff) return "image/jpeg";
    // PNG
    if (arr[0] === 0x89 && arr[1] === 0x50 && arr[2] === 0x4e && arr[3] === 0x47) return "image/png";
    // GIF
    if (arr[0] === 0x47 && arr[1] === 0x49 && arr[2] === 0x46) return "image/gif";
    // BMP
    if (arr[0] === 0x42 && arr[1] === 0x4d) return "image/bmp";
    // TIFF
    if (arr[0] === 0x49 && arr[1] === 0x49 && arr[2] === 0x2a && arr[3] === 0x00) return "image/tiff";
    if (arr[0] === 0x4d && arr[1] === 0x4d && arr[2] === 0x00 && arr[3] === 0x2a) return "image/tiff";
    // WEBP
    if (arr[0] === 0x52 && arr[1] === 0x49 && arr[2] === 0x46 && arr[3] === 0x46) return "image/webp";

    return false;
}
