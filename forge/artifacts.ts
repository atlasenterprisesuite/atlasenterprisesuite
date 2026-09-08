import { createHash } from 'node:crypto';
import { cp, lstat, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import type { ForgeArtifactRecord } from './core.ts';
export type ArtifactManifestEntry = { readonly path: string; readonly size: number; readonly sha256: string };
export type ArtifactManifest = { readonly sourceSha: string; readonly runId: string; readonly files: readonly ArtifactManifestEntry[] };
export function sha256(data: string | Buffer): string { return createHash('sha256').update(data).digest('hex'); }
async function collect(root: string, current: string, output: ArtifactManifestEntry[]): Promise<void> {
  for (const entry of await readdir(current, { withFileTypes: true })) {
    const absolute = join(current, entry.name); const stat = await lstat(absolute);
    if (stat.isSymbolicLink()) throw new Error(`Artifact symlink is not allowed: ${absolute}`);
    if (stat.isDirectory()) { await collect(root, absolute, output); continue; }
    if (!stat.isFile()) continue; const bytes = await readFile(absolute);
    output.push({ path: relative(root, absolute).split(sep).join('/'), size: bytes.length, sha256: sha256(bytes) });
  }
}
export async function buildArtifactManifest(directory: string, sourceSha: string, runId: string): Promise<ArtifactManifest> {
  if (!/^[0-9a-f]{40}$/.test(sourceSha)) throw new Error('Artifact source SHA must be exactly 40 lowercase hex characters');
  const files: ArtifactManifestEntry[] = []; await collect(directory, directory, files); files.sort((a, b) => a.path.localeCompare(b.path)); return { sourceSha, runId, files };
}
export function canonicalManifestJson(manifest: ArtifactManifest): string { return JSON.stringify({ sourceSha: manifest.sourceSha, runId: manifest.runId, files: manifest.files }); }
export class FilesystemArtifactStore {
  private readonly forgeHome: string; constructor(forgeHome: string) { this.forgeHome = forgeHome; }
  private recordFor(digest: string, manifestPath: string, payloadPath: string, sourceSha: string, runId: string): ForgeArtifactRecord {
    return { id: digest, sourceSha, runId, digest, manifestPath, payloadPath, createdAt: new Date().toISOString(), verified: true };
  }
  async publishDirectory(input: { sourceDirectory: string; sourceSha: string; runId: string }): Promise<ForgeArtifactRecord> {
    const manifest = await buildArtifactManifest(input.sourceDirectory, input.sourceSha, input.runId); const manifestJson = canonicalManifestJson(manifest); const digest = sha256(manifestJson);
    const artifactRoot = join(this.forgeHome, 'artifacts', digest), payloadPath = join(artifactRoot, 'payload'), manifestPath = join(artifactRoot, 'manifest.json');
    try { const existing = JSON.parse(await readFile(manifestPath, 'utf8')) as ArtifactManifest; const record = this.recordFor(digest, manifestPath, payloadPath, existing.sourceSha, existing.runId); if (!(await this.verifyArtifact(record))) throw new Error(`Existing artifact ${digest} failed integrity verification`); return record; }
    catch (error) { if (!(error instanceof Error) || !/ENOENT/.test(error.message)) { if (error instanceof SyntaxError) throw new Error(`Existing artifact ${digest} has invalid manifest`); if (error instanceof Error && !/ENOENT/.test(error.message)) throw error; } }
    await mkdir(payloadPath, { recursive: true, mode: 0o700 }); await cp(input.sourceDirectory, payloadPath, { recursive: true, dereference: false, errorOnExist: true, force: false }); await writeFile(manifestPath, manifestJson, { mode: 0o600, flag: 'wx' });
    const record = this.recordFor(digest, manifestPath, payloadPath, input.sourceSha, input.runId); if (!(await this.verifyArtifact(record))) throw new Error(`Published artifact ${digest} failed integrity verification`); return record;
  }
  async verifyArtifact(record: ForgeArtifactRecord): Promise<boolean> {
    try { const stored = JSON.parse(await readFile(record.manifestPath, 'utf8')) as ArtifactManifest; if (sha256(canonicalManifestJson(stored)) !== record.digest) return false; const current = await buildArtifactManifest(record.payloadPath, stored.sourceSha, stored.runId); return canonicalManifestJson(current) === canonicalManifestJson(stored); } catch { return false; }
  }
}
