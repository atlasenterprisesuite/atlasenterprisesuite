import test from "node:test";
import assert from "node:assert/strict";
import { createMemoryZoneStorage, readZone, writeZone } from "../../apps/web/src/modules/business/domains/core/zone-service.mjs";

const admin = {id:"user-a",tenantId:"org-a",roles:["dns_admin"]};
const storage = createMemoryZoneStorage();
const events = [];
const audit = async event => { events.push(event); };
const input = (extra={}) => ({principal:admin,tenantId:"org-a",zoneName:"example.com",storage,audit,...extra});

test("zone writes are tenant-scoped and versioned", async () => {
  const saved = await writeZone(input({expectedVersion:0,records:[{name:"www",type:"A",value:"192.0.2.1"}]}));
  assert.equal(saved.version,1);
  assert.equal((await readZone(input())).records[0].value,"192.0.2.1");
  await assert.rejects(writeZone(input({expectedVersion:0,records:[]})),/version conflict/);
  assert.equal(events.length,2);
});
test("rejects cross-tenant access and unprivileged access", async () => {
  await assert.rejects(readZone(input({tenantId:"org-b"})),/access denied/);
  await assert.rejects(writeZone(input({principal:{id:"u",tenantId:"org-a",roles:["viewer"]},expectedVersion:1,records:[]})),/access denied/);
});
test("fails closed when audit unavailable", async () => {
  await assert.rejects(writeZone(input({expectedVersion:1,records:[],audit:undefined})),/audit writer required/);
  assert.equal((await readZone(input())).version,1);
});
test("does not mutate when intent audit fails", async () => {
  await assert.rejects(writeZone(input({expectedVersion:1,records:[],audit:async()=>{throw Error("audit offline");}})),/audit offline/);
  assert.equal((await readZone(input())).version,1);
});
