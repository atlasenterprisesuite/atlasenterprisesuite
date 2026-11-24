import test from "node:test";
import assert from "node:assert/strict";
import {createDnsZoneServer} from "../../apps/web/src/modules/business/domains/core/zone-server.mjs";
const base={method:"GET",params:{tenantId:"org-a",zoneName:"example.com"},headers:{authorization:"Bearer valid"}};
const memberships=new Map([["actor-1:org-a",{status:"active",role:"dns_admin"}],["viewer:org-a",{status:"active",role:"member"}]]);
const commits=[];
const db={
  findActiveMembership:async ({actorId,tenantId})=>memberships.get(actorId+":"+tenantId),
  readZone:async ({tenantId,zone})=>({tenantId,zone,version:0,records:[]}),
  commitZone:async params=>{commits.push(params);return {...params,version:params.expectedVersion+1};}
};
const server=createDnsZoneServer({
  verifyAccessToken:async token=>token==="valid"?{sub:"actor-1"}:token==="viewer"?{sub:"viewer"}:null,db
});
test("verified identity reads only its authorized tenant",async()=>{
  assert.equal((await server(base)).status,200);
  assert.equal((await server({...base,params:{...base.params,tenantId:"org-b"}})).status,403);
  assert.equal((await server({...base,headers:{authorization:"Bearer invalid"}})).status,401);
});
test("writes require privileged membership and validated records",async()=>{
  const put={...base,method:"PUT",body:{expectedVersion:0,records:[{name:"www",type:"A",value:"192.0.2.1"}]}};
  assert.equal((await server({...put,headers:{authorization:"Bearer viewer"}})).status,403);
  assert.equal(commits.length,0);
  assert.equal((await server(put)).status,200);
  assert.equal(commits.length,1);
  assert.equal(commits[0].actorId,"actor-1");
});
test("unavailable membership service fails closed",async()=>{
  const unavailable=createDnsZoneServer({verifyAccessToken:async()=>({sub:"actor-1"}),db:{...db,findActiveMembership:async()=>{throw Error("offline");}}});
  assert.equal((await unavailable(base)).status,503);
});
test("rejects missing server dependencies",()=>{
  assert.throws(()=>createDnsZoneServer({}),/Trusted identity and database adapters required/);
});
