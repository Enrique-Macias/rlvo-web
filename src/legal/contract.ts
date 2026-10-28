import type { DocumentKind } from './canonical.ts';

// Contrato backend: docs/PL-016-WEB-INTEGRATION-CONTRACT.md, main 38b6b73.
export const LEGAL_TYPES = ['terminos', 'aviso_privacidad'] as const;
export type LegalType = typeof LEGAL_TYPES[number];
export const TYPE_BY_DOCUMENT: Record<DocumentKind, LegalType> = { terminos: 'terminos', privacidad: 'aviso_privacidad' };
export const DOCUMENT_BY_TYPE: Record<LegalType, DocumentKind> = { terminos: 'terminos', aviso_privacidad: 'privacidad' };
export const ACTION_BY_TYPE = { terminos: 'aceptado', aviso_privacidad: 'presentado' } as const;
export const LEGAL_ORIGIN = 'https://www.rlvo.com.mx';

export function assertVersionSlug(version: unknown): asserts version is string {
  if (typeof version !== 'string' || !/^[a-z0-9][a-z0-9.-]{0,39}$/.test(version)) {
    throw new Error('Identificador inválido: debe cumplir el CHECK de documentos_legales.version (1–40 caracteres)');
  }
  // Restricción operativa adicional: nunca reutilizar el material histórico de STAGING.
  if (version.includes('staging-prueba')) throw new Error('Identificador reservado: staging-prueba no puede reutilizarse');
}

export function assertHexDigest(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) throw new Error('SHA-256 hexadecimal inválido: se requieren 64 caracteres minúsculos');
}
export function hexToBytea(hex: string): string { assertHexDigest(hex); return `\\x${hex}`; }
export function byteaToHex(bytea: string): string {
  if (!bytea.startsWith('\\x')) throw new Error('bytea debe usar el prefijo \\x');
  const hex = bytea.slice(2); assertHexDigest(hex); return hex;
}

// Subconjunto editorial ISO 8601 de timestamptz: zona explícita, precisión de PostgreSQL.
// Comparación en microsegundos: offsets equivalentes y fracciones NO eluden UNIQUE(tipo, vigente_desde).
export function timestampMicros(value: unknown): bigint {
  if (typeof value !== 'string') throw new Error('vigente_desde debe ser un timestamp ISO con zona explícita');
  const match = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/);
  if (!match) throw new Error('vigente_desde debe ser ISO 8601 con zona explícita y hasta seis decimales');
  const [, day, hour, minute, second, fraction = '', zone] = match;
  const date = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== day || +hour > 23 || +minute > 59 || +second > 59) {
    throw new Error('vigente_desde contiene una fecha u hora inválida');
  }
  let offset = 0;
  if (zone !== 'Z') {
    const h = +zone.slice(1, 3), m = +zone.slice(4, 6);
    if (h > 14 || m > 59 || (h === 14 && m !== 0)) throw new Error('Zona horaria editorial inválida');
    offset = (zone[0] === '+' ? 1 : -1) * (h * 60 + m);
  }
  const seconds = BigInt(date.getTime() / 1000 + +hour * 3600 + +minute * 60 + +second - offset * 60);
  return seconds * 1_000_000n + BigInt(fraction.padEnd(6, '0'));
}
