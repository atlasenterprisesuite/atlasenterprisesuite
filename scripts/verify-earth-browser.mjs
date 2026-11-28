import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const modulePath = process.env.ATLAS_PLAYWRIGHT_MODULE;
assert.ok(modulePath, 'Use isolated verification tooling');
const { chromium } = await import(pathToFileURL(resolve(modulePath)).href);
const base = new URL('http://127.0.0.1:4173');
const output = resolve('.tmp/earth-browser');
await mkdir(output, { recursive: true });
const report = {ok:false, sourceSha:process.env.ATLAS_EARTH_SHA, scope:'isolated GPS component; public raster requests only; not authenticated E2E', layers:[], errors:[], blockedOrigins:[]};
const allowed = new Set([base.origin,'https://unpkg.com','https://tiles.openfreemap.org','https://gibs.earthdata.nasa.gov','https://tiles.arcgis.com','https://tiles.mapterhorn.com']);
const browser = await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const context = await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:'block'});
await context.route('**/*', async route => {
  const req = route.request(), url = new URL(req.url());
  if (allowed.has(url.origin) && ['GET','HEAD','OPTIONS'].includes(req.method())) return route.continue();
  report.blockedOrigins.push(url.origin);
  return route.abort();
});
const page = await context.newPage();
page.on('pageerror', e => report.errors.push(e.message));
const sha256 = data => createHash('sha256').update(data).digest('hex');
try {
  await page.goto(new URL('/earth-ci.html',base).href);
  for (const [name, host, pathMatch] of [
    ['Satélite global','gibs.earthdata.nasa.gov','VIIRS_NOAA20_CorrectedReflectance_TrueColor'],
    ['Océanos GEBCO','tiles.arcgis.com','GEBCO_basemap_NCEI']
  ]) {
    const button = page.getByRole('button',{name,exact:true});
    await button.waitFor({timeout:30000});
    const responsePromise = page.waitForResponse(res => {
      const url = new URL(res.url());
      return url.hostname === host && url.pathname.includes(pathMatch) && res.ok() && /^image\//i.test(res.headers()['content-type'] || '');
    },{timeout:45000});
    const [response] = await Promise.all([responsePromise,button.click()]);
    const data = await response.body();
    assert.ok(data.length > 100, 'Nonempty provider image');
    const decoded = await page.evaluate(async ({bytes,type}) => {
      const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)],{type}));
      const dimensions = {width:bitmap.width,height:bitmap.height};
      bitmap.close();
      return dimensions;
    },{bytes:Array.from(data),type:response.headers()['content-type']});
    assert.ok(decoded.width >= 128 && decoded.height >= 128,'Decoded raster dimensions');
    await page.getByText('Tesela cargada y ciclo de render terminado; cobertura no certificada.',{exact:true}).waitFor({timeout:30000});
    const canvas = page.locator('.gps4d-map canvas.maplibregl-canvas').first();
    await canvas.waitFor({state:'visible'});
    const tileFile = host+'-sample.'+(/png/i.test(response.headers()['content-type'])?'png':'jpg');
    await writeFile(resolve(output,tileFile),data);
    const evidence = {name,url:response.url(),status:response.status(),bytes:data.length,tileFile,tileSha256:sha256(data),decoded,screens:[]};
    report.layers.push(evidence);
    for (const [width,height] of [[1440,900],[390,844]]) {
      await page.setViewportSize({width,height});
      await page.getByText('Tesela cargada y ciclo de render terminado; cobertura no certificada.',{exact:true}).waitFor();
      const attribution = page.locator('.gps4d-map .maplibregl-ctrl-attrib').first();
      const status = page.locator('.gps4d-layer-status').first();
      await attribution.waitFor({state:'visible'});
      const a = await attribution.boundingBox(), b = await status.boundingBox();
      assert.ok(a && b, 'Attribution and status must be visible');
      const overlap = Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
      assert.equal(overlap,0,'Status must not obscure attribution at '+width+'px');
      const filename = host+'-'+width+'.png';
      await canvas.screenshot({path:resolve(output,filename)});
      evidence.screens.push({width,height,file:filename,sha256:sha256(await readFile(resolve(output,filename)))});
    }
    await page.setViewportSize({width:1440,height:900});
  }
  assert.equal(report.layers.length,2);
  assert.deepEqual(report.errors,[]);
  report.ok=true;
} catch(error) {
  report.failure=String(error);
  await page.screenshot({path:resolve(output,'failure.png'),fullPage:true}).catch(()=>{});
  throw error;
} finally {
  await writeFile(resolve(output,'verification.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
  await browser.close();
}
