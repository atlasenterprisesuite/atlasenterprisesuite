import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {inventory} from '../inventory.mjs';
test('inventory reports only candidates, never secrets or node_modules',()=>{
  const dir=mkdtempSync(join(tmpdir(),'atlas-inv-'));
  try {
    mkdirSync(join(dir,'src'));mkdirSync(join(dir,'node_modules'));
    writeFileSync(join(dir,'src','deploy.mjs'),'const edge="Cloudflare"; const db="Supabase";');
    writeFileSync(join(dir,'.env'),'GITHUB_TOKEN=SECRET_TOKEN_EXAMPLE');
    writeFileSync(join(dir,'node_modules','pkg.mjs'),'Vercel Cloudflare');
    const result=inventory(dir);
    assert.deepEqual(result.provider_candidates.cloudflare.files,['src/deploy.mjs']);
    assert.equal(result.provider_candidates.github.number_of_files,0);
    assert.equal(result.provider_candidates.vercel.number_of_files,0);
    assert.ok(!JSON.stringify(result).includes('SECRET_TOKEN_EXAMPLE'));
  }finally{rmSync(dir,{recursive:true,force:true})}
});
test('inventory does not follow symlinks',()=>{
  const dir=mkdtempSync(join(tmpdir(),'atlas-inv-'));
  try {
    writeFileSync(join(dir,'real.mjs'),'Cloudflare');
    symlinkSync(join(dir,'real.mjs'),join(dir,'alias.mjs'));
    assert.deepEqual(inventory(dir).provider_candidates.cloudflare.files,['real.mjs']);
  }finally{rmSync(dir,{recursive:true,force:true})}
});
