import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const modulePath=process.env.ATLAS_PLAYWRIGHT_MODULE;
const { chromium }=await import(modulePath?pathToFileURL(resolve(modulePath)).href:'playwright');
const base=new URL(process.env.ATLAS_AUTOMOTIVE_BASE_URL||'http://127.0.0.1:4173');
assert.ok(base.protocol==='http:'&&['127.0.0.1','localhost'].includes(base.hostname),'Local build only: no production browser actions');
const output=resolve('.tmp/automotive-browser');
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true});
await context.route('**/*',route=>{
 const url=route.request().url();
 if(url.startsWith('blob:')||new URL(url).origin===base.origin)return route.continue();
 return route.abort();
});
const page=await context.newPage();
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
const screens=[];
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jS5sAAAAASUVORK5CYII=','base64');
try{
 await page.goto(new URL('/automotive',base).href);
 await page.getByRole('heading',{name:'ATLAS Automotive Intelligence'}).waitFor();
 assert.equal(await page.getByRole('link',{name:/Ficha oficial de McLaren/}).count(),2);
 await page.getByRole('button',{name:'Generar ficha técnica'}).click();
 await page.getByRole('alert').getByText(/Selecciona un modelo/).waitFor();
 await page.locator('input#automotive-photo').setInputFiles({name:'test-vehicle.png',mimeType:'image/png',buffer:png});
 await page.getByAltText('Vista previa de la fotografía seleccionada').waitFor();
 await page.getByRole('combobox',{name:'Modelo para comparar'}).selectOption('mclaren-720s-spider');
 await page.getByRole('button',{name:'Generar ficha técnica'}).click();
 await page.getByRole('heading',{name:'Ficha técnica con procedencia'}).waitFor();
 await page.getByText('Identificación visual automática: no ejecutada').waitFor();
 await page.getByText('Identidad individual: VIN sin verificar').waitFor();
 const download=page.waitForEvent('download');
 await page.getByRole('button',{name:'Exportar ficha JSON'}).click();
 const file=await download;
 assert.equal(file.suggestedFilename(),'atlas-automotive-ficha.json');
 const path=resolve(output,'atlas-automotive-ficha.json');
 await file.saveAs(path);
 const exported=JSON.parse(await readFile(path,'utf8'));
 assert.equal(exported.identification.method,'human-selected-candidate');
 assert.equal(exported.identification.visualRecognitionPerformed,false);
 assert.equal(exported.identification.confidencePercent,null);
 assert.equal(exported.identification.vinVerified,false);
 assert.equal(exported.photo.storedOrUploaded,false);
 assert.equal(exported.market.priceUsd,null);
 assert.equal(exported.vehicle.powerPs,720);
 assert.equal(exported.vehicle.accelerationZeroToHundredSeconds,2.8);
 assert.match(exported.source.url,/mclaren\.com/);
 for(const width of [1440,768,390,320]){
  await page.setViewportSize({width,height:900});
  const viewport=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth}));
  assert.ok(viewport.scroll<=viewport.width,`Automotive overflows at ${width}: ${JSON.stringify(viewport)}`);
  await page.screenshot({path:resolve(output,`automotive-${width}.png`),fullPage:true});
  screens.push({width,...viewport});
 }
 assert.deepEqual(errors,[]);
 await writeFile(resolve(output,'verification.json'),JSON.stringify({ok:true,environment:'local production preview',sourceSha:process.env.GITHUB_SHA||null,screens,errors,manualIdentification:true,actualImageInference:false},null,2));
}catch(error){
 await page.screenshot({path:resolve(output,'failure.png'),fullPage:true}).catch(()=>{});
 await writeFile(resolve(output,'verification.json'),JSON.stringify({ok:false,error:String(error),screens,errors},null,2));
 throw error;
}finally{await browser.close();}
