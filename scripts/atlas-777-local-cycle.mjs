#!/usr/bin/env node
import { promises as fs, constants } from 'node:fs';
import { runLocalCycle } from './atlas-777/local-cycle.mjs';

let handle;
try {
  if (process.argv.length !== 6) throw new Error('USAGE');
  const [repositoryRoot, stateDirectory, planPath, approvedDigest] = process.argv.slice(2);
  handle = await fs.open(planPath, constants.O_RDONLY | constants.O_NOFOLLOW);
  const stat = await handle.stat();
  if (!stat.isFile() || stat.size > 1048576) throw new Error('PLAN_INVALID');
  const plan = JSON.parse(await handle.readFile('utf8'));
  await handle.close(); handle = null;
  const result = await runLocalCycle({ repositoryRoot, stateDirectory, plan, approvedDigest });
  process.stdout.write(JSON.stringify(result) + '\n');
  if (result.status === 'blocked') process.exitCode = 1;
} catch {
  process.stderr.write('ATLAS 777 local cycle stopped: invalid configuration, approval, state or repository.\n');
  process.exitCode = 1;
} finally { await handle?.close(); }
