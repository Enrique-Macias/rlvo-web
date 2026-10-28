import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

export const INPUT_DIRECTORY = 'src/content/legal';
export const INPUT_FILES = [
  'legal/registry.json', 'legal/releases.lock.json', 'src/config/legal-current.json',
  'docs/PL-016-WEB-INTEGRATION-CONTRACT.md', 'docs/LEGAL_FACTS.md',
  'src/content/legal.ts', 'src/pages/eliminar-cuenta.astro', 'src/config/site.ts',
];
export const INITIAL_BASELINE = 'bd46ee5a1d6e0adbc0eeab27db3c01fe76b34cc4';
export const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export function assertCommit(value) {
  if (typeof value !== 'string' || !/^[a-f0-9]{40}$/.test(value)) throw new Error('Se requiere un SHA Git completo; no hay fallback a HEAD ni al candidato inicial');
  return value;
}
export function workingInputs(root) {
  const paths = [];
  function visit(path) {
    const stat = lstatSync(resolve(root, path));
    if (stat.isSymbolicLink()) throw new Error(`Symlink legal no permitido: ${path}`);
    if (stat.isDirectory()) for (const name of readdirSync(resolve(root, path)).sort()) visit(`${path}/${name}`);
    else if (stat.isFile()) paths.push(path);
    else throw new Error(`Entrada legal no regular: ${path}`);
  }
  visit(INPUT_DIRECTORY);
  for (const path of INPUT_FILES) visit(path);
  return new Map(paths.sort().map(path => [path, readFileSync(resolve(root, path))]));
}
export function captureInputs(root) {
  const files = workingInputs(root);
  for (const path of ['package.json', 'package-lock.json']) {
    if (!lstatSync(resolve(root, path)).isFile() || lstatSync(resolve(root, path)).isSymbolicLink()) throw new Error('Manifest de paquetes no regular');
    files.set(path, readFileSync(resolve(root, path)));
  }
  return Object.fromEntries([...files].sort(([a], [b]) => a.localeCompare(b)).map(([path, bytes]) => {
    const stat = lstatSync(resolve(root, path), { bigint: true });
    return [path, { sha256: digest(bytes), bytes: bytes.length, mode: String(stat.mode),
      inode: String(stat.ino), device: String(stat.dev), mtime: String(stat.mtimeNs), ctime: String(stat.ctimeNs) }];
  }));
}
export function assertInputsUnchanged(before, after) {
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Se alteró o reescribió una entrada legal durante instalación/check/tests/build');
}
