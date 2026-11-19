type Info = { width: number; height: number; remove?: [number, number][] };
const u32 = (b: Uint8Array, p: number, little = false) => new DataView(b.buffer, b.byteOffset, b.byteLength).getUint32(p, little);
const u16 = (b: Uint8Array, p: number) => b[p]! * 256 + b[p + 1]!;
const ascii = (b: Uint8Array, p: number, n: number) => String.fromCharCode(...b.subarray(p, p + n));
const valid = (w: number, h: number) => w > 0 && h > 0;

/** Container checks are defense in depth. Compressed pixels must also be decoded by Images. */
export function imageInfo(b: Uint8Array, mime: string): Info | null {
  try {
    if (mime === 'image/jpeg') return jpeg(b);
    if (mime === 'image/png') {
      if (ascii(b, 0, 8) !== '\x89PNG\r\n\x1a\n') return null;
      let p = 8, width = 0, height = 0, data = false, endedData = false;
      while (p + 12 <= b.length) {
        const n = u32(b, p), type = ascii(b, p + 4, 4), end = p + 12 + n;
        if (end > b.length || (p === 8 && (type !== 'IHDR' || n !== 13)) || type === 'acTL') return null;
        let crc = 0xffffffff;
        for (let i = p + 4; i < end - 4; i++) { crc ^= b[i]!; for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
        if (((crc ^ 0xffffffff) >>> 0) !== u32(b, end - 4)) return null;
        if (type === 'IHDR') { if (p !== 8) return null; width = u32(b, p + 8); height = u32(b, p + 12); }
        if (type === 'IDAT') { if (endedData) return null; data = true; } else if (data) endedData = true;
        if (type === 'IEND') return n === 0 && end === b.length && data && valid(width, height) ? { width, height } : null;
        p = end;
      }
    }
    if (mime === 'image/webp') {
      if (ascii(b, 0, 4) !== 'RIFF' || u32(b, 4, true) !== b.length - 8 || ascii(b, 8, 4) !== 'WEBP') return null;
      let p = 12, width = 0, height = 0, pixels = 0;
      while (p + 8 <= b.length) {
        const type = ascii(b, p, 4), n = u32(b, p + 4, true), s = p + 8, end = s + n + (n % 2);
        if (end > b.length || type === 'ANIM' || type === 'ANMF') return null;
        if (type === 'VP8X') {
          if (n !== 10 || (b[s]! & 2)) return null;
          width = 1 + b[s + 4]! + (b[s + 5]! << 8) + (b[s + 6]! << 16);
          height = 1 + b[s + 7]! + (b[s + 8]! << 8) + (b[s + 9]! << 16);
        }
        if (type === 'VP8 ') {
          if (n < 10 || ascii(b, s + 3, 3) !== '\x9d\x01\x2a') return null;
          const w = (b[s + 6]! | b[s + 7]! << 8) & 0x3fff, h = (b[s + 8]! | b[s + 9]! << 8) & 0x3fff;
          if (width && (w !== width || h !== height)) return null;
          width = w; height = h; pixels++;
        }
        if (type === 'VP8L') {
          if (n < 5 || b[s] !== 0x2f) return null;
          const bits = u32(b, s + 1, true), w = (bits & 0x3fff) + 1, h = ((bits >>> 14) & 0x3fff) + 1;
          if (width && (w !== width || h !== height)) return null;
          width = w; height = h; pixels++;
        }
        p = end;
      }
      return p === b.length && pixels === 1 && valid(width, height) ? { width, height } : null;
    }
  } catch { /* malformed bounds */ }
  return null;
}

function jpeg(b: Uint8Array): Info | null {
  if (b.length < 4 || b[0] !== 255 || b[1] !== 216) return null;
  let p = 2, width = 0, height = 0, scan = false, hadScan = false;
  const remove: [number, number][] = [];
  while (p < b.length) {
    if (scan && b[p] !== 255) { p++; continue; }
    const start = p;
    if (b[p++] !== 255) return null;
    while (b[p] === 255) p++;
    const marker = b[p++];
    if (scan && (marker === 0 || (marker !== undefined && marker >= 0xd0 && marker <= 0xd7))) continue;
    scan = false;
    if (marker === 0xd9) return p === b.length && hadScan && valid(width, height) ? { width, height, remove } : null;
    if (marker === undefined || marker === 0 || marker === 0xd8 || marker === 1 || (marker >= 0xd0 && marker <= 0xd7) || p + 2 > b.length) return null;
    const length = u16(b, p), end = p + length;
    if (length < 2 || end > b.length) return null;
    if (marker === 0xc0 || marker === 0xc2) {
      if (length < 8 || width) return null;
      height = u16(b, p + 3); width = u16(b, p + 5);
    } else if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return null;
    if ((marker >= 0xe0 && marker <= 0xef) || marker === 0xfe) remove.push([start, end]);
    if (marker === 0xda) { if (!width) return null; scan = true; hadScan = true; }
    p = end;
  }
  return null;
}

/** Enforce no inherited APP/COM metadata even if a codec ignores metadata:none (offline mock does). */
export function cleanJpeg(b: Uint8Array): Uint8Array | null {
  const info = imageInfo(b, 'image/jpeg');
  if (!info || info.width !== 1200 || info.height !== 630) return null;
  const out = new Uint8Array(b.length - (info.remove ?? []).reduce((n, [a, z]) => n + z - a, 0));
  let p = 0, offset = 0;
  for (const [a, z] of info.remove ?? []) { out.set(b.subarray(p, a), offset); offset += a - p; p = z; }
  out.set(b.subarray(p), offset);
  return out;
}
