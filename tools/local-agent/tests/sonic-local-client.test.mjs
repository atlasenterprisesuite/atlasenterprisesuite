import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startSonicJob, querySonicJob } from '../lib/sonic-local-client.mjs';

const taskId = '550e8400-e29b-41d4-a716-446655440000';
const options = { endpoint: 'http://127.0.0.1:8001', token: 'test-only', approvedLocalRuntime: true };
const spec = { genre: 'ambient', instruments: 'piano, strings', prompt: 'Original instrumental sketch', duration: 20, bpm: 100, key: 'C Major', seed: 777 };
const envelope = data => Response.json({ code: 200, error: null, data });

test('blocks unauthorized, remote and oversized requests before fetch', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; throw Error('unexpected'); };
  for (const patch of [{ approvedLocalRuntime: false }, { endpoint: 'https://example.com' }, { endpoint: 'http://localhost:8001' }, { token: '' }]) {
    await assert.rejects(startSonicJob({...options,...patch, spec, fetchImpl}));
  }
  await assert.rejects(startSonicJob({...options,spec:{...spec,duration:600},fetchImpl}));
  assert.equal(calls,0);
});

test('submits a bounded explicit text-to-music request', async () => {
  const task = await startSonicJob({...options,spec,fetchImpl:async (url,init)=>{
    assert.equal(url.href,'http://127.0.0.1:8001/release_task');
    assert.equal(init.redirect,'error');
    assert.equal(init.headers.authorization,'Bearer test-only');
    const body=JSON.parse(init.body);
    assert.equal(body.batch_size,1);
    assert.equal(body.model,'acestep-v15-turbo');
    assert.equal(body.audio_duration,20);
    assert.equal(body.thinking,false);
    assert.equal(body.lyrics,'[Instrumental]');
    assert.match(body.prompt,/piano, strings/);
    return envelope({task_id:taskId,status:'queued'});
  }});
  assert.equal(task.taskId,taskId);
  assert.equal(task.state,'submitted');
});

test('queries only the matching job and never claims verified audio', async () => {
  const run = status => querySonicJob({...options,taskId,fetchImpl:async (url,init)=>{
    assert.equal(url.pathname,'/query_result');
    assert.deepEqual(JSON.parse(init.body),{task_id_list:[taskId]});
    return envelope([{task_id:taskId,status}]);
  }});
  assert.equal((await run(0)).state,'pending');
  assert.equal((await run(1)).state,'reported-success');
  assert.equal((await run(1)).audioVerified,false);
  assert.equal((await run(2)).state,'failed');
  await assert.rejects(run(3));
  await assert.rejects(querySonicJob({...options,taskId,fetchImpl:async()=>envelope([{task_id:'other',status:1}])}));
});

test('rejects oversized and malformed replies and hides transport details', async () => {
  await assert.rejects(startSonicJob({...options,spec,fetchImpl:async()=>new Response('x'.repeat(140000))}),/response_too_large/);
  await assert.rejects(startSonicJob({...options,spec,fetchImpl:async()=>envelope({task_id:'bad'})}),/invalid_task/);
  await assert.rejects(startSonicJob({...options,spec,fetchImpl:async()=>{throw Error('secret');}}),/runtime_unreachable/);
});
