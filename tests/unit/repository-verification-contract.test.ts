import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (path: string) => readFileSync(`${root}/${path}`, 'utf8');

const productionWorkflows = [
  '.github/workflows/production-deploy.yml',
  '.github/workflows/cloudflare-deploy.yml'
] as const;

describe('repository-wide verification contract', () => {
  it('defines edge, python and all-repository verification scripts', () => {
    const pkg = JSON.parse(read('package.json')) as { scripts?: Record<string, string> };
    expect(pkg.scripts?.['verify:edge']).toBeTruthy();
    expect(pkg.scripts?.['verify:python']).toBeTruthy();
    expect(pkg.scripts?.['verify:all']).toContain('verify:edge');
    expect(pkg.scripts?.['verify:all']).toContain('verify:python');
  });

  it('keeps Cloudflare provider verification strict without requiring host-only native media binaries', () => {
    const pkg = JSON.parse(read('package.json')) as { scripts?: Record<string, string> };
    const cloudflare = pkg.scripts?.['verify:cloudflare'] ?? '';

    expect(cloudflare).toContain('npm audit --audit-level=high');
    expect(cloudflare).toContain('npm run typecheck');
    expect(cloudflare).toContain('npm run test:unit');
    expect(cloudflare).toContain('npm run test:integration');
    expect(cloudflare).toContain('npm run verify:edge');
    expect(cloudflare).toContain('npm run verify:neural');
    expect(cloudflare).toContain('npm run build');
    expect(cloudflare).not.toContain('verify:python');
    expect(pkg.scripts?.['verify:all']).toContain('verify:python');
  });

  it('uses the shared repository verification contract in production workflows', () => {
    for (const path of productionWorkflows) {
      expect(read(path), path).toContain('npm run verify:all');
    }
  });

  it('provisions the native Creator media toolchain before full production verification', () => {
    for (const path of productionWorkflows) {
      const workflow = read(path);
      expect(workflow, path).toContain('Install native media verification dependencies');
      expect(workflow, path).toContain('sudo apt-get install -y ffmpeg espeak fonts-dejavu-core');
      expect(workflow, path).toContain('ffmpeg -version');
      expect(workflow, path).toContain('ffprobe -version');
      expect(workflow, path).toContain('espeak --version');
      expect(workflow, path).toContain('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf');
      expect(workflow.indexOf('Install native media verification dependencies')).toBeLessThan(
        workflow.indexOf('npm run verify:all')
      );
    }
  });
});
