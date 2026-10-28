import { readFileSync, realpathSync, statSync } from 'node:fs';
import { LEGAL_TYPES, DOCUMENT_BY_TYPE, assertVersionSlug, type LegalType } from '../src/legal/contract.ts';
import { getLegalEntry, loadLegalState } from '../src/legal/registry.ts';
import { verifyArchivedCopy } from '../src/legal/archive.ts';

const [tipo, version, path, ...extra] = process.argv.slice(2);
if (!LEGAL_TYPES.includes(tipo as LegalType) || !version || !path || extra.length) throw new Error('Uso: npm run compare:legal -- <terminos|aviso_privacidad> <version> <copia-archivada.md>');
assertVersionSlug(version);
const release = loadLegalState().releases.find((entry) => entry.tipo === tipo && entry.version === version);
if (!release) throw new Error('No existe un release registrado; no se comparan borradores para activar PL-016');
const source = getLegalEntry(DOCUMENT_BY_TYPE[tipo as LegalType], version);
const archivedStat = statSync(path), sourceStat = statSync(source.sourcePath);
if (!archivedStat.isFile() || realpathSync(path) === realpathSync(source.sourcePath) ||
  (archivedStat.dev === sourceStat.dev && archivedStat.ino === sourceStat.ino)) {
  throw new Error('Se requiere una copia independiente; no comparar el archivo consigo mismo o con un enlace a él');
}
console.log(JSON.stringify(verifyArchivedCopy(source.bytes, readFileSync(path), release.contenido_sha256), null, 2));
console.log('Comparación local correcta. No autoriza ni ejecuta INSERT, activación o escritura en el archivo móvil.');
