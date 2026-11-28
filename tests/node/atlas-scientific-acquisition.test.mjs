import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGibs, parseCmr, acquire, SOURCES } from '../../tools/science/acquire-public-metadata.mjs';

const collection = {feed:{entry:[{short_name:'NSIDC-0756',version_id:'4',id:'C-fixture'}]}};
test('CMR rejects irrelevant, empty and malformed responses',()=>{
 assert.equal(parseCmr(JSON.stringify(collection)).length,1);
 for(const x of ['<html/>','{}','{"feed":{"entry":[]}}',JSON.stringify({feed:{entry:[{short_name:'OTHER',version_id:'4'}]}})]) assert.throws(()=>parseCmr(x));
});
test('GIBS validates XML envelope and rejects active XML declarations',()=>{
 const fixture='<?xml version="1.0"?><Capabilities xmlns="http://www.opengis.net/wmts/1.0"><Contents><Layer><Identifier>fixture</Identifier></Layer></Contents></Capabilities>';
 assert.equal(parseGibs(fixture).kind,'wmts-capabilities');
 for(const x of ['<html/>','<!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]><Capabilities/>','<Capabilities/>']) assert.throws(()=>parseGibs(x));
});
test('fetch is restricted to fixed source IDs and does not follow redirects',async()=>{
 let called=false;const fetcher=async(url,options)=>{called=true;assert.equal(url,SOURCES.cmr);assert.equal(options.redirect,'error');assert.equal(options.credentials,'omit');return new Response(JSON.stringify(collection),{headers:{'content-type':'application/json'}});};
 await assert.rejects(acquire('https://example.invalid/',fetcher));assert.equal(called,false);
 const r=await acquire('cmr',fetcher);assert.equal(called,true);assert.equal(r.status,'retrieved-unreviewed');assert.match(r.sha256,/^[a-f0-9]{64}$/);assert.equal(r.scientificallyVerified,false);
});
test('invalid content type, truncated oversized and failed responses are never evidence',async()=>{
 for(const res of [new Response('<html/>',{headers:{'content-type':'text/html'}}),new Response('oops',{status:503}),new Response('{}',{headers:{'content-type':'application/json','content-length':'999999999'}})]) await assert.rejects(acquire('cmr',async()=>res));
});
