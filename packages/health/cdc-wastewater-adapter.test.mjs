import test from 'node:test';
import assert from 'node:assert/strict';
import {fromCdcWastewaterRecord} from './cdc-wastewater-adapter.mjs';
const config={datasetId:'abcd-1234',datasetUrl:'https://data.cdc.gov/resource/abcd-1234.json',mapping:{
 sourceId:'site_id',region:'state',publishedOn:'published',observedOn:'sample_date',stance:'interpretation'
}};
const record={site_id:'S1',state:'Florida',published:'2026-10-15',sample_date:'2026-10-10',interpretation:'UNKNOWN'};
test('maps explicitly configured CDC source fields without claiming an outbreak',()=>{
 const v=fromCdcWastewaterRecord(record,config);
 assert.equal(v.evidenceType,'PUBLIC_SURVEILLANCE');
 assert.equal(v.clinicalActionAllowed,false);
 assert.equal(v.stance,'UNKNOWN');
});
test('unknown dataset, missing mapping or record fields fail closed',()=>{
 assert.throws(()=>fromCdcWastewaterRecord(record,{...config,datasetId:'wrong'}));
 assert.throws(()=>fromCdcWastewaterRecord(record,{...config,datasetUrl:'https://evil.test/'}));
 assert.throws(()=>fromCdcWastewaterRecord({},config));
 assert.throws(()=>fromCdcWastewaterRecord(record,{...config,mapping:{...config.mapping,sourceId:'constructor'}}));
});
