import test from "node:test";
import assert from "node:assert/strict";
import {createDnsZoneHttpHandler} from "../../apps/web/src/modules/business/domains/core/zone-http.mjs";
const params={tenantId:"org-a",zoneName:"example.com"};
const request=(method,body)=>({method,params,body,token:"valid"});
const principal={id:"actor-1"};
const snapshot={tenantId:"org-a",zone:"example.com",version:1,records:[]};
const storage={get:async()=>snapshot,commit:async args=>({...snapshot,version:args.expectedVersion+1,records:args.records})};
const make=(overrides={})=>createDnsZoneHttpHandler({
  authenticate:async req=>req.token==="valid" ? principal:null,
  authorize:async ({tenantId})=>tenantId==="org-a",
  storage,...overrides
});
const parse=result=>JSON.parse(result.body);
test("requires trusted auth and tenant authorization",async()=>{
  assert.equal((await make()({...request("GET"),token:"invalid"})).status,401);
  assert.equal((await make({authorize:async()=>false})(request("GET"))).status,403);
});
test("returns zone only after authentication",async()=>{
  const result=await make()(request("GET"));
  assert.equal(result.status,200);
  assert.equal(parse(result).zone.version,1);
  assert.equal(result.headers["cache-control"],"no-store");
});
test("validates changes before calling persistent adapter",async()=>{
  let calls=0;
  const handler=make({storage:{get:storage.get,commit:async args=>{calls++;return storage.commit(args);}}});
  assert.equal((await handler(request("PUT",{expectedVersion:1,records:[{name:"www",type:"A",value:"999.0.0.1"}]}))).status,400);
  assert.equal(calls,0);
  const ok=await handler(request("PUT",{expectedVersion:1,records:[{name:"www",type:"A",value:"192.0.2.1"}]}));
  assert.equal(ok.status,200);
  assert.equal(calls,1);
});
test("fails closed on backend errors",async()=>{
  const handler=make({storage:{get:async()=>{throw Error("private database error");},commit:storage.commit}});
  const result=await handler(request("GET"));
  assert.equal(result.status,503);
  assert.ok(!result.body.includes("private database"));
});
test("rejects missing trusted dependencies",()=>{
  assert.throws(()=>createDnsZoneHttpHandler({}),/Trusted DNS dependencies required/);
});
