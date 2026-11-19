// Reuse an explicitly selected local browser without downloading one or altering the historical harness.
import {chromium} from '@playwright/test';
import {statSync} from 'node:fs';
import {isAbsolute} from 'node:path';
const executablePath=process.argv[2];
if(process.argv.length!==3 || !isAbsolute(executablePath??'') || !statSync(executablePath).isFile())
 throw new Error('Se requiere la ruta absoluta de un navegador instalado localmente');
const launch=chromium.launch.bind(chromium);
chromium.launch=async options=>{
 const browser=await launch({...options,executablePath});
 console.log('LOCAL_BROWSER_VERSION='+browser.version());
 return browser;
};
await import('../../tests/share-links/visual.mjs');
