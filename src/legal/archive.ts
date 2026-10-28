import { canonicalSha256 } from './canonical.ts';
import { assertHexDigest, hexToBytea } from './contract.ts';

export function verifyArchivedCopy(canonical: Uint8Array, archived: Uint8Array, expected: string) {
  assertHexDigest(expected);
  const original = canonicalSha256(canonical), copy = canonicalSha256(archived);
  if (original !== expected || copy !== expected || !Buffer.from(canonical).equals(Buffer.from(archived))) {
    throw new Error('Discrepancia: se bloquea el registro; fuente, copia archivada y manifiesto deben coincidir byte por byte');
  }
  return { sha256: expected, bytea: hexToBytea(expected), bytes: canonical.byteLength };
}
