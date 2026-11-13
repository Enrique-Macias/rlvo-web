import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {stagingFixture,stagingToken,stagingPublication,stagingProfile,stagingOrigin} from './staging-fixture.mjs';
const f=await stagingFixture();let browser;
const output='qa/share-links-w2';await mkdir(output,{recursive:true});
const cases=[],external=[],cspErrors=[];
try{
 browser=await chromium.launch();const context=await browser.newContext();const page=await context.newPage();
 await page.route('**/*',async route=>{
  if(new URL(route.request().url()).origin!==f.origin){external.push('blocked-external-request');await route.abort();}
  else await route.continue();
 });
 page.on('console',m=>{if(m.type()==='error')cspErrors.push(m.text());});
 for(const [kind,data] of [['p',stagingPublication],['u',stagingProfile]]){
  f.state.data=data;
  for(const width of [360,390,768,1280]){
   await page.setViewportSize({width,height:900});await page.goto(f.origin+'/'+kind+'/'+stagingToken);await page.evaluate(()=>document.fonts.ready);
   assert.equal(await page.locator('script').count(),0);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   assert.equal(await page.locator('h1').textContent(),kind==='p'?data.titulo:data.nombre_publico);
   assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'),stagingOrigin+'/'+kind+'/'+stagingToken);
   await page.keyboard.press('Tab');assert(await page.locator('#rlvo-home').evaluate(e=>document.activeElement===e));
   const focus=await page.locator('#rlvo-home').evaluate(e=>({style:getComputedStyle(e).outlineStyle,width:getComputedStyle(e).outlineWidth,height:e.getBoundingClientRect().height}));
   assert.notEqual(focus.style,'none');assert(parseFloat(focus.width)>=2);assert(focus.height>=44);
   const a11y=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
   assert.equal(a11y.violations.length,0);assert.equal(a11y.incomplete.length,0);
   await page.screenshot({path:output+'/'+kind+'-'+width+'.png',fullPage:true});cases.push({kind,width,overflow:false,focus:true,violations:0,incomplete:0});
  }
 }
 const attack='"><img src=x onerror=alert(1)><script>fixture</script>&';
 f.state.data={...stagingPublication,titulo:attack};await page.goto(f.origin+'/p/'+stagingToken);
 assert.equal(await page.locator('h1').textContent(),attack);assert.equal(await page.locator('meta[property="og:title"]').getAttribute('content'),attack);
 assert.equal(await page.locator('script,img[src="x"],[onerror]').count(),0);
 assert.deepEqual(await context.cookies(),[]);assert.equal(await page.evaluate(()=>localStorage.length),0);
 assert.deepEqual(external,[]);assert.deepEqual(cspErrors,[]);assert.equal(f.state.denied,0);
 const result={cases,domXssSafe:true,externalRequests:0,cookies:0,cspErrors:0,upstream:'synthetic in-memory interceptor'};
 await writeFile(output+'/visual.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{await browser?.close();await f.stop();}
