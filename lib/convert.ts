import sharp from 'sharp';
// heic-convert has no types; require keeps this simple in a Node runtime.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const heicConvert = require('heic-convert');

const HEIC_SIGNATURES = ['heic', 'heif', 'mif1', 'msf1', 'hevc', 'hevx'];

/** Sniffs the ISO-BMFF 'ftyp' box to tell if a buffer is actually HEIC/HEIF,
 * regardless of what the browser reported as its MIME type. */
function looksLikeHeic(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;
  const brand = buffer.toString('ascii', 8, 12).toLowerCase();
  return HEIC_SIGNATURES.includes(brand);
}

export interface ConvertResult {
  buffer: Buffer;
  originalBytes: number;
  finalBytes: number;
}

/**
 * Converts an incoming photo (HEIC or otherwise) into a compressed PNG.
 * - HEIC/HEIF is decoded via heic-convert (pure JS, no native HEIF codec needed).
 * - Everything is then normalized and compressed through sharp as PNG,
 *   using palette quantization when it won't visibly hurt quality.
 */
export async function convertToCompressedPng(input: Buffer): Promise<ConvertResult> {
  const originalBytes = input.length;
  let workingBuffer: Buffer = input;

  if (looksLikeHeic(input)) {
    const rawPng: ArrayBuffer = await heicConvert({
      buffer: input,
      format: 'PNG',
    });
    workingBuffer = Buffer.from(rawPng);
  }

  // Cap the longest edge so "screenshot-like" sizing stays sane for very
  // large iPhone originals, without visibly degrading normal photos.
  const MAX_EDGE = 2400;

  const compressed = await sharp(workingBuffer)
    .rotate() // respect EXIF orientation, then strip metadata below
    .resize({
      width: MAX_EDGE,
      height: MAX_EDGE,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .png({
      compressionLevel: 9,
      palette: true,
      quality: 90,
      effort: 8,
    })
    .toBuffer();

  return {
    buffer: compressed,
    originalBytes,
    finalBytes: compressed.length,
  };
}
