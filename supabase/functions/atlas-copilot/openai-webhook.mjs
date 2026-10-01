function fail(code,status=400){return Object.assign(new Error(code),{code,status});}

function decodeBase64(value){
  const normalized=String(value||'').replace(/-/g,'+').replace(/_/g,'/');
  const padded=normalized+'='.repeat((4-normalized.length%4)%4);
  try{
    const raw=atob(padded);
    return new Uint8Array([...raw].map(char=>char.charCodeAt(0)));
  }catch{return new Uint8Array();}
}

function signatureCandidates(header){
  return String(header||'')
    .split(/[\s]+/)
    .flatMap(part=>part.split(';'))
    .map(part=>part.trim())
    .filter(Boolean)
    .map(part=>{
      const comma=part.indexOf(',');
      if(comma<0)return null;
      const version=part.slice(0,comma).trim();
      const signature=part.slice(comma+1).trim();
      return version==='v1'&&signature?signature:null;
    })
    .filter(Boolean);
}

function constantTimeEqual(left,right){
  if(left.length!==right.length||!left.length)return false;
  let difference=0;
  for(let index=0;index<left.length;index+=1)difference|=left[index]^right[index];
  return difference===0;
}

async function hmacSha256(secret,message){
  const key=await crypto.subtle.importKey('raw',secret,{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(message)));
}

export async function sha256Hex(value){
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(value||'')));
  return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}

export async function verifyOpenAIWebhook({body,headers,secret,now=Date.now,toleranceSeconds=300}={}){
  const webhookId=String(headers?.get?.('webhook-id')||'').trim();
  const timestampRaw=String(headers?.get?.('webhook-timestamp')||'').trim();
  const signatureHeader=String(headers?.get?.('webhook-signature')||'').trim();
  if(!webhookId||!timestampRaw||!signatureHeader||!secret)throw fail('invalid_webhook_signature',400);
  const timestamp=Number(timestampRaw);
  if(!Number.isFinite(timestamp))throw fail('invalid_webhook_signature',400);
  const ageSeconds=Math.abs(now()/1000-timestamp);
  if(ageSeconds>Math.max(30,Number(toleranceSeconds)||300))throw fail('webhook_timestamp_expired',400);

  const rawSecret=String(secret).trim().replace(/^whsec_/,'');
  const secretBytes=decodeBase64(rawSecret);
  if(!secretBytes.length)throw fail('webhook_secret_invalid',500);
  const signed=`${webhookId}.${timestampRaw}.${String(body||'')}`;
  const expected=await hmacSha256(secretBytes,signed);
  const signatures=signatureCandidates(signatureHeader);
  if(!signatures.some(signature=>constantTimeEqual(expected,decodeBase64(signature))))throw fail('invalid_webhook_signature',400);
  return {webhookId,timestamp};
}
