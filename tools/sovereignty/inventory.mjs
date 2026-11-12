#!/usr/bin/env node
/** Offline, read-only inventory of provider keyword candidates. Never prints source. */
import { readdirSync, lstatSync, readFileSync } from 'node:fs';
import { resolve, relative, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
const OMIT = new Set(['.git','.next','.cache','.turbo','node_modules','dist','build','coverage','vendor','.venv','venv','.terraform','.wrangler','.output','secrets','private']);
const ALLOWED = new Set(['.js','.jsx','.ts','.tsx','.mjs','.cjs','.json','.jsonc','.yaml','.yml','.toml','.sh','.md','.sql','.tf']);
const patterns = {
  github:/(?:github(?:usercontent)?\.com|GITHUB_[A-Z_]+|github-actions|actions\/checkout)/i,
  cloudflare:/(?:cloudflare|wrangler|CF_[A-Z_]+|\.workers\.dev)/i,
  supabase:/(?:supabase|SUPABASE_[A-Z_]+)/i,
  vercel:/(?:vercel|VERCEL_[A-Z_]+)/i
};
export function inventory(root) {
  const base = resolve(root);
  const hits = Object.fromEntries(Object.keys(patterns).map(p=>[p,[]]));
  const warnings = [];
  let examined=0, truncated=false;
  const queue=[base];
  while(queue.length) {
    let entries;
    try { entries=readdirSync(queue.pop(), {withFileTypes:true}); }
    catch { warnings.push('A directory could not be read'); continue; }
    // Use absolute entry paths without following symbolic links.
    for(const entry of entries) {
      if (entry.name === '.env' || entry.name.startsWith('.env.') ||
          entry.name.endsWith('.pem') || entry.name.endsWith('.key')) continue;
      const parent = entry.parentPath || entry.path;
      const full = join(parent, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (!OMIT.has(entry.name)) queue.push(full);
        continue;
      }
      if (!entry.isFile() || !ALLOWED.has(extname(entry.name))) continue;
      if (examined >= 20000) {truncated=true;break;}
      examined++;
      try {
        if (lstatSync(full).size > 1048576) continue;
        const content=readFileSync(full,'utf8');
        const pathname=relative(base,full).replaceAll('\\','/');
        for(const [provider,re] of Object.entries(patterns)) if(re.test(content)) hits[provider].push(pathname);
      } catch { warnings.push('One file could not be inspected'); }
    }
    if(truncated)break;
  }
  for(const list of Object.values(hits))list.sort();
  return {
    schema_version:'atlas.sovereignty.inventory.v1',
    scan_type:'static keyword candidates, not confirmed operational dependencies',
    files_examined:examined, truncated,
    provider_candidates:Object.fromEntries(Object.entries(hits).map(([p,v])=>[p,{files:v,number_of_files:v.length}])),
    warnings:[...warnings,...(truncated?['Scan capped; incomplete']:[]),'Absence of hits does not prove independence']
  };
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv.length!==4 || process.argv[2]!=='--repo'){
    process.stderr.write('Usage: node inventory.mjs --repo /path/to/repo\n');
    process.exitCode=2;
  } else {
    try {
      const path=resolve(process.argv[3]);
      if(!lstatSync(path).isDirectory())throw new Error('Expected a directory');
      const result=inventory(path);
      process.stdout.write(JSON.stringify(result,null,2)+'\n');
      if(result.truncated)process.exitCode=2;
    } catch(e){process.stderr.write('Inventory failed: '+e.message+'\n');process.exitCode=2;}
  }
}
