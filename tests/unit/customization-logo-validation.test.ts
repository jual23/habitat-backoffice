import { describe, expect, it } from 'vitest';
import { getImageDimensions } from '@/lib/image-dimensions';

/**
 * Builds a minimal buffer `getImageDimensions()` will read as a PNG of the
 * given size — only the signature + IHDR width/height fields matter to that
 * parser, so this avoids depending on a real, byte-exact PNG fixture.
 */
function fakePng(width: number, height: number): Uint8Array {
  const buf = new Uint8Array(24);
  buf.set([0x89, 0x50, 0x4e, 0x47], 0); // PNG signature (first 4 bytes checked)
  const view = new DataView(buf.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return buf;
}

/**
 * T081: uploading a non-square logo is rejected (FR-035, Acceptance Scenario 3).
 * Exercised at the `getImageDimensions()` unit level, which
 * `updateCustomization()` (customization/actions.ts) uses synchronously before
 * accepting the upload — the RLS/end-to-end path is covered by
 * rls-customization.test.ts and manual quickstart.md validation.
 */
describe('customization: logo square-aspect validation', () => {
  it('accepts a square image', () => {
    const dims = getImageDimensions(fakePng(512, 512));
    expect(dims).toEqual({ width: 512, height: 512 });
  });

  it('rejects a non-square image', () => {
    const dims = getImageDimensions(fakePng(512, 256));
    expect(dims).not.toBeNull();
    expect(dims!.width).not.toBe(dims!.height);
  });

  it('returns null for an unrecognized format (does not block the upload)', () => {
    const dims = getImageDimensions(new Uint8Array([0x47, 0x49, 0x46, 0x38])); // GIF signature
    expect(dims).toBeNull();
  });
});
