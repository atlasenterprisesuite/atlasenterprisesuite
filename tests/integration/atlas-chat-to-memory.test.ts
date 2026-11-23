import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const script = resolve('scripts/atlas-chat-to-memory.mjs');

function inTemporaryDirectory(test: (directory: string) => void) {
  const directory = mkdtempSync(join(tmpdir(), 'atlas-chat-import-test-'));
  try { test(directory); } finally { rmSync(directory, { recursive: true, force: true }); }
}

function run(input: string, outDir: string) {
  return spawnSync(process.execPath, [script, '--input', input, '--out-dir', outDir], {
    encoding: 'utf8'
  });
}

describe('ATLAS 777 Chat -> Knowledge offline intake', () => {
  it('uses a selected ChatGPT conversation branch, routes by canonical modules and never approves', () => {
    inTemporaryDirectory(directory => {
      const input = join(directory, 'conversations.json');
      const outDir = join(directory, 'out');
      writeFileSync(input, JSON.stringify([
        {
          id: 'conv-1', title: 'ATLAS Biblia y Jesus',
          current_node: 'assistant',
          mapping: {
            root: { parent: null, message: { author: { role: 'system' }, content: { parts: ['SECRET SYSTEM MESSAGE'] } } },
            user: { parent: 'root', message: { author: { role: 'user' }, content: { parts: ['Investigar manuscritos del Evangelio.'] } } },
            assistant: { parent: 'user', message: { author: { role: 'assistant' }, content: { parts: ['Citar las fuentes del estudio.'] } } },
            discarded: { parent: 'root', message: { author: { role: 'assistant' }, content: { parts: ['DISCARDED BRANCH'] } } }
          }
        },
        {
          id: 'conv-2', title: 'ATLAS Accounting y Payroll',
          mapping: {
            a: { message: { author: { role: 'user' }, create_time: 1, content: { parts: ['Conciliacion de cuentas.'] } } }
          }
        },
        { title: 'Missing source identifier', mapping: {} }
      ]));
      const result = run(input, outDir);
      expect(result.status, result.stderr).toBe(0);
      const manifest = JSON.parse(readFileSync(join(outDir, 'manifest.json'), 'utf8'));
      expect(manifest).toMatchObject({
        status: 'local_drafts_not_uploaded', record_count: 2, batch_count: 1, approval: 'manual_required'
      });
      expect(manifest.skipped).toEqual([{ index: 2, reason: 'missing_conversation_id' }]);
      const payload = JSON.parse(readFileSync(join(outDir, 'atlas-chat-drafts-0001.json'), 'utf8'));
      expect(payload.approve).toBe(false);
      expect(payload.records).toHaveLength(2);
      expect(payload.records[0].module_ids).toContain('bible-os');
      expect(payload.records[1].module_ids).toContain('accounting');
      expect(payload.records[1].module_ids).toContain('payroll');
      expect(payload.records[0]).toMatchObject({
        source_type: 'chat_import', sensitivity: 'restricted',
        source_ref: 'chatgpt-export:conv-1:chunk:1', kind: 'note'
      });
      expect(payload.records[0].source_hash).toMatch(/^[0-9a-f]{64}$/);
      expect(payload.records[0].content_json.text).not.toContain('SECRET SYSTEM MESSAGE');
      expect(payload.records[0].content_json.text).not.toContain('DISCARDED BRANCH');
    });
  });

  it('preserves all text across bounded segments and batches of at most 50', () => {
    inTemporaryDirectory(directory => {
      const input = join(directory, 'conversations.json');
      const outDir = join(directory, 'out');
      const text = 'L'.repeat(610000);
      writeFileSync(input, JSON.stringify([{
        id: 'long', title: 'An unknown topic', current_node: 'u',
        mapping: { u: { parent: null, message: { author: { role: 'user' }, content: { parts: [text] } } } }
      }]));
      const result = run(input, outDir);
      expect(result.status, result.stderr).toBe(0);
      const batches = readdirSync(outDir).filter(name => name.startsWith('atlas-chat-drafts-'))
        .sort().map(name => JSON.parse(readFileSync(join(outDir, name), 'utf8')));
      expect(batches).toHaveLength(2);
      expect(batches.every(batch => batch.approve === false && batch.records.length <= 50)).toBe(true);
      const records = batches.flatMap(batch => batch.records);
      expect(records.map(record => record.content_json.text).join('')).toBe('USER: ' + text);
      expect(records.every(record => record.sensitivity === 'restricted')).toBe(true);
      expect(records.every(record => record.module_ids.includes('knowledge'))).toBe(true);
    });
  });

  it('supports SRT without timestamps and never makes network requests', () => {
    inTemporaryDirectory(directory => {
      const input = join(directory, 'atlas.srt');
      const outDir = join(directory, 'out');
      writeFileSync(input, '1\n00:00:00,000 --> 00:00:02,000\nuser: ATLAS Health research\n\n2\n00:00:02,000 --> 00:00:03,000\nassistant: Evidence first\n');
      const result = run(input, outDir);
      expect(result.status, result.stderr).toBe(0);
      const payload = JSON.parse(readFileSync(join(outDir, 'atlas-chat-drafts-0001.json'), 'utf8'));
      expect(payload.records[0].module_ids).toContain('health');
      expect(payload.records[0].content_json.text).not.toContain('-->');
    });
  });

  it('fails closed on wrong format or attempts to write private transcripts in the repository', () => {
    inTemporaryDirectory(directory => {
      const wrong = join(directory, 'input.txt');
      writeFileSync(wrong, 'secret');
      expect(run(wrong, join(directory, 'out')).status).not.toBe(0);
      const correct = join(directory, 'chat.srt');
      writeFileSync(correct, '1\n00:00:00,000 --> 00:00:02,000\nHello\n');
      const blocked = run(correct, resolve('.atlas-private-chat-import-test'));
      expect(blocked.status).not.toBe(0);
      expect(blocked.stderr).toContain('refusing_private_export_inside_repository');
    });
  });

  it('does not match partial words as tax topics and still detects explicit IRS references', () => {
    inTemporaryDirectory(directory => {
      const input = join(directory, 'conversations.json');
      const outDir = join(directory, 'out');
      writeFileSync(input, JSON.stringify([
        { id: 'health-topic', title: 'Research notes', mapping: { a: { message: {
          author: { role: 'user' }, content: { parts: ['First, investigate health research'] }
        } } } },
        { id: 'tax-topic', title: 'Federal IRS reference', mapping: { a: { message: {
          author: { role: 'user' }, content: { parts: ['Review IRS Form 1040'] }
        } } } }
      ]));
      expect(run(input, outDir).status).toBe(0);
      const payload = JSON.parse(readFileSync(join(outDir, 'atlas-chat-drafts-0001.json'), 'utf8'));
      expect(payload.records[0].module_ids).toContain('health');
      expect(payload.records[0].module_ids).not.toContain('tax');
      expect(payload.records[1].module_ids).toContain('tax');
    });
  });

  it('can resume an identical private export, but refuses conflicting existing batches', () => {
    inTemporaryDirectory(directory => {
      const input = join(directory, 'chat.srt');
      const outDir = join(directory, 'out');
      writeFileSync(input, '1\\n00:00:00,000 --> 00:00:02,000\\nATLAS health research\\n');
      expect(run(input, outDir).status).toBe(0);
      expect(run(input, outDir).status).toBe(0);
      const batchPath = join(outDir, 'atlas-chat-drafts-0001.json');
      const original = readFileSync(batchPath, 'utf8');
      writeFileSync(batchPath, '{"corrupted":true}');
      const result = run(input, outDir);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('existing_private_batch_mismatch');
      expect(readFileSync(batchPath, 'utf8')).toBe('{"corrupted":true}');
      writeFileSync(batchPath, original);
      expect(run(input, outDir).status).toBe(0);
    });
  });
});
