import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { prepareStagingPrivateConfig } from './check-staging-private-target.mjs';

export async function endpointInput(stream) {
  const chunks = []; let total = 0;
  for await (const chunk of stream) {
    const bytes = Buffer.from(chunk); total += bytes.length;
    assert(total <= 2048, 'Entrada excesiva'); chunks.push(bytes);
  }
  return JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(Buffer.concat(chunks)));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const input = await endpointInput(process.stdin);
    const result = await prepareStagingPrivateConfig(input, {args:process.argv.slice(2)});
    console.log(JSON.stringify(result));
  } catch {
    console.error('PRIVATE_CONFIG_REJECTED: no se materializó una configuración autorizada');
    process.exitCode = 1;
  }
}
