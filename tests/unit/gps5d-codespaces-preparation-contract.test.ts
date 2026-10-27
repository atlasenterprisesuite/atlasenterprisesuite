import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Static, synthetic contract only. No Codespace, network, shell, Docker or PostgreSQL.
const profile = JSON.parse(readFileSync('.devcontainer/gps5d/devcontainer.json', 'utf8'));
const preflight = readFileSync('scripts/gps5d/offline-runner-preflight.sh', 'utf8');
const workflow = readFileSync('.github/workflows/gps5d-isolated-tdd.yml', 'utf8');

describe('GPS5D Codespaces preparation security contract', () => {
  it('does not automatically install dependencies, run commands, or mount privileged sockets', () => {
    for (const key of ['initializeCommand','onCreateCommand','updateContentCommand','postCreateCommand','postStartCommand','postAttachCommand','features','mounts','runArgs','privileged']) {
      expect(profile).not.toHaveProperty(key);
    }
  });
  it('does not explicitly forward ports or request sensitive credentials', () => {
    expect(profile.forwardPorts).toEqual([]);
    expect(profile.portsAttributes?.['3000']?.onAutoForward).toBe('ignore');
    expect(profile.portsAttributes?.['5432']?.onAutoForward).toBe('ignore');
    expect(profile).not.toHaveProperty('containerEnv');
    expect(profile).not.toHaveProperty('remoteEnv');
    expect(profile).not.toHaveProperty('secrets');
  });
  it('uses a non-root remote user', () => {
    expect(profile.remoteUser).toBe('vscode');
  });
  it('documents that the base image still needs digest pinning', () => {
    expect(profile.image).toBe('mcr.microsoft.com/devcontainers/base:ubuntu-24.04');
    expect(profile.image).not.toContain('@sha256:');
  });
  it('keeps runner and workflow fail-closed until isolation is certified', () => {
    expect(preflight).toContain("fail 'namespace smoke check alone is insufficient");
    expect(workflow).toContain('exit 1');
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).not.toContain('  push:');
  });
});
