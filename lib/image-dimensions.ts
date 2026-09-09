/**
 * Minimal PNG/JPEG dimension reader with no external dependency (Principle V —
 * not worth a whole image-processing library for one square-aspect check).
 * Returns null for formats it doesn't recognize (GIF/WebP/etc.) — callers
 * should treat null as "can't verify, don't block the upload," since this is a
 * UX nicety (FR-035), not an authorization boundary.
 */
export function getImageDimensions(buf: Uint8Array): { width: number; height: number } | null {
  // PNG: 8-byte signature, then IHDR chunk with width/height as big-endian u32 at offset 16/20.
  if (
    buf.length >= 24 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }

  // JPEG: scan markers for the first SOF0/SOF2 segment.
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    let offset = 2;
    while (offset + 9 < buf.length) {
      if (buf[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marker = buf[offset + 1]!;
      const isSOF =
        (marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf);
      if (isSOF) {
        const height = view.getUint16(offset + 5);
        const width = view.getUint16(offset + 7);
        return { width, height };
      }
      const segmentLength = view.getUint16(offset + 2);
      offset += 2 + segmentLength;
    }
  }

  return null;
}
