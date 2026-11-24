import test from "node:test";
import assert from "node:assert/strict";
import { normalizeZoneName, validateZoneRecord, validateZoneChange } from "../../apps/web/src/modules/business/domains/core/zone.mjs";

test("normalizes zone names", () => assert.equal(normalizeZoneName(" Example.COM. "), "example.com"));
test("rejects invalid and wildcard zone names", () => {
  for (const zone of ["", "localhost", "*.example.com", "evil..com", "-bad.com"])
    assert.throws(() => normalizeZoneName(zone));
});
test("validates A records and TTL boundaries", () => {
  assert.equal(validateZoneRecord("example.com", {name:"www",type:"A",value:"192.0.2.1"}).ttl,3600);
  for (const value of ["999.1.1.1", "192.0.2.1\nmalicious"])
    assert.throws(() => validateZoneRecord("example.com", {name:"@",type:"A",value}));
  assert.throws(() => validateZoneRecord("example.com", {name:"@",type:"A",value:"192.0.2.1",ttl:1}));
});
test("rejects cross-zone records and unsupported types", () => {
  assert.throws(() => validateZoneRecord("example.com",{name:"www.evil.com",type:"A",value:"192.0.2.1"}));
  assert.throws(() => validateZoneRecord("example.com",{name:"@",type:"ALIAS",value:"elsewhere.example"}));
});
test("requires MX priority and prevents CNAME conflicts", () => {
  assert.throws(() => validateZoneRecord("example.com",{name:"@",type:"MX",value:"mail.example.com"}));
  assert.throws(() => validateZoneChange("example.com",[
    {name:"www",type:"CNAME",value:"target.example.com"},
    {name:"www",type:"A",value:"192.0.2.1"}
  ]));
});
test("zone change is immutable and bounded", () => {
  const batch = validateZoneChange("example.com",[{name:"@",type:"TXT",value:"v=spf1 -all"}]);
  assert.ok(Object.isFrozen(batch));
  assert.throws(() => validateZoneChange("example.com",Array.from({length:501},()=>({name:"@",type:"TXT",value:"x"}))));
});
