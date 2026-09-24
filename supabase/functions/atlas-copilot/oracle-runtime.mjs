const PRIVATE_ENTITLEMENT='atlas.oracle.private';

const DAILY_SPREAD=[
  {key:'energy',label:'Energy of the day'},
  {key:'notice',label:'What to notice'},
  {key:'direction',label:'Direction'},
];
const FOCUSED_SPREAD=[
  {key:'energy',label:'Current energy'},
  {key:'challenge',label:'What to examine'},
  {key:'guidance',label:'Reflective guidance'},
];
const FULL_SPREAD=[
  {key:'general',label:'General energy'},
  {key:'love',label:'Love'},
  {key:'money',label:'Money'},
  {key:'work',label:'Work'},
  {key:'challenge',label:'Challenge'},
  {key:'advice',label:'Advice'},
  {key:'closing',label:'Closing message'},
];

function fail(code,status=500){return Object.assign(new Error(code),{code,status});}
function readingType(value){
  const candidate=String(value||'daily');
  const allowed=['daily','love','money','work','emotional','spiritual','full'];
  if(!allowed.includes(candidate))throw fail('invalid_reading_type',400);
  return candidate;
}
function spreadFor(type){return type==='full'?FULL_SPREAD:type==='daily'?DAILY_SPREAD:FOCUSED_SPREAD;}
function hashSeed(seed){let hash=0x811c9dc5;for(let i=0;i<seed.length;i+=1){hash^=seed.charCodeAt(i);hash=Math.imul(hash,0x01000193);}return hash>>>0;}
function nextRandom(state){return(Math.imul(state,1664525)+1013904223)>>>0;}
function draw(cards,count,seed){
  if(!Number.isInteger(count)||count<0)throw fail('invalid_draw_count',400);
  if(count>cards.length)throw fail('oracle_deck_insufficient',409);
  const pool=[...cards],out=[];let state=hashSeed(seed||'atlas-oracle');
  for(let i=0;i<count;i+=1){state=nextRandom(state);out.push(pool.splice(state%pool.length,1)[0]);}
  return out;
}
function normalizeCard(row){
  return{id:String(row.id),slug:String(row.slug),title:String(row.title),shortMessage:String(row.short_message||''),longMessage:String(row.long_message||''),category:String(row.category||'')};
}
function interpretationFor(spread,cards){
  return spread.map((position,index)=>({position,card:cards[index],reflection:`${position.label}: ${cards[index].longMessage}`}));
}
async function parseResponse(response){
  const text=await response.text();let data=null;
  try{data=text?JSON.parse(text):null;}catch{data=text;}
  if(!response.ok){
    const code=data&&typeof data==='object'&&(data.message||data.error)?String(data.message||data.error):`oracle_request_failed_${response.status}`;
    throw fail(code,response.status);
  }
  return data;
}
async function requestBody(request){
  if(request.method==='GET'||request.method==='HEAD')return{};
  try{const body=await request.clone().json();return body&&typeof body==='object'?body:{};}catch{return{};}
}

export function createOracleRuntime({supabaseUrl,publishableKey,fetchFn=fetch}={}){
  if(!supabaseUrl||!publishableKey)throw new TypeError('oracle_runtime_configuration_required');

  async function callerFor(request){
    const authorization=request.headers.get('authorization')||'';
    if(!authorization.toLowerCase().startsWith('bearer '))throw fail('authentication_required',401);
    const response=await fetchFn(`${supabaseUrl}/auth/v1/user`,{headers:{apikey:publishableKey,authorization}});
    if(!response.ok)throw fail('authentication_required',401);
    const user=await response.json().catch(()=>null);
    if(!user?.id)throw fail('authentication_required',401);
    return{id:String(user.id),authorization};
  }
  async function rest(caller,path,init={}){
    return fetchFn(`${supabaseUrl}/rest/v1${path}`,{
      ...init,
      headers:{apikey:publishableKey,authorization:caller.authorization,'content-type':'application/json',...(init.headers||{})},
    });
  }
  async function rpc(caller,name,body={}){
    return parseResponse(await rest(caller,`/rpc/${name}`,{method:'POST',body:JSON.stringify(body)}));
  }
  async function entitled(caller){return Boolean(await rpc(caller,'has_oracle_entitlement'));}
  async function requireEntitlement(caller){if(!(await entitled(caller)))throw fail('oracle_not_entitled',403);}
  async function loadDeck(caller){
    const rows=await parseResponse(await rest(caller,'/oracle_decks?slug=eq.mensajes-oraculo-mistico&is_active=eq.true&select=id,slug,name,description,version,expected_card_count,verified_card_count,is_complete&limit=1'));
    const deck=Array.isArray(rows)?rows[0]:null;
    if(!deck?.id)throw fail('oracle_deck_unavailable',503);
    return deck;
  }
  async function loadCards(caller,deckId){
    const rows=await parseResponse(await rest(caller,`/oracle_cards?deck_id=eq.${encodeURIComponent(deckId)}&is_active=eq.true&select=id,deck_id,slug,title,short_message,long_message,category,image_asset_key,position&order=position.asc`));
    return Array.isArray(rows)?rows:[];
  }
  async function status(caller){
    if(!(await entitled(caller)))return{ok:true,entitled:false,entitlement:PRIVATE_ENTITLEMENT,deck:null};
    return{ok:true,entitled:true,entitlement:PRIVATE_ENTITLEMENT,deck:await loadDeck(caller)};
  }
  async function deck(caller){
    await requireEntitlement(caller);const record=await loadDeck(caller);
    return{ok:true,deck:record,cards:await loadCards(caller,String(record.id))};
  }
  async function readings(caller){
    await requireEntitlement(caller);
    const rows=await parseResponse(await rest(caller,'/oracle_readings?select=id,reading_type,prompt_context,interpretation,created_at,deck_id&order=created_at.desc&limit=50'));
    return{ok:true,readings:rows};
  }
  async function ownedReading(caller,id){
    await requireEntitlement(caller);
    const rows=await parseResponse(await rest(caller,`/oracle_readings?id=eq.${encodeURIComponent(id)}&select=id,reading_type,prompt_context,interpretation,created_at,deck_id,organization_id&limit=1`));
    const reading=Array.isArray(rows)?rows[0]:null;
    if(!reading?.id)throw fail('oracle_reading_not_found',404);
    const [cardResponse,noteResponse,favoriteResponse]=await Promise.all([
      rest(caller,`/oracle_reading_cards?reading_id=eq.${encodeURIComponent(id)}&select=id,card_id,spread_position,sequence,oracle_cards(id,slug,title,short_message,long_message,category,image_asset_key,position)&order=sequence.asc`),
      rest(caller,`/oracle_notes?reading_id=eq.${encodeURIComponent(id)}&select=id,note,updated_at&limit=1`),
      rest(caller,'/oracle_favorites?select=card_id'),
    ]);
    const [cards,notes,favorites]=await Promise.all([parseResponse(cardResponse),parseResponse(noteResponse),parseResponse(favoriteResponse)]);
    return{ok:true,reading,cards,note:Array.isArray(notes)?notes[0]||null:null,favorites};
  }
  async function createReading(caller,body={}){
    await requireEntitlement(caller);
    const type=readingType(body.reading_type),focus=String(body.focus||'').trim().slice(0,2000)||null;
    const organizationId=body.organization_id?String(body.organization_id):null;
    const deckRecord=await loadDeck(caller);
    const verified=(await loadCards(caller,String(deckRecord.id))).map(normalizeCard);
    const spread=spreadFor(type);
    if(verified.length<spread.length)throw fail('oracle_deck_insufficient',409);
    const id=crypto.randomUUID(),selected=draw(verified,spread.length,id),interpretation=interpretationFor(spread,selected);
    const inserted=await parseResponse(await rest(caller,'/oracle_readings?select=id,reading_type,prompt_context,interpretation,created_at,deck_id,organization_id',{
      method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({id,user_id:caller.id,organization_id:organizationId,deck_id:String(deckRecord.id),reading_type:type,prompt_context:focus,interpretation})
    }));
    const reading=Array.isArray(inserted)?inserted[0]:null;
    if(!reading?.id)throw fail('oracle_reading_persist_failed',500);
    const selectedRows=spread.map((position,sequence)=>({reading_id:id,card_id:selected[sequence].id,spread_position:position.key,sequence}));
    const persisted=await parseResponse(await rest(caller,'/oracle_reading_cards?select=id,reading_id,card_id,spread_position,sequence',{
      method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(selectedRows)
    }));
    return{ok:true,reading,cards:persisted,selected_cards:selected,interpretation,disclaimer:'This reading is symbolic reflection, not a guaranteed prediction or medical, financial, or legal advice.'};
  }
  async function note(caller,body={}){
    await requireEntitlement(caller);const id=String(body.reading_id||'');if(!id)throw fail('reading_id_required',400);
    await ownedReading(caller,id);
    const value=String(body.note||'').slice(0,12000);
    const rows=await parseResponse(await rest(caller,'/oracle_notes?on_conflict=user_id,reading_id&select=id,reading_id,note,updated_at',{
      method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify({user_id:caller.id,reading_id:id,note:value,updated_at:new Date().toISOString()})
    }));
    return{ok:true,note:Array.isArray(rows)?rows[0]||null:null};
  }
  async function favorite(caller,body={}){
    await requireEntitlement(caller);const cardId=String(body.card_id||'');if(!cardId)throw fail('card_id_required',400);
    if(body.favorite!==false){
      const rows=await parseResponse(await rest(caller,'/oracle_favorites?on_conflict=user_id,card_id&select=id,card_id,created_at',{
        method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify({user_id:caller.id,card_id:cardId})
      }));
      return{ok:true,favorite:true,record:Array.isArray(rows)?rows[0]||null:null};
    }
    await parseResponse(await rest(caller,`/oracle_favorites?user_id=eq.${encodeURIComponent(caller.id)}&card_id=eq.${encodeURIComponent(cardId)}`,{method:'DELETE',headers:{Prefer:'return=minimal'}}));
    return{ok:true,favorite:false};
  }

  async function handleApi({request,url,action}){
    const caller=await callerFor(request),body=await requestBody(request);
    if(action==='status')return{status:200,body:await status(caller)};
    if(action==='deck')return{status:200,body:await deck(caller)};
    if(action==='readings')return{status:200,body:await readings(caller)};
    if(action==='reading'){
      const id=url.searchParams.get('id')||'';if(!id)throw fail('reading_id_required',400);
      return{status:200,body:await ownedReading(caller,id)};
    }
    if(action==='create'){
      if(request.method!=='POST')throw fail('method_not_allowed',405);
      return{status:201,body:await createReading(caller,body)};
    }
    if(action==='note'){
      if(request.method!=='POST')throw fail('method_not_allowed',405);
      return{status:200,body:await note(caller,body)};
    }
    if(action==='favorite'){
      if(request.method!=='POST')throw fail('method_not_allowed',405);
      return{status:200,body:await favorite(caller,body)};
    }
    throw fail('not_found',404);
  }

  async function createFromIntent({request,readingType,focus,organizationId}){
    const caller=await callerFor(request);
    return createReading(caller,{reading_type:readingType,focus,organization_id:organizationId});
  }

  return Object.freeze({handleApi,createFromIntent});
}
