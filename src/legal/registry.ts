import { readFileSync, readdirSync, lstatSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  CANONICAL_PROFILE, assertPublishable, canonicalSha256, parseCanonicalDocument, sha256,
  verifyHistoricalFiles, verifyAppendOnly, type CanonicalDocument, type DocumentKind, type HistoryFiles,
} from './canonical.ts';
import {
  LEGAL_TYPES, DOCUMENT_BY_TYPE, TYPE_BY_DOCUMENT, LEGAL_ORIGIN, assertVersionSlug, assertHexDigest,
  timestampMicros, type LegalType,
} from './contract.ts';
export { assertVersionSlug } from './contract.ts';

// Solo columnas reales del catálogo; contenido_sha256 es hex aquí y bytea de 32 bytes en PostgreSQL.
export interface CatalogRelease { tipo: LegalType; version: string; vigente_desde: string; url: string; contenido_sha256: string }
export interface ReleaseReference extends CatalogRelease { document: DocumentKind }
export type CurrentVersions = Record<LegalType, string | null>;
export interface ReleaseLock { schemaVersion: 2; files: HistoryFiles; records: Record<string, string> }
export interface LegalEntry extends CanonicalDocument {
  document: DocumentKind; version: string | null; draft: boolean; bytes: Buffer; sha256: string; sourcePath: string;
}

function object(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Objeto de registro legal inválido');
}
function keys(value: Record<string, unknown>, expected: string[]): void {
  if (Object.keys(value).sort().join(',') !== expected.sort().join(',')) throw new Error('Campos inesperados en el registro legal');
}
export function catalogRecord(entry: CatalogRelease): CatalogRelease {
  return { tipo: entry.tipo, version: entry.version, vigente_desde: entry.vigente_desde, url: entry.url, contenido_sha256: entry.contenido_sha256 };
}
export const releaseId = (entry: Pick<CatalogRelease, 'tipo' | 'version'>) => `${entry.tipo}/${entry.version}`;
export const recordDigest = (entry: CatalogRelease) => sha256(Buffer.from(JSON.stringify(catalogRecord(entry)) + '\n', 'utf8'));

export function parseReleaseRegistry(value: unknown): ReleaseReference[] {
  object(value); keys(value, ['schemaVersion', 'releases']);
  if (value.schemaVersion !== 1 || !Array.isArray(value.releases)) throw new Error('Registro legal inválido');
  const releases: ReleaseReference[] = [];
  for (const entry of value.releases) {
    object(entry); keys(entry, ['tipo', 'version', 'vigente_desde', 'url', 'contenido_sha256']);
    if (!LEGAL_TYPES.includes(entry.tipo as LegalType)) throw new Error('Tipo legal desconocido');
    const tipo = entry.tipo as LegalType;
    assertVersionSlug(entry.version); assertHexDigest(entry.contenido_sha256);
    const instant = timestampMicros(entry.vigente_desde);
    const document = DOCUMENT_BY_TYPE[tipo];
    // Más estricto que el CHECK HTTPS: origen aprobado y segmento exacto de versión.
    if (entry.url !== `${LEGAL_ORIGIN}/${document}/${entry.version}`) throw new Error('URL inmutable incorrecta: debe coincidir exactamente con tipo y version');
    if (releases.some((previous) => previous.tipo === tipo && previous.version === entry.version)) throw new Error('Release duplicado: PK (tipo, version)');
    if (releases.some((previous) => previous.tipo === tipo && timestampMicros(previous.vigente_desde) === instant)) {
      throw new Error('Vigencia duplicada: UNIQUE (tipo, vigente_desde)');
    }
    releases.push({ tipo, document, version: entry.version, vigente_desde: entry.vigente_desde as string, url: entry.url as string, contenido_sha256: entry.contenido_sha256 });
  }
  return releases;
}

export function parseCurrent(value: unknown, releases: ReleaseReference[], now = BigInt(Date.now()) * 1000n): CurrentVersions {
  object(value); keys(value, [...LEGAL_TYPES]);
  for (const tipo of LEGAL_TYPES) {
    const version = value[tipo];
    if (version === null) continue;
    assertVersionSlug(version);
    const release = releases.find((entry) => entry.tipo === tipo && entry.version === version);
    if (!release) throw new Error(`Puntero vigente sin release: ${tipo}`);
    if (timestampMicros(release.vigente_desde) > now) throw new Error(`Puntero vigente anticipado: ${tipo}`);
  }
  return value as CurrentVersions;
}

export function parseHistory(value: unknown): ReleaseLock {
  object(value); keys(value, ['schemaVersion', 'files', 'records']); object(value.files); object(value.records);
  if (value.schemaVersion !== 2) throw new Error('Versión del lock inválida');
  const files: HistoryFiles = {}, records: Record<string, string> = {};
  for (const [path, fingerprint] of Object.entries(value.files)) {
    if (!/^src\/content\/legal\/releases\/(terminos|privacidad)\/[^/]+\/document\.md$/.test(path)) throw new Error('Ruta histórica inválida');
    assertVersionSlug(path.split('/')[5]); object(fingerprint); keys(fingerprint, ['sha256', 'bytes']);
    assertHexDigest(fingerprint.sha256);
    if (typeof fingerprint.bytes !== 'number' || !Number.isSafeInteger(fingerprint.bytes) || fingerprint.bytes <= 0) throw new Error('Tamaño histórico inválido');
    files[path] = { sha256: fingerprint.sha256, bytes: fingerprint.bytes };
  }
  for (const [id, digest] of Object.entries(value.records)) {
    const [tipo, version, extra] = id.split('/');
    if (!LEGAL_TYPES.includes(tipo as LegalType) || extra !== undefined) throw new Error('Identificador histórico inválido');
    assertVersionSlug(version); assertHexDigest(digest); records[id] = digest;
  }
  return { schemaVersion: 2, files, records };
}
export function verifyReleaseLock(previous: ReleaseLock, next: ReleaseLock): void {
  verifyAppendOnly(previous.files, next.files);
  for (const [id, digest] of Object.entries(previous.records)) {
    if (next.records[id] !== digest) throw new Error(`Identificador histórico eliminado o reutilizado: ${id}`);
  }
}
export function releaseSourcePath(entry: Pick<ReleaseReference, 'document' | 'version'>): string {
  assertVersionSlug(entry.version); return `src/content/legal/releases/${entry.document}/${entry.version}/document.md`;
}
export function loadLegalState(root = process.cwd()) {
  const json = (path: string): unknown => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
  const releases = parseReleaseRegistry(json('legal/registry.json'));
  const current = parseCurrent(json('src/config/legal-current.json'), releases);
  const history = parseHistory(json('legal/releases.lock.json'));
  const sources = new Map<string, Uint8Array>();
  const registered = new Set(releases.map(releaseSourcePath));
  if (Object.keys(history.files).length !== releases.length || Object.keys(history.records).length !== releases.length) throw new Error('Registro y lock deben contener exactamente los mismos releases');
  for (const entry of releases) {
    const path = releaseSourcePath(entry);
    if (!history.files[path] || history.records[releaseId(entry)] !== recordDigest(entry)) throw new Error('Release sin lock válido o metadata sustituida');
    const fullPath = resolve(root, path);
    if (lstatSync(fullPath).isSymbolicLink()) throw new Error('El canónico no puede ser un enlace simbólico');
    const bytes = readFileSync(fullPath); assertPublishable(bytes);
    if (canonicalSha256(bytes) !== entry.contenido_sha256) throw new Error('SHA-256 del catálogo no coincide con los bytes canónicos');
    sources.set(path, bytes);
  }
  verifyHistoricalFiles(history.files, sources);
  for (const file of readdirSync(resolve(root, 'src/content/legal/releases'), { recursive: true })) {
    if (typeof file === 'string' && file.endsWith('.md') && !registered.has(`src/content/legal/releases/${file}`)) throw new Error('Archivo de release no registrado');
  }
  return { releases, current, history };
}

export function getDraftEntry(document: DocumentKind, root = process.cwd()): LegalEntry {
  const sourcePath = `src/content/legal/drafts/${document}.md`;
  const bytes = readFileSync(resolve(root, sourcePath));
  return { ...parseCanonicalDocument(bytes), document, version: null, draft: true, bytes, sha256: canonicalSha256(bytes), sourcePath };
}
export function getLegalEntry(document: DocumentKind, version: string | null = null, root = process.cwd()): LegalEntry {
  const state = loadLegalState(root);
  const selected = version ?? state.current[TYPE_BY_DOCUMENT[document]];
  if (selected !== null) {
    assertVersionSlug(selected);
    if (!state.releases.some((entry) => entry.document === document && entry.version === selected)) throw new Error('Versión legal inexistente');
  }
  if (selected === null) return getDraftEntry(document, root);
  const sourcePath = releaseSourcePath({ document, version: selected });
  const bytes = readFileSync(resolve(root, sourcePath));
  return { ...parseCanonicalDocument(bytes), document, version: selected, draft: selected === null, bytes, sha256: canonicalSha256(bytes), sourcePath };
}
export function getReleaseReferences(document?: DocumentKind): ReleaseReference[] {
  return loadLegalState().releases.filter((entry) => !document || entry.document === document);
}
export function technicalManifest(root = process.cwd()) {
  const state = loadLegalState(root);
  return { format: 'rlvo-legal-manifest', formatVersion: 1, canonicalProfile: CANONICAL_PROFILE,
    hashAlgorithm: 'SHA-256', hashEncoding: 'hex', current: state.current,
    releases: state.releases.map((entry) => ({ ...catalogRecord(entry),
      canonical_url: `${LEGAL_ORIGIN}/legal/${entry.document}/${entry.version}.md`,
      checksum_url: `${LEGAL_ORIGIN}/legal/${entry.document}/${entry.version}.sha256`,
      bytes: state.history.files[releaseSourcePath(entry)].bytes,
    })) };
}
