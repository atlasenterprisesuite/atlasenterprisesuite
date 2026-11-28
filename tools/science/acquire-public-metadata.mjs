import {createHash,randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {mkdir,writeFile,readFile,link,unlink} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';

export const SOURCES=Object.freeze({
 gibs:'https://gibs.earthdata.nasa.gov/wmts/epsg3031/best/1.0.0/WMTSCapabilities.xml',
 cmr:'https://cmr.earthdata.nasa.gov/search/collections.json?short_name=NSIDC-0756&version=004&version=04&version=4&page_size=100'
});
const MAX_BYTES=32*1024*1024;
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export function parseCmr(text){
 const entries=JSON.parse(text)?.feed?.entry;
 if(!Array.isArray(entries)||!entries.length||entries.length>100||
 entries.some(x=>x?.short_name!=='NSIDC-0756'||!['4','04','004'].includes(String(x.version_id))||typeof x.id!=='string'||!x.id))throw Error('P0_CMR_COLLECTION_MISMATCH');
 return entries;
}
export function parseGibs(text){
 if(/<!\s*(DOCTYPE|ENTITY)\b/i.test(text))throw Error('P0_XML_ACTIVE_DECLARATION');
 // Use Python's standard XML parser, not regex for structural validation.
 const script="import sys,json,xml.etree.ElementTree as E\nr=E.fromstring(sys.stdin.buffer.read())\nn={'w':'http://www.opengis.net/wmts/1.0'}\nif r.tag!='{http://www.opengis.net/wmts/1.0}Capabilities': raise ValueError('invalid root')\nl=r.findall('./w:Contents/w:Layer',n)\nif not l: raise ValueError('empty layers')\nprint(json.dumps({'kind':'wmts-capabilities','layerCount':len(l)}))";
 for(const cmd of process.platform==='win32'?['python','py']:['python3','python']){
  const p=spawnSync(cmd,cmd==='py'?['-3','-c',script]:['-c',script],{input:text,encoding:'utf8',timeout:15000,maxBuffer:1024*1024});
  if(p.error?.code==='ENOENT')continue;
  if(p.error||p.status!==0)throw Error('P0_GIBS_XML_INVALID');
  return JSON.parse(p.stdout);
 }
 throw Error('P0_XML_PARSER_UNAVAILABLE');
}
export async function acquire(id,fetcher=fetch){
 if(typeof id!=='string'||!Object.hasOwn(SOURCES,id))throw Error('P0_UNKNOWN_SOURCE');
 const url=SOURCES[id];
 const response=await fetcher(url,{redirect:'error',credentials:'omit',signal:AbortSignal.timeout(60000),headers:{accept:id==='cmr'?'application/json':'application/xml,text/xml'}});
 if(!response.ok||response.status!==200||!response.body)throw Error('P0_HTTP_RESPONSE');
 const type=(response.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
 if(!(id==='cmr'?type==='application/json':['text/xml','application/xml'].includes(type)))throw Error('P0_CONTENT_TYPE');
 const declared=response.headers.get('content-length');
 if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>MAX_BYTES))throw Error('P0_SIZE_LIMIT');
 const reader=response.body.getReader(),chunks=[];let bytes=0;
 try{
  while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>MAX_BYTES)throw Error('P0_SIZE_LIMIT');chunks.push(Buffer.from(value));}
 }catch(e){await reader.cancel().catch(()=>{});throw e;}finally{reader.releaseLock();}
 if(!bytes||(declared!==null&&!response.headers.get('content-encoding')&&Number(declared)!==bytes))throw Error('P0_INCOMPLETE_RESPONSE');
 const raw=Buffer.concat(chunks),text=new TextDecoder('utf-8',{fatal:true}).decode(raw);
 const parsed=id==='cmr'?{collectionCount:parseCmr(text).length}:parseGibs(text);
 return {sourceId:id,url,raw,bytes,sha256:digest(raw),retrievedAt:new Date().toISOString(),status:'retrieved-unreviewed',scientificallyVerified:false,parsed};
}
async function atomicCreate(path,bytes){
 const tmp=path+'.'+randomUUID()+'.part';
 try{
  await writeFile(tmp,bytes,{flag:'wx',mode:0o600});
  try{await link(tmp,path);}catch(e){if(e.code!=='EEXIST')throw e;if(digest(await readFile(path))!==digest(bytes))throw Error('P0_EXISTING_ARTIFACT_MISMATCH');}
 }finally{await unlink(tmp).catch(()=>{});}
}
export async function persist(result,out){
 const {raw,...receipt}=result;
 if(!Object.hasOwn(SOURCES,receipt.sourceId)||receipt.url!==SOURCES[receipt.sourceId]||!Buffer.isBuffer(raw)||digest(raw)!==receipt.sha256||raw.length!==receipt.bytes)throw Error('P0_RECEIPT_MISMATCH');
 await mkdir(out,{recursive:true,mode:0o700});
 const base=receipt.sourceId+'-'+receipt.sha256;
 const filename=base+(receipt.sourceId==='gibs'?'.xml':'.json');
 await atomicCreate(join(out,filename),raw);
 // Immutable receipt per acquisition attempt; do not overwrite previous timestamps.
 const receiptFile=base+'-'+randomUUID()+'.receipt.json';
 await atomicCreate(join(out,receiptFile),Buffer.from(JSON.stringify({...receipt,filename},null,2)+'\n'));
 return {filename,receiptFile,...receipt};
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 try{
  const [id,out]=process.argv.slice(2);
  if(!out||!Object.hasOwn(SOURCES,id))throw Error('Usage: node tools/science/acquire-public-metadata.mjs gibs|cmr OUTPUT_DIR');
  console.log(JSON.stringify(await persist(await acquire(id),resolve(out)),null,2));
 }catch(e){console.error('ACQUISITION_BLOCKED:',e.message);process.exitCode=1;}
}
