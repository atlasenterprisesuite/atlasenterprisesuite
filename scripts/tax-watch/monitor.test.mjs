import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const source=readFileSync(new URL('./monitor.mjs',import.meta.url),'utf8');
test('monitor parses as JavaScript',()=>{
 const result=spawnSync(process.execPath,['--check',new URL('./monitor.mjs',import.meta.url).pathname],{encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);
});
test('fail-closed and persistence controls exist',()=>{
 for(const fragment of ['GH_TOKEN','GH_REPO','--body-file','process.exitCode=1','AbortSignal.timeout','Duplicate state issues','previous[source.id]','changed.push(source)']){
  assert.ok(source.includes(fragment),'missing control: '+fragment);
 }
});
test('no production mutation commands',()=>{
 assert.doesNotMatch(source,/gh\(['"]pr['"],['"]merge['"]/);
 assert.doesNotMatch(source,/supabase db push|wrangler deploy|git push/);
});
