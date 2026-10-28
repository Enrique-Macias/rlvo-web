import { lstatSync, readFileSync, writeFileSync } from 'node:fs';
import { DOCUMENTS, assertCanonical, normalizeCanonical } from '../src/legal/canonical.ts';

const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && args[0] !== '--write')) throw new Error('Uso: npm run normalize:legal -- [--write]');
for (const document of DOCUMENTS) {
  // No se admite una ruta arbitraria: este comando jamás escribe releases.
  const path = `src/content/legal/drafts/${document}.md`;
  if (lstatSync(path).isSymbolicLink()) throw new Error('No se normalizan documentos mediante enlaces simbólicos');
  const bytes = readFileSync(path);
  if (args[0] === '--write') writeFileSync(path, normalizeCanonical(bytes));
  else assertCanonical(bytes);
}
console.log(args[0] === '--write' ? 'Solo se normalizaron borradores; revisar el diff antes de aprobar.' : 'Borradores ya normalizados; no se escribió ningún archivo.');
