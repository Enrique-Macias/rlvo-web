// LOCAL VISUAL REFERENCE ONLY: Sharp is not the production Cloudflare compositor.
import sharp from 'sharp';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
const out=new URL('../../qa/og-image-v1/reference/',import.meta.url);
await mkdir(out,{recursive:true});
const logo=await readFile(new URL('../../public/brand/11_logo_horizontal_menta_sobre_verde.svg',import.meta.url));
const badge=await sharp(logo).resize({width:240}).png().toBuffer();
const report={kind:'LOCAL_SHARP_REFERENCE_NOT_CLOUDFLARE_VALIDATION',images:[]};
for(const[name,width,height]of [['vertical',600,900],['horizontal',1600,900],['panoramic',2400,400]]){
 const svg=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#DDF5ED"/><rect x="8" y="8" width="${width-16}" height="${height-16}" fill="none" stroke="#183D39" stroke-width="16"/><circle cx="${width/2}" cy="${height/2}" r="${Math.min(width,height)/4}" fill="#78CDB5"/></svg>`);
 const photo=await sharp(svg).png().toBuffer();
 const base=await sharp(photo).resize(1200,630,{fit:'contain',background:'#F5FAF8'}).png().toBuffer();
 const image=await sharp(base).composite([{input:badge,left:928,top:508}]).jpeg({quality:85}).toBuffer();
 await writeFile(new URL(name+'.jpg',out),image);
 const metadata=await sharp(image).metadata();
 report.images.push({name,source:{width,height},width:metadata.width,height:metadata.height,bytes:image.length,hasAlpha:metadata.hasAlpha});
}
await writeFile(new URL('result.json',out),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
