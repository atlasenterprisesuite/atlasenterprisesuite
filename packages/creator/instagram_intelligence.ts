/** ATLAS 777: Offline import of user-authorized Instagram metadata, never scraping. */
export type FollowedAccount = { handle: string; source: 'export' | 'manual' | 'screenshot' };
export type ReelRecord = {
  url: string; code: string; kind: 'reel'|'p'|'tv'; handle: string|null;
  status: 'pending'|'in_review'|'documented'|'blocked';
  observation: string; conclusion: string; sources: string[];
};
const hosts = new Set(['instagram.com','www.instagram.com','m.instagram.com']);
export function normalizeInstagramHandle(input: unknown): string|null {
  if (typeof input !== 'string') return null;
  let s=input.trim().replace(/^@/,'');
  if (/^https?:\/\//i.test(s)) {
    try { const u=new URL(s);if(!hosts.has(u.hostname.toLowerCase()))return null;s=u.pathname.split('/').filter(Boolean)[0]||''; }
    catch {return null;}
  }
  return /^[a-z0-9._]{1,30}$/i.test(s)?s.toLowerCase():null;
}
export function parseInstagramFollowingExport(data: unknown): FollowedAccount[] {
  if (!data||typeof data!=='object')throw new Error('invalid_export');
  const obj=data as Record<string,unknown>;
  const list=Array.isArray(data)?data:obj.relationships_following??obj.following_accounts??obj.following;
  if (!Array.isArray(list))throw new Error('following_list_missing');
  const result=new Map<string,FollowedAccount>();
  for (const item of list) {
    if (!item||typeof item!=='object')continue;
    const e=item as {title?:unknown;username?:unknown;href?:unknown;string_list_data?:Array<{value?:unknown;href?:unknown}>};
    for (const raw of [e.title,e.username,e.string_list_data?.[0]?.value,e.string_list_data?.[0]?.href,e.href]){
      const h=normalizeInstagramHandle(raw);if(h){result.set(h,{handle:h,source:'export'});break;}
    }
  }
  return [...result.values()].sort((a,b)=>a.handle.localeCompare(b.handle));
}
export function normalizeInstagramMediaUrl(value: string) {
  try {const u=new URL(value);if(u.protocol!=='https:'||!hosts.has(u.hostname.toLowerCase())||u.username||u.password)return null;
    const m=u.pathname.match(/^\/(reel|p|tv)\/([a-z0-9_-]{4,})\/?$/i);
    return m?{url:'https://www.instagram.com/'+m[1]+'/'+m[2]+'/',kind:m[1] as ReelRecord['kind'],code:m[2]}:null;
  }catch{return null;}
}
export function ingestInstagramLinks(existing: ReelRecord[],lines: string){
  const map=new Map(existing.map(item=>[item.url,item])),invalid:string[]=[];let added=0,duplicates=0;
  for(const line of lines.split(/\r?\n/)){
    if(!line.trim())continue;const match=line.match(/https:\/\/[^\s<>"']+/i);
    const url=match?normalizeInstagramMediaUrl(match[0].replace(/[).,;]+$/,'')):null;
    if(!url){invalid.push(line);continue;}
    const handle=normalizeInstagramHandle(line.slice(0,match!.index).trim());
    const original=map.get(url.url);if(original){duplicates++;if(!original.handle&&handle)map.set(url.url,{...original,handle});continue;}
    added++;map.set(url.url,{...url,handle,status:'pending',observation:'',conclusion:'',sources:[]});
  }
  return {items:[...map.values()],added,duplicates,invalid};
}
/** Evidence gate is necessary, not a claim of independent verification of media. */
export function canDocumentInstagramResearch(item: ReelRecord):boolean {
  return Boolean(item.observation.trim()&&item.conclusion.trim()&&item.sources.some(s=>{
    try {const u=new URL(s);return u.protocol==='https:'&&Boolean(u.hostname);}catch{return false;}
  }));
}
