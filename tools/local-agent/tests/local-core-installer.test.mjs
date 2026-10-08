import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const root = process.cwd();
const file = p => readFileSync(root + '/' + p, 'utf8');

test('Ubuntu installer is Bash-valid and explicitly user-scoped with no remote automatic enrollment', () => {
  const source = 'tools/local-agent/install-local-core-ubuntu.sh';
  if (process.platform === 'win32') return;
  const result = spawnSync('bash',['-n', source],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  const body=file(source);
  assert.match(body,/regular user; do not use sudo/);
  assert.match(body,/chmod 0700/);
  assert.doesNotMatch(body,/systemctl|cloudflared|curl .*https|apt-get/);
});
test('Windows installer fail-closes on ACL failure and is not an agent enrollment', () => {
  const content=file('tools/local-agent/install-local-core-windows.ps1');
  assert.match(content,/icacls\.exe/);
  assert.match(content,/LASTEXITCODE -ne 0/);
  assert.match(content,/GetCurrent/);
  assert.doesNotMatch(content,/ScheduledTask|ATLAS_AGENT_ENROLLMENT_CODE|tunnel/);
});
test('Device OS embeds a true unverified Local Core experience', () => {
  const page=file('apps/web/src/modules/device-os/DeviceOSPage.tsx');
  const panel=file('apps/web/src/modules/device-os/LocalCorePanel.tsx');
  assert.match(page,/LocalCorePanel/);
  assert.match(panel,/Device not verified/);
  assert.match(panel,/copy\(command\)/);
  assert.match(panel,/install-local-core-windows.ps1/);
  assert.match(panel,/install-local-core-ubuntu.sh/);
});
