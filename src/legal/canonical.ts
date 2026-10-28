import { createHash } from 'node:crypto';

export const CANONICAL_PROFILE = 'rlvo-markdown-utf8-nfc-lf-1';
export const DOCUMENTS = ['terminos', 'privacidad'] as const;
export type DocumentKind = typeof DOCUMENTS[number];

export function normalizeCanonical(input: Uint8Array): Buffer {
  const decoded = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(input);
  const text = decoded.replace(/^\uFEFF/, '').normalize('NFC')
    .replace(/\r\n?/g, '\n').replace(/[\t ]+$/gm, '').replace(/\n*$/, '\n');
  if (!text.trim() || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFEFF]/.test(text)) {
    throw new Error('El documento está vacío o contiene caracteres de control no admitidos');
  }
  return Buffer.from(text, 'utf8');
}

export function assertCanonical(bytes: Uint8Array): void {
  if (!Buffer.from(bytes).equals(normalizeCanonical(bytes))) {
    throw new Error('Bytes no canónicos: se requiere UTF-8 sin BOM, NFC, LF, sin espacios finales y un único LF final');
  }
}

export function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export function canonicalSha256(bytes: Uint8Array): string {
  assertCanonical(bytes);
  return sha256(bytes);
}

export interface LegalSection { id: string; title: string }
export interface CanonicalDocument {
  title: string;
  intro: string;
  date: string;
  body: string;
  sections: LegalSection[];
}

export function parseCanonicalDocument(bytes: Uint8Array): CanonicalDocument {
  assertCanonical(bytes);
  const text = Buffer.from(bytes).toString('utf8');
  const header = text.match(/^# ([^\n]+)\n\n([^\n]+)\n\nÚltima actualización: ([^\n]+)\n\n([\s\S]+)$/);
  if (!header) throw new Error('Cabecera canónica inválida: título, introducción y fecha son obligatorios');
  if (/<[A-Za-z!/]|\{(?!#[a-z][a-z0-9-]*\})|^---\s*$|^import\s|^export\s|^```|^~~~/m.test(text)) {
    throw new Error('El Markdown legal no admite HTML, frontmatter, código ni interpolaciones');
  }
  const body = header[4];
  const sections: LegalSection[] = [];
  for (const line of body.split('\n')) {
    if (/^#\s|^#{4,}\s/.test(line)) throw new Error('Jerarquía de encabezados legales inválida');
    if (!line.startsWith('## ')) continue;
    const heading = line.match(/^## (.+) \{#([a-z][a-z0-9-]*)\}$/);
    if (!heading) throw new Error('Cada sección h2 necesita un identificador explícito {#id}');
    if (['inicio', 'contenido-principal'].includes(heading[2]) || /^legal-(?:heading|subheading)-/.test(heading[2])) {
      throw new Error('Identificador de sección reservado para la navegación del sitio');
    }
    if (sections.some((section) => section.id === heading[2])) throw new Error('Identificador de sección duplicado');
    sections.push({ id: heading[2], title: heading[1] });
  }
  if (!sections.length || !body.startsWith('## ')) throw new Error('El cuerpo debe comenzar con una sección h2');
  return { title: header[1], intro: header[2], date: header[3], body, sections };
}

export function assertPublishable(bytes: Uint8Array): void {
  const doc = parseCanonicalDocument(bytes);
  const text = Buffer.from(bytes).toString('utf8');
  if (/\[\[(?:POR CONFIRMAR|PENDIENTE|VALIDAR CON ABOGADO)|\bBorrador\b/i.test(text)) {
    throw new Error('Un borrador o documento con pendientes no puede convertirse en release');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(doc.date) || Number.isNaN(Date.parse(doc.date + 'T00:00:00Z')) ||
    new Date(doc.date + 'T00:00:00Z').toISOString().slice(0, 10) !== doc.date) {
    throw new Error('La fecha de un release debe ser una fecha ISO real y confirmada');
  }
}

export interface FileDigest { sha256: string; bytes: number }
export type HistoryFiles = Record<string, FileDigest>;

export function verifyHistoricalFiles(expected: HistoryFiles, actual: Map<string, Uint8Array>): void {
  for (const [path, fingerprint] of Object.entries(expected)) {
    const bytes = actual.get(path);
    if (!bytes) throw new Error(`Histórico eliminado: ${path}`);
    if (sha256(bytes) !== fingerprint.sha256 || bytes.byteLength !== fingerprint.bytes) {
      throw new Error(`Histórico modificado: ${path}`);
    }
  }
}

export function verifyAppendOnly(previous: HistoryFiles, next: HistoryFiles): void {
  for (const [path, fingerprint] of Object.entries(previous)) {
    const candidate = next[path];
    if (!candidate || candidate.sha256 !== fingerprint.sha256 || candidate.bytes !== fingerprint.bytes) {
      throw new Error(`El registro histórico debe conservar la entrada original: ${path}`);
    }
  }
}
