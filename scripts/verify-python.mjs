import { spawnSync } from 'node:child_process';

const candidates = process.platform === 'win32' ? ['python', 'py'] : ['python3', 'python'];
let last = null;

for (const command of candidates) {
  const args = command === 'py'
    ? ['-3', '-m', 'unittest', 'discover', '-s', 'services/creator-native', '-p', 'test_*.py']
    : ['-m', 'unittest', 'discover', '-s', 'services/creator-native', '-p', 'test_*.py'];
  const result = spawnSync(command, args, { stdio: 'inherit' });
  last = result;
  if (!result.error) process.exit(result.status ?? 1);
  if (result.error.code !== 'ENOENT') {
    console.error(`[verify:python] ${result.error.message}`);
    process.exit(1);
  }
}

console.error('[verify:python] No Python interpreter was found.');
if (last?.error) console.error(last.error.message);
process.exit(1);
