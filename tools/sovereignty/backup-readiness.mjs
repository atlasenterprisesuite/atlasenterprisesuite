#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {createReadStream,lstatSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const SHA=/^[a-f0-9]{40}$/, DIGEST=/^[a-f0-9]{64}$/;
export async function checkBackup({manifestPath,archivePath,expectedCommit,now=new Date()}) {
  const issues=[];
  if(!SHA.test(expectedCommit||'')) issues.push('invalid_expected_commit');
  let manifest;
  try {
    const s=lstatSync(manifestPath);
    if(!s.isFile()||s.isSymbolicLink()||s.size>65536)throw Error('unsafe manifest');
    manifest=JSON.parse(readFileSync(manifestPath,'utf8'));
  } catch { issues.push('invalid_manifest'); }
  if(!manifest||typeof manifest!=='object'||Array.isArray(manifest))
    return {ok:false,restore_verified:false,production_ready:false,issues};
  if(manifest.schema_version!=='atlas.backup-readiness.v1')issues.push('wrong_schema');
  if(manifest.kind!=='postgresql-pgdump-custom')issues.push('unsupported_backup_kind');
  if(manifest.source?.environment!=='isolated-test')issues.push('live_environment_not_allowed');
  if(!/^[a-zA-Z0-9_-]{1,64}$/.test(manifest.source?.database||''))issues.push('invalid_database_label');
  if(manifest.source?.commit_sha!==expectedCommit)issues.push('commit_mismatch');
  const date=typeof manifest.created_at==='string'?Date.parse(manifest.created_at):NaN;
  const time=new Date(now).getTime();
  if(!Number.isFinite(date)||!Number.isFinite(time)||date>time+300000||time-date>86400000||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(manifest.created_at||''))
    issues.push('expired_or_invalid_timestamp');
  if(!DIGEST.test(manifest.archive?.sha256||''))issues.push('invalid_archive_digest');
  if(!Number.isSafeInteger(manifest.archive?.size_bytes)||manifest.archive.size_bytes<5)issues.push('invalid_archive_size');
  try {
    const a=lstatSync(archivePath),m=lstatSync(manifestPath);
    if(!a.isFile()||a.isSymbolicLink()||a.dev===m.dev&&a.ino===m.ino)throw Error('unsafe archive');
    if(a.size!==manifest.archive?.size_bytes)issues.push('archive_size_mismatch');
    const hash=createHash('sha256');
    let prefix=Buffer.alloc(0);
    for await(const chunk of createReadStream(archivePath)) {
      if(prefix.length<5)prefix=Buffer.concat([prefix,chunk.subarray(0,5-prefix.length)]);
      hash.update(chunk);
    }
    if(prefix.toString('ascii')!=='PGDMP')issues.push('not_pg_custom_archive');
    if(hash.digest('hex')!==manifest.archive?.sha256)issues.push('archive_digest_mismatch');
  }catch{issues.push('archive_unreadable');}
  return {schema_version:'atlas.backup-readiness.result.v1',
    ok:issues.length===0,restore_verified:false,production_ready:false,issues};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const a=process.argv.slice(2);
  if(a.length!==6||a[0]!=='--manifest'||a[2]!=='--archive'||a[4]!=='--commit'){
    process.stderr.write('Usage: node backup-readiness.mjs --manifest path --archive path --commit SHA\n');
    process.exitCode=2;
  }else checkBackup({manifestPath:a[1],archivePath:a[3],expectedCommit:a[5]})
    .then(r=>{process.stdout.write(JSON.stringify(r,null,2)+'\n');if(!r.ok)process.exitCode=2;})
    .catch(()=>{process.stderr.write('SOV-003 fail closed\n');process.exitCode=2;});
}
