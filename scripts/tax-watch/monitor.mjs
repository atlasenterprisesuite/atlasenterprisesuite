// ATLAS Tax Watch: conservative source-change queue, not legal interpretation.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const sources = [
  {id:'us-irs-news',scope:'US/federal',url:'https://www.irs.gov/newsroom'},
  {id:'us-irs-forms',scope:'US/federal',url:'https://www.irs.gov/forms-instructions'},
  {id:'fl-dor',scope:'US/Florida',url:'https://floridarevenue.com/taxes/Pages/default.aspx'},
  {id:'uk-hmrc',scope:'UK',url:'https://www.gov.uk/government/organisations/hm-revenue-customs'},
  {id:'au-ato',scope:'Australia',url:'https://www.ato.gov.au/'},
  {id:'ca-cra',scope:'Canada/federal',url:'https://www.canada.ca/en/revenue-agency.html'},
  {id:'br-rfb',scope:'Brazil/federal',url:'https://www.gov.br/receitafederal/pt-br'},
  {id:'za-sars',scope:'South Africa',url:'https://www.sars.gov.za/'},
  {id:'ie-revenue',scope:'Ireland',url:'https://www.revenue.ie/en/index.aspx'}
];
const marker='<!-- ATLAS_TAX_WATCH_STATE_V1 ';
const gh=(args,input)=>execFileSync('gh',args,{encoding:'utf8',input,timeout:30000});
const digest=s=>createHash('sha256').update(s).digest('hex');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function fetchWithRetry(url){
  let last;
  for(let attempt=0;attempt<3;attempt++){
    try {
      const response=await fetch(url,{signal:AbortSignal.timeout(12000),headers:{'User-Agent':'ATLAS-Tax-Watch/1.0 (compliance monitoring)'}});
      if(!response.ok)throw Error('HTTP '+response.status);
      const type=response.headers.get('content-type')||'';
      if(!/text\/html|text\/plain|application\/xml|application\/rss\+xml/.test(type))throw Error('Unexpected content type');
      const text=await response.text();
      if(text.length<200||text.length>3000000)throw Error('Unexpected source size');
      return digest(text.replace(/\s+/g,' '));
    }catch(e){last=e;if(attempt<2)await sleep(1500*(attempt+1));}
  }
  throw last;
}
function parseState(body){
  const match=body.match(/<!-- ATLAS_TAX_WATCH_STATE_V1 ([A-Za-z0-9+/=]+) -->/);
  if(!match)return {};
  const data=JSON.parse(Buffer.from(match[1],'base64').toString('utf8'));
  if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Invalid state');
  return data;
}
function encodeState(state){return marker+Buffer.from(JSON.stringify(state)).toString('base64')+' -->';}
async function main(){
  if(!process.env.GH_REPO||!process.env.GH_TOKEN)throw Error('GitHub repository/token required');
  const repo=process.env.GH_REPO;
  const issues=JSON.parse(gh(['issue','list','--repo',repo,'--state','open','--search','in:title "[ATLAS TAX WATCH] Source review queue"','--json','number,title,body','--limit','100']));
  const matches=issues.filter(i=>i.title==='[ATLAS TAX WATCH] Source review queue');
  if(matches.length>1)throw Error('Duplicate state issues: fail closed');
  const issue=matches[0];
  const previous=issue?parseState(issue.body||''):{};
  const next={...previous},changed=[],failures=[];
  for(const source of sources){
    try{
      const hash=await fetchWithRetry(source.url);
      if(previous[source.id]&&previous[source.id]!==hash)changed.push(source);
      next[source.id]=hash;
    }catch(e){failures.push(source.id+': '+String(e.message).slice(0,100));}
  }
  const lines=[
    '# ATLAS Global Tax Watch — official-source review queue',
    'This is a **source-difference signal**, NOT a confirmed material tax change. Human/legal or separately verified rule review is mandatory before notification or production.',
    'Scope is limited to configured official landing pages, NOT worldwide exhaustive coverage.',
    'Last check: '+new Date().toISOString(),
    '## Sources changed (unverified candidates)',
    ...(changed.length?changed.map(s=>'- '+s.scope+' — '+s.url):['- None detected']),
    '## Source failures (fail closed)',
    ...(failures.length?failures.map(s=>'- '+s):['- None']),
    '## Required review fields',
    'Authority, official document URL, publication date, effective period, jurisdictional scope, affected entities, status (final/proposal), ATLAS modules, severity, calculations/forms/payroll/e-file/reporting, and concrete action.',
    '## Persistent machine state (do not edit)',
    encodeState(next)
  ];
  const body=lines.join('\n');
  if(issue)gh(['issue','edit',String(issue.number),'--repo',repo,'--body-file','-'],body);
  else gh(['issue','create','--repo',repo,'--title','[ATLAS TAX WATCH] Source review queue','--body-file','-'],body);
  console.log(JSON.stringify({checked:sources.length,changed:changed.length,failures:failures.length}));
  if(failures.length)process.exitCode=1;
}
main().catch(e=>{console.error('Fail closed:',e.message);process.exitCode=1;});
