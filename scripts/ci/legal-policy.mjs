import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { assertCommit, INPUT_DIRECTORY, INPUT_FILES } from './inputs.mjs';

export function git(root, args, options = {}) {
  return execFileSync('git', ['--no-replace-objects', '-C', root, ...args], { maxBuffer: 4 * 1024 * 1024, ...options });
}
export function gitBlob(root, reference, path) {
  assertCommit(reference);
  const entry = git(root, ['ls-tree', '-z', reference, '--', path]).toString();
  const match = entry.match(/^100644 blob ([a-f0-9]{40})\t([^\0]+)\0$/);
  if (!match || match[2] !== path) throw new Error(`Falta blob regular 100644: ${path}`);
  return git(root, ['cat-file', 'blob', match[1]]);
}
export function gitInputs(root, reference) {
  assertCommit(reference);
  const entries = git(root, ['ls-tree', '-r', '-z', reference, '--', INPUT_DIRECTORY]).toString().split('\0').filter(Boolean);
  const paths = entries.map(entry => {
    const match = entry.match(/^100644 blob [a-f0-9]{40}\t(src\/content\/legal\/[a-zA-Z0-9._/-]+)$/);
    if (!match || match[1].split('/').some(part => part === '..' || part === '.')) throw new Error('Árbol legal con symlink, gitlink, modo o ruta no admitidos');
    return match[1];
  });
  return new Map([...paths, ...INPUT_FILES].sort().map(path => [path, gitBlob(root, reference, path)]));
}
export function verifyDraftPolicy(baseline, candidate) {
  const json = (files, path) => JSON.parse(files.get(path)?.toString('utf8') ?? 'null');
  for (const files of [baseline, candidate]) {
    assert.deepEqual(json(files, 'legal/registry.json'), { schemaVersion: 1, releases: [] }, 'Política drafts-only: no se autorizan releases');
    assert.deepEqual(json(files, 'legal/releases.lock.json'), { schemaVersion: 2, files: {}, records: {} }, 'Política drafts-only: lock vacío obligatorio');
    assert.deepEqual(json(files, 'src/config/legal-current.json'), { terminos: null, aviso_privacidad: null }, 'Política drafts-only: punteros null obligatorios');
  }
  assert.deepEqual([...candidate.keys()].sort(), [...baseline.keys()].sort(), 'No se añaden ni eliminan entradas legales');
  for (const [path, bytes] of baseline) {
    assert(candidate.get(path)?.equals(bytes), `Contenido jurídico o control congelado alterado: ${path}`);
  }
  for (const [document, count] of [['terminos', 5], ['privacidad', 13]]) {
    assert.equal((candidate.get(`src/content/legal/drafts/${document}.md`).toString().match(/\[\[POR CONFIRMAR:/g) ?? []).length, count);
  }
  // Los cinco marcadores de eliminación proceden de las fuentes auxiliares congeladas.
  return { releases: 0, markers: 23 };
}
export async function verifyHistoryWithTrustedChecker(checkerBytes, baseline, candidate) {
  const directory = mkdtempSync(join(tmpdir(), 'rlvo-trusted-checker-'));
  try {
    const path = join(directory, 'checker.mjs');
    writeFileSync(path, checkerBytes, { mode: 0o600 });
    // Solo código del baseline validado; nunca módulos, package.json o scripts del PR.
    const checker = await import(pathToFileURL(path).href);
    if (typeof checker.verifyTrustedBaseline !== 'function') throw new Error('Baseline sin checker compatible');
    checker.verifyTrustedBaseline(
      JSON.parse(baseline.get('legal/releases.lock.json')),
      JSON.parse(candidate.get('legal/releases.lock.json')),
      JSON.parse(candidate.get('legal/registry.json')),
      path => {
        const bytes = candidate.get(path);
        if (!bytes) throw new Error(`Histórico eliminado: ${path}`);
        return bytes;
      },
    );
  } finally { rmSync(directory, { recursive: true, force: true }); }
}
