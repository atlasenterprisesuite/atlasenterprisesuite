function fail(code,status=500,details={}){return Object.assign(new Error(code),{code,status,...details});}
const LABEL=Object.freeze({'atlas-local':'ATLAS Local',openai:'OpenAI',bedrock:'OpenAI on Amazon Bedrock',gemini:'Gemini','codex-sovereign':'Codex Sovereign'});
const EDITORIAL_DRAFTER='openai';
const EDITORIAL_REVIEWER='gemini';

function reconcile(contributions){return contributions.map(item=>`### ${LABEL[item.provider]||item.provider}\n${item.text}`).join('\n\n');}
function cleanText(value){return typeof value==='string'?value.trim():'';}
function parseEditorialReview(value){
  const text=cleanText(value);
  if(!text)return {review:null,final:''};
  const reviewMarker='ATLAS_REVIEW:';
  const finalMarker='ATLAS_FINAL:';
  const reviewIndex=text.indexOf(reviewMarker);
  const finalIndex=text.indexOf(finalMarker);
  if(finalIndex<0)return {review:null,final:'',valid:false};
  const ordered=reviewIndex>=0&&finalIndex>reviewIndex;
  const review=ordered
    ?cleanText(text.slice(reviewIndex+reviewMarker.length,finalIndex))
    :null;
  const final=ordered?cleanText(text.slice(finalIndex+finalMarker.length)):'';
  return {review:review||null,final,valid:Boolean(ordered&&review&&final)};
}
function editorialInstructions(base){
  return `${String(base||'').trim()}

ATLAS collaborative review role:
- You are the independent review and refinement layer.
- Evaluate the draft against the user's original request for factual accuracy, completeness, clarity, internal consistency, safety, and unsupported claims.
- Correct weaknesses rather than merely describing them.
- Preserve useful details from the draft unless they are wrong, redundant, or unsupported.
- Do not invent sources, tool results, records, or production state.
- Match the user's language unless the request explicitly asks for another language.
- Return exactly two sections:
ATLAS_REVIEW:
A concise quality review with strengths and corrections.
ATLAS_FINAL:
The complete improved answer that should be shown to the user.
- Do not add text before ATLAS_REVIEW or after the final answer.`;
}
function editorialInput(input,draft){
  return [
    ...(Array.isArray(input)?input:[]),
    {role:'assistant',content:`ATLAS draft candidate from ${LABEL[EDITORIAL_DRAFTER]}:\n${draft}`},
    {role:'user',content:'Independently review the draft above and produce the required ATLAS_REVIEW and ATLAS_FINAL sections.'},
  ];
}
function aggregateUsage(contributions){return {by_provider:Object.fromEntries(contributions.map(item=>[item.provider,item.usage||{}]))};}
function aggregateProvenance(contributions){return contributions.flatMap(item=>(item.provenance||[]).map(source=>({provider:item.provider,source})));}
function aggregateToolCalls(contributions){return contributions.flatMap(item=>(item.tool_calls||[]).map(call=>({...call,provider:item.provider})));}

export function createCouncilOrchestrator({registry}={}){
  if(!registry)throw new TypeError('council_registry_required');

  async function executeParallel({ids,context,route,instructions,input,max_output_tokens}){
    const settled=await Promise.allSettled(ids.map(async id=>{
      const adapter=registry.get(id);
      if(!adapter)throw fail('provider_not_configured',503,{provider:id});
      return adapter.execute({context,route:{...route,mode:'council',providers:ids,provider:id},instructions,input,max_output_tokens});
    }));
    const contributions=[];const failures=[];
    for(let i=0;i<settled.length;i++){
      const item=settled[i];
      if(item.status==='fulfilled')contributions.push({...item.value,provider:ids[i],role:'contributor'});
      else failures.push({provider:ids[i],error:item.reason?.code||'provider_unavailable'});
    }
    if(contributions.length<2)throw fail('provider_unavailable',502,{failures});
    return {
      provider:'atlas-council',
      model:null,
      strategy:'parallel',
      review:null,
      text:reconcile(contributions),
      contributions,
      failures,
      capabilities_used:[...(route?.capabilities||['generation'])],
      usage:aggregateUsage(contributions),
      provenance:aggregateProvenance(contributions),
      tool_calls:aggregateToolCalls(contributions),
    };
  }

  async function executeEditorial({ids,context,route,instructions,input,max_output_tokens}){
    if(!ids.includes(EDITORIAL_DRAFTER)||!ids.includes(EDITORIAL_REVIEWER)){
      throw fail('capability_unavailable',503,{strategy:'editorial',required_providers:[EDITORIAL_DRAFTER,EDITORIAL_REVIEWER]});
    }
    const drafter=registry.get(EDITORIAL_DRAFTER);
    const reviewer=registry.get(EDITORIAL_REVIEWER);
    if(!drafter||!reviewer)throw fail('provider_not_configured',503,{strategy:'editorial'});

    let draft;
    try{
      draft=await drafter.execute({
        context,
        route:{...route,mode:'council',providers:ids,provider:EDITORIAL_DRAFTER},
        instructions,
        input,
        max_output_tokens,
      });
    }catch(error){
      throw fail('provider_unavailable',502,{failures:[{provider:EDITORIAL_DRAFTER,error:error?.code||'provider_unavailable'}]});
    }

    let reviewed;
    try{
      reviewed=await reviewer.execute({
        context,
        route:{...route,mode:'council',providers:ids,provider:EDITORIAL_REVIEWER},
        instructions:editorialInstructions(instructions),
        input:editorialInput(input,draft.text),
        max_output_tokens,
      });
    }catch(error){
      throw fail('provider_unavailable',502,{failures:[{provider:EDITORIAL_REVIEWER,error:error?.code||'provider_unavailable'}]});
    }

    const parsed=parseEditorialReview(reviewed.text);
    if(!parsed.valid||!parsed.final)throw fail('provider_invalid_output',502,{provider:EDITORIAL_REVIEWER,strategy:'editorial'});
    const contributions=[
      {...draft,provider:EDITORIAL_DRAFTER,role:'draft'},
      {...reviewed,provider:EDITORIAL_REVIEWER,role:'review'},
    ];
    return {
      provider:'atlas-council',
      model:null,
      strategy:'editorial',
      review:parsed.review,
      text:parsed.final,
      contributions,
      failures:[],
      capabilities_used:[...(route?.capabilities||['generation'])],
      usage:aggregateUsage(contributions),
      provenance:aggregateProvenance(contributions),
      tool_calls:aggregateToolCalls([{...reviewed,provider:EDITORIAL_REVIEWER}]),
    };
  }

  async function execute({providerIds=[],context,route,instructions,input,max_output_tokens=3000,strategy='parallel'}={}){
    const ids=[...new Set(providerIds)];
    if(ids.length<2)throw fail('capability_unavailable',503,{minimum_providers:2});
    if(strategy==='editorial')return executeEditorial({ids,context,route,instructions,input,max_output_tokens});
    return executeParallel({ids,context,route,instructions,input,max_output_tokens});
  }

  return Object.freeze({execute});
}
