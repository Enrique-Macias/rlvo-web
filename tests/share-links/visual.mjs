import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {fixture,token,publication,profile} from './fixture.mjs';
const f=await fixture();let browser;
const output='qa/share-links';
await mkdir(output,{recursive:true});
const results=[];
try{
 browser=await chromium.launch();
 const context=await browser.newContext();const page=await context.newPage();const external=[],cspErrors=[];
 await page.route('**/*',async route=>{
  if(new URL(route.request().url()).origin!==f.origin){external.push(route.request().url());await route.abort();}
  else await route.continue();
 });
 page.on('console',m=>{if(m.type()==='error')cspErrors.push(m.text());});
 for(const [kind,data] of [['p',publication],['u',profile]]){
  f.state.data=data;
  for(const width of [360,390,768,1280]){
   await page.setViewportSize({width,height:900});
   await page.goto(f.origin+'/'+kind+'/'+token);await page.evaluate(()=>document.fonts.ready);
   assert.equal(await page.locator('script').count(),0);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   assert.equal(await page.locator('h1').textContent(),kind==='p'?publication.titulo:profile.nombre_publico);
   await page.keyboard.press('Tab');assert.equal(await page.locator('#rlvo-home').evaluate(e=>document.activeElement===e),true);
   const focus=await page.locator('#rlvo-home').evaluate(e=>({style:getComputedStyle(e).outlineStyle,width:getComputedStyle(e).outlineWidth,rect:e.getBoundingClientRect().height}));
   assert.notEqual(focus.style,'none');assert(parseFloat(focus.width)>=2);assert(focus.rect>=44);
   const a11y=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
   assert.deepEqual(a11y.violations.map(v=>v.id),[]);
   await page.screenshot({path:output+'/'+kind+'-'+width+'.png',fullPage:true});
   results.push({kind,width,overflow:false,focus:true,violations:0,incomplete:a11y.incomplete.map(v=>v.id)});
  }
 }
 const attack='"><img src=x onerror=alert(1)><script>alert(1)</script>&';
 f.state.data={...publication,titulo:attack};
 await page.goto(f.origin+'/p/'+token);
 assert.equal(await page.locator('h1').textContent(),attack);
 assert.equal(await page.locator('meta[property="og:title"]').getAttribute('content'),attack);
 assert.equal(await page.locator('script, img[src="x"], [onerror]').count(),0);
 assert.equal(await page.evaluate(()=>typeof localStorage==='object'&&localStorage.length),0);
 assert.deepEqual(await page.context().cookies(),[]);
 assert.deepEqual(external,[]);assert.deepEqual(cspErrors,[]);
 // No fictional credentials/tokens in public build assets (source template is generic).
 const template=await readFile('dist/compartir/plantilla.html','utf8');
 assert(!template.includes(token));assert(!template.includes('synthetic-local-preview-key'));
 await writeFile(output+'/visual.json',JSON.stringify({results,xssDomSafe:true,externalRequests:0,cspErrors:0,cookies:0},null,2)+'\n');
 console.log(JSON.stringify({responsiveCases:results.length,xssDomSafe:true,externalRequests:0,cspErrors:0,cookies:0}));
}finally{await browser?.close();await f.stop();}