// API de Astro: instancia efímera sin descubrir, sustituir ni detener previews del usuario.
import { preview } from 'astro';
const server = await preview({ root: process.cwd(), server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
console.log(`RLVO_PREVIEW=http://127.0.0.1:${server.port}/`);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await server.stop();
  process.exit(0);
}
process.once('SIGTERM', stop);
process.once('SIGINT', stop);
