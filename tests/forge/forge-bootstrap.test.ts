import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { assertRunTransition, parsePipeline } from '../../forge/core.ts';
import { checkoutExactSha, resolveCommit, syncMirror } from '../../forge/git.ts';
import { FilesystemArtifactStore } from '../../forge/artifacts.ts';
import { sanitizedEnvironment, runStep, executePipeline, ForgeApiClient, executeClaimedJob, runLocalCi } from '../../forge/runner.ts';
import { createForgeServer } from '../../forge/api.ts';
import { hasPermission } from '../../packages/core/src/rbac.ts';
const execFileAsync = promisify(execFile);

test('Forge core transitions, pipeline policy and RBAC are isolated by domain', () => {
  assert.doesNotThrow(() => assertRunTransition('queued', 'assigned'));
  assert.doesNotThrow(() => assertRunTransition('assigned', 'running'));
  assert.doesNotThrow(() => assertRunTransition('running', 'failed'));
  assert.doesNotThrow(() => assertRunTransition('running', 'infrastructure_error'));
  assert.throws(() => assertRunTransition('passed', 'running'), /transition/i);
  assert.equal(parsePipeline({ id:'atlas-ci', version:1, steps:[{id:'typecheck',command:'npm',args:['run','typecheck'],timeoutMs:1000}], artifactPaths:['dist'] }).id, 'atlas-ci');
  assert.throws(() => parsePipeline({ id:'unsafe', version:1, steps:[{id:'unsafe',command:'bash',args:['-c','echo x'],timeoutMs:1000}], artifactPaths:[] }), /command/i);
  assert.equal(hasPermission(['forge.admin'], 'forge.pipeline.execute'), true);
  assert.equal(hasPermission(['accounting.admin'], 'forge.pipeline.execute'), false);
});

test('runner strips Forge credentials and classifies execution outcomes', async () => {
  process.env.ATLAS_FORGE_CONTROL_TOKEN = 'secret'; process.env.ATLAS_FORGE_RUNNER_TOKEN = 'secret2';
  const env = sanitizedEnvironment('run-1');
  assert.equal(env.ATLAS_FORGE_CONTROL_TOKEN, undefined); assert.equal(env.ATLAS_FORGE_RUNNER_TOKEN, undefined); assert.equal(env.CI, 'true'); assert.equal(env.ATLAS_FORGE_RUN_ID, 'run-1');
  assert.equal((await runStep({ id:'missing', command:'__atlas_missing__', args:[], timeoutMs:500 }, process.cwd(), 'run-1', () => {})).status, 'infrastructure_error');
  const failed = await runStep({ id:'exit', command:process.execPath, args:['-e','process.exit(7)'], timeoutMs:1000 }, process.cwd(), 'run-2', () => {}); assert.equal(failed.status, 'failed'); assert.equal(failed.exitCode, 7);
  assert.equal((await runStep({ id:'slow', command:process.execPath, args:['-e','setTimeout(()=>{},5000)'], timeoutMs:50 }, process.cwd(), 'run-3', () => {})).status, 'timed_out');
  const execution = await executePipeline({ id:'x', version:1, steps:[{id:'fail',command:process.execPath,args:['-e','process.exit(2)'],timeoutMs:1000},{id:'never',command:process.execPath,args:['-e','process.exit(0)'],timeoutMs:1000}], artifactPaths:[] }, process.cwd(), 'run-4', () => {});
  assert.equal(execution.status, 'failed'); assert.equal(execution.stepResults.length, 1);
});

test('Git exact-SHA checkout survives unavailable mirror', async () => {
  const root = await mkdtemp(join(tmpdir(), 'forge-git-')), source = join(root,'source'), bare = join(root,'atlas.git'), workspace = join(root,'workspace');
  await execFileAsync('git',['init',source]); await execFileAsync('git',['-C',source,'config','user.email','forge@example.invalid']); await execFileAsync('git',['-C',source,'config','user.name','ATLAS Forge']); await writeFile(join(source,'README.md'),'ATLAS'); await execFileAsync('git',['-C',source,'add','.']); await execFileAsync('git',['-C',source,'commit','-m','seed']); await execFileAsync('git',['clone','--mirror',source,bare]);
  const sha = await resolveCommit(bare,'HEAD'); await checkoutExactSha(bare,sha,workspace); assert.equal((await execFileAsync('git',['-C',workspace,'rev-parse','HEAD'])).stdout.trim(),sha);
  await execFileAsync('git',['--git-dir',bare,'remote','add','github',join(root,'missing.git')]); assert.equal((await syncMirror(bare,'github')).state,'unavailable');
});

test('Artifact Vault detects tampering', async () => {
  const root = await mkdtemp(join(tmpdir(),'forge-artifact-')), dist = join(root,'dist'); await mkdir(dist,{recursive:true}); await writeFile(join(dist,'index.html'),'ATLAS');
  const store = new FilesystemArtifactStore(join(root,'forge')); const record = await store.publishDirectory({sourceDirectory:dist,sourceSha:'a'.repeat(40),runId:'run-1'}); assert.match(record.digest,/^[0-9a-f]{64}$/); assert.equal(await store.verifyArtifact(record),true); await writeFile(join(record.payloadPath,'index.html'),'tampered'); assert.equal(await store.verifyArtifact(record),false);
});

test('Forge API lifecycle and sovereign runner complete while GitHub is unavailable', async (t) => {
  const root = await mkdtemp(join(tmpdir(),'forge-sovereign-')), home = join(root,'forge'), source = join(root,'source'), repos = join(home,'repos'), bare = join(repos,'atlas.git'), pipelines = join(home,'pipelines'); await mkdir(repos,{recursive:true}); await mkdir(pipelines,{recursive:true});
  await execFileAsync('git',['init',source]); await execFileAsync('git',['-C',source,'config','user.email','forge@example.invalid']); await execFileAsync('git',['-C',source,'config','user.name','ATLAS Forge']); await writeFile(join(source,'package.json'),JSON.stringify({name:'fixture',private:true,scripts:{test:"node -e \"if(2+2!==4)process.exit(1)\"",build:"node -e \"require('fs').mkdirSync('dist',{recursive:true});require('fs').writeFileSync('dist/index.html','ATLAS')\""}})); await execFileAsync('git',['-C',source,'add','.']); await execFileAsync('git',['-C',source,'commit','-m','seed']); await execFileAsync('git',['clone','--mirror',source,bare]); const sha=(await execFileAsync('git',['-C',source,'rev-parse','HEAD'])).stdout.trim(); await execFileAsync('git',['--git-dir',bare,'remote','add','github',join(root,'missing.git')]); assert.equal((await syncMirror(bare,'github')).state,'unavailable');
  await writeFile(join(pipelines,'sovereign.json'),JSON.stringify({id:'sovereign',version:1,steps:[{id:'unit',command:'npm',args:['test'],timeoutMs:30000},{id:'build',command:'npm',args:['run','build'],timeoutMs:30000}],artifactPaths:['dist']}));
  const control='c'.repeat(64), runner='r'.repeat(64), server=createForgeServer({home,repositoriesRoot:repos,pipelinesRoot:pipelines,controlToken:control,runnerToken:runner,bindHost:'127.0.0.1',port:0,testMode:true}); await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve)); t.after(()=>new Promise<void>(resolve=>server.close(()=>resolve()))); const address=server.address(); if(!address||typeof address==='string')throw new Error('missing address'); const base=`http://127.0.0.1:${address.port}`; assert.equal((await fetch(`${base}/healthz`)).status,200);
  const unauthorized=await fetch(`${base}/v1/runs`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({repositoryId:'atlas',sourceSha:sha,pipelineId:'sovereign'})}); assert.equal(unauthorized.status,401);
  const createdResponse=await fetch(`${base}/v1/runs`,{method:'POST',headers:{authorization:`Bearer ${control}`,'content-type':'application/json'},body:JSON.stringify({repositoryId:'atlas',sourceSha:sha,pipelineId:'sovereign',trigger:'manual',requestedBy:'test'})}); assert.equal(createdResponse.status,201); const created=await createdResponse.json(); const client=new ForgeApiClient(base,runner);
  const claims=await Promise.all([client.claim('runner-1'),client.claim('runner-2')]); const claimed=claims.filter(Boolean); assert.equal(claimed.length,1); const job=claimed[0]!; const assignedRunner=job.assignedRunnerId!;
  const illegal=await fetch(`${base}/v1/jobs/${job.id}/complete`,{method:'POST',headers:{authorization:`Bearer ${runner}`,'content-type':'application/json'},body:JSON.stringify({runnerId:assignedRunner,status:'passed',stepResults:[],artifact:null})}); assert.equal(illegal.status,409);
  await executeClaimedJob(job,{client,runnerId:assignedRunner,home,repositoriesRoot:repos}); const runResponse=await fetch(`${base}/v1/runs/${created.run.id}`,{headers:{authorization:`Bearer ${control}`}}), state=await runResponse.json(); assert.equal(state.run.status,'passed'); assert.ok(state.run.artifact); assert.equal(await new FilesystemArtifactStore(home).verifyArtifact(state.run.artifact),true); assert.equal((await syncMirror(bare,'github')).state,'unavailable'); const audit=await readFile(join(home,'audit','events.jsonl'),'utf8'); for(const action of ['forge.run.create','forge.job.claim','forge.job.start','forge.run.complete']) assert.match(audit,new RegExp(action.replaceAll('.','\\.')));
});

test('Forge API rejects a runner-supplied forged artifact record', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'forge-artifact-binding-')), home = join(root, 'forge'), repos = join(home, 'repos'), pipelines = join(home, 'pipelines');
  await mkdir(repos, { recursive: true }); await mkdir(pipelines, { recursive: true });
  await writeFile(join(pipelines, 'secure.json'), JSON.stringify({ id: 'secure', version: 1, steps: [{ id: 'unit', command: 'npm', args: ['test'], timeoutMs: 1000 }], artifactPaths: ['dist'] }));
  const control = 'c'.repeat(64), runner = 'r'.repeat(64), server = createForgeServer({ home, repositoriesRoot: repos, pipelinesRoot: pipelines, controlToken: control, runnerToken: runner, bindHost: '127.0.0.1', port: 0, testMode: true });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve)); t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('missing address'); const base = `http://127.0.0.1:${address.port}`;
  const createdResponse = await fetch(`${base}/v1/runs`, { method: 'POST', headers: { authorization: `Bearer ${control}`, 'content-type': 'application/json' }, body: JSON.stringify({ repositoryId: 'atlas', sourceSha: 'a'.repeat(40), pipelineId: 'secure', requestedBy: 'security-test' }) }); assert.equal(createdResponse.status, 201); const created = await createdResponse.json();
  const claimResponse = await fetch(`${base}/v1/jobs/claim`, { method: 'POST', headers: { authorization: `Bearer ${runner}`, 'content-type': 'application/json' }, body: JSON.stringify({ runnerId: 'runner-1' }) }); assert.equal(claimResponse.status, 200); const claimed = await claimResponse.json(); const jobId = claimed.job.id;
  const startResponse = await fetch(`${base}/v1/jobs/${jobId}/start`, { method: 'POST', headers: { authorization: `Bearer ${runner}`, 'content-type': 'application/json' }, body: JSON.stringify({ runnerId: 'runner-1' }) }); assert.equal(startResponse.status, 200);
  const fakeDigest = 'b'.repeat(64), completeResponse = await fetch(`${base}/v1/jobs/${jobId}/complete`, { method: 'POST', headers: { authorization: `Bearer ${runner}`, 'content-type': 'application/json' }, body: JSON.stringify({ runnerId: 'runner-1', status: 'passed', stepResults: [], artifact: { id: fakeDigest, sourceSha: 'a'.repeat(40), runId: created.run.id, digest: fakeDigest, manifestPath: '/tmp/not-the-forge-vault/manifest.json', payloadPath: '/tmp/not-the-forge-vault/payload', createdAt: new Date().toISOString(), verified: true } }) });
  assert.equal(completeResponse.status, 400);
});

test('Forge API rejects passed status without complete passing step evidence', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'forge-step-evidence-')), home = join(root, 'forge'), repos = join(home, 'repos'), pipelines = join(home, 'pipelines');
  await mkdir(repos, { recursive: true }); await mkdir(pipelines, { recursive: true });
  await writeFile(join(pipelines, 'steps.json'), JSON.stringify({ id: 'steps', version: 1, steps: [{ id: 'unit', command: 'npm', args: ['test'], timeoutMs: 1000 }], artifactPaths: [] }));
  const control = 'c'.repeat(64), runner = 'r'.repeat(64), server = createForgeServer({ home, repositoriesRoot: repos, pipelinesRoot: pipelines, controlToken: control, runnerToken: runner, bindHost: '127.0.0.1', port: 0, testMode: true });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve)); t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('missing address'); const base = `http://127.0.0.1:${address.port}`;
  const createdResponse = await fetch(`${base}/v1/runs`, { method: 'POST', headers: { authorization: `Bearer ${control}`, 'content-type': 'application/json' }, body: JSON.stringify({ repositoryId: 'atlas', sourceSha: 'a'.repeat(40), pipelineId: 'steps', requestedBy: 'security-test' }) }); assert.equal(createdResponse.status, 201);
  const claimResponse = await fetch(`${base}/v1/jobs/claim`, { method: 'POST', headers: { authorization: `Bearer ${runner}`, 'content-type': 'application/json' }, body: JSON.stringify({ runnerId: 'runner-1' }) }); const claimed = await claimResponse.json(); const jobId = claimed.job.id;
  await fetch(`${base}/v1/jobs/${jobId}/start`, { method: 'POST', headers: { authorization: `Bearer ${runner}`, 'content-type': 'application/json' }, body: JSON.stringify({ runnerId: 'runner-1' }) });
  const completeResponse = await fetch(`${base}/v1/jobs/${jobId}/complete`, { method: 'POST', headers: { authorization: `Bearer ${runner}`, 'content-type': 'application/json' }, body: JSON.stringify({ runnerId: 'runner-1', status: 'passed', stepResults: [], artifact: null }) });
  assert.equal(completeResponse.status, 400);
});

test('Forge API rejects passed status when configured artifact evidence is missing', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'forge-required-artifact-')), home = join(root, 'forge'), repos = join(home, 'repos'), pipelines = join(home, 'pipelines');
  await mkdir(repos, { recursive: true }); await mkdir(pipelines, { recursive: true });
  await writeFile(join(pipelines, 'artifact-required.json'), JSON.stringify({ id: 'artifact-required', version: 1, steps: [{ id: 'build', command: 'npm', args: ['run', 'build'], timeoutMs: 1000 }], artifactPaths: ['dist'] }));
  const control = 'c'.repeat(64), runner = 'r'.repeat(64), server = createForgeServer({ home, repositoriesRoot: repos, pipelinesRoot: pipelines, controlToken: control, runnerToken: runner, bindHost: '127.0.0.1', port: 0, testMode: true });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve)); t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('missing address'); const base = `http://127.0.0.1:${address.port}`;
  const createdResponse = await fetch(`${base}/v1/runs`, { method: 'POST', headers: { authorization: `Bearer ${control}`, 'content-type': 'application/json' }, body: JSON.stringify({ repositoryId: 'atlas', sourceSha: 'a'.repeat(40), pipelineId: 'artifact-required', requestedBy: 'security-test' }) }); assert.equal(createdResponse.status, 201);
  const claimResponse = await fetch(`${base}/v1/jobs/claim`, { method: 'POST', headers: { authorization: `Bearer ${runner}`, 'content-type': 'application/json' }, body: JSON.stringify({ runnerId: 'runner-1' }) }); const claimed = await claimResponse.json(); const jobId = claimed.job.id;
  await fetch(`${base}/v1/jobs/${jobId}/start`, { method: 'POST', headers: { authorization: `Bearer ${runner}`, 'content-type': 'application/json' }, body: JSON.stringify({ runnerId: 'runner-1' }) });
  const now = new Date().toISOString(), completeResponse = await fetch(`${base}/v1/jobs/${jobId}/complete`, { method: 'POST', headers: { authorization: `Bearer ${runner}`, 'content-type': 'application/json' }, body: JSON.stringify({ runnerId: 'runner-1', status: 'passed', stepResults: [{ stepId: 'build', status: 'passed', exitCode: 0, startedAt: now, finishedAt: now }], artifact: null }) });
  assert.equal(completeResponse.status, 400);
});

test('local Forge CI refuses a dirty working tree before recording SHA evidence', async () => {
  const root = await mkdtemp(join(tmpdir(), 'forge-local-dirty-'));
  await execFileAsync('git', ['init', root]);
  await execFileAsync('git', ['-C', root, 'config', 'user.email', 'forge@example.invalid']);
  await execFileAsync('git', ['-C', root, 'config', 'user.name', 'ATLAS Forge']);
  await mkdir(join(root, '.atlas', 'forge', 'pipelines'), { recursive: true });
  await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'fixture', private: true, scripts: { noop: "node -e \"process.exit(0)\"" } }));
  await writeFile(join(root, '.atlas', 'forge', 'pipelines', 'atlas-ci.json'), JSON.stringify({ id: 'atlas-ci', version: 1, steps: [{ id: 'noop', command: 'npm', args: ['run', 'noop'], timeoutMs: 30000 }], artifactPaths: [] }));
  await execFileAsync('git', ['-C', root, 'add', '.']);
  await execFileAsync('git', ['-C', root, 'commit', '-m', 'seed']);
  await writeFile(join(root, 'dirty.txt'), 'not committed');
  await assert.rejects(() => runLocalCi(root), /clean working tree/i);
});
