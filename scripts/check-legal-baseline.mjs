// Ejecutar esta copia DESDE la referencia protegida en CI, nunca desde el PR.
// Solo Node built-ins: no importa ni ejecuta código del árbol que se audita.
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const digestRecord = (entry) => hash(Buffer.from(JSON.stringify({ tipo: entry.tipo, version: entry.version,
  vigente_desde: entry.vigente_desde, url: entry.url, contenido_sha256: entry.contenido_sha256 }) + '\n'));

export function verifyTrustedBaseline(previous, candidate, registry, readBytes) {
  if (previous.schemaVersion !== 2 || candidate.schemaVersion !== 2) throw new Error('Formato de baseline no admitido');
  for (const [path, expected] of Object.entries(previous.files)) {
    if (!/^src\/content\/legal\/releases\/(terminos|privacidad)\/[a-z0-9][a-z0-9.-]{0,39}\/document\.md$/.test(path)) throw new Error('Ruta inválida en baseline');
    const actual = candidate.files[path];
    if (!actual || actual.sha256 !== expected.sha256 || actual.bytes !== expected.bytes) throw new Error(`Lock histórico reescrito o eliminado: ${path}`);
    const bytes = readBytes(path);
    if (bytes.length !== expected.bytes || hash(bytes) !== expected.sha256) throw new Error(`Bytes históricos alterados: ${path}`);
  }
  for (const [id, expected] of Object.entries(previous.records)) {
    const entries = registry.releases.filter((entry) => `${entry.tipo}/${entry.version}` === id);
    if (candidate.records[id] !== expected || entries.length !== 1 || digestRecord(entries[0]) !== expected) {
      throw new Error(`Registro histórico eliminado, sustituido o identificador reutilizado: ${id}`);
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (!args.length && process.env.LEGAL_BASELINE_REF) args.push('--baseline-ref', process.env.LEGAL_BASELINE_REF);
  if (args.length && (args[0] !== '--baseline-ref' || args.length !== 2 || !args[1] || args[1].startsWith('-'))) throw new Error('Uso: node scripts/check-legal-baseline.mjs [--baseline-ref ref-git-protegida]');
  if (process.env.CI && (!args[1] || !/^[a-f0-9]{40}$/.test(args[1]))) throw new Error('CI exige --baseline-ref SHA completo de una referencia protegida externa al PR');
  const reference = args[1] ?? 'HEAD';
  const commit = execFileSync('git', ['rev-parse', '--verify', `${reference}^{commit}`], { encoding: 'utf8' }).trim();
  const root = realpathSync(process.cwd());
  const candidate = JSON.parse(readFileSync('legal/releases.lock.json', 'utf8'));
  const registry = JSON.parse(readFileSync('legal/registry.json', 'utf8'));
  const tree = execFileSync('git', ['ls-tree', commit, '--', 'legal/releases.lock.json'], { encoding: 'utf8' });
  if (!tree.trim()) {
    if (args[1] || process.env.CI || Object.keys(candidate.files).length || Object.keys(candidate.records).length || registry.releases.length) {
      throw new Error('La referencia protegida no contiene el lock; se requiere bootstrap revisado, sin bypass de CI');
    }
    console.log('Bootstrap local: HEAD aún no contiene el lock; solo se permite estado sin releases. CI requiere una referencia inicial aprobada.');
  } else {
    const previous = JSON.parse(execFileSync('git', ['show', `${commit}:legal/releases.lock.json`], { encoding: 'utf8' }));
    verifyTrustedBaseline(previous, candidate, registry, (path) => {
      const full = realpathSync(resolve(root, path));
      if (!full.startsWith(root + sep) || !statSync(full).isFile()) throw new Error('Canónico fuera del repositorio o no regular');
      return readFileSync(full);
    });
    console.log(`Históricos contrastados contra ${commit}.`);
  }
}
