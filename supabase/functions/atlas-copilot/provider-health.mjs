const DEFAULT_FAILURE_THRESHOLD=3;
const DEFAULT_COOLDOWN_MS=30_000;
const DEFAULT_LATENCY_SLO_MS=8_000;
const EWMA_ALPHA=0.25;

function cleanNumber(value,fallback){const n=Number(value);return Number.isFinite(n)&&n>=0?n:fallback;}
function errorWeight(code){if(code==='provider_rate_limited')return 1;if(code==='provider_unavailable')return 1;if(code==='provider_auth_failed')return 2;return 0;}
function stateFor(entry,now){
  if(entry.open_until>now)return'open';
  if(entry.open_until>0&&entry.failures>0)return'half-open';
  return'closed';
}
function scoreFor(entry,now,latencySloMs){
  if(stateFor(entry,now)==='open')return 0;
  const latency=entry.ewma_latency_ms||0;
  const latencyPenalty=latency>latencySloMs?Math.min(35,((latency-latencySloMs)/latencySloMs)*35):Math.min(15,(latency/latencySloMs)*15);
  const failurePenalty=Math.min(45,entry.failures*15);
  const reliabilityTotal=entry.successes+entry.errors;
  const reliabilityPenalty=reliabilityTotal?Math.min(25,(entry.errors/reliabilityTotal)*25):0;
  return Math.max(1,Math.round(100-latencyPenalty-failurePenalty-reliabilityPenalty));
}

export function createProviderHealthController({
  clock=Date.now,
  failureThreshold=DEFAULT_FAILURE_THRESHOLD,
  cooldownMs=DEFAULT_COOLDOWN_MS,
  latencySloMs=DEFAULT_LATENCY_SLO_MS,
}={}){
  const entries=new Map();
  const threshold=Math.max(1,Math.floor(cleanNumber(failureThreshold,DEFAULT_FAILURE_THRESHOLD)));
  const cooldown=Math.max(1_000,cleanNumber(cooldownMs,DEFAULT_COOLDOWN_MS));
  const slo=Math.max(100,cleanNumber(latencySloMs,DEFAULT_LATENCY_SLO_MS));
  function entry(id){
    if(!entries.has(id))entries.set(id,{failures:0,successes:0,errors:0,open_until:0,ewma_latency_ms:0,last_error:null,last_event_at:null});
    return entries.get(id);
  }
  function recordSuccess(id,{latency_ms=0}={}){
    const e=entry(id),latency=Math.max(0,Number(latency_ms)||0);
    e.successes+=1;e.failures=0;e.open_until=0;e.last_error=null;e.last_event_at=new Date(clock()).toISOString();
    e.ewma_latency_ms=e.ewma_latency_ms?Math.round((EWMA_ALPHA*latency)+((1-EWMA_ALPHA)*e.ewma_latency_ms)):Math.round(latency);
  }
  function recordFailure(id,{code='provider_unavailable',latency_ms=0}={}){
    const e=entry(id),weight=errorWeight(code),latency=Math.max(0,Number(latency_ms)||0);
    e.errors+=1;e.failures+=weight;e.last_error=String(code);e.last_event_at=new Date(clock()).toISOString();
    if(latency)e.ewma_latency_ms=e.ewma_latency_ms?Math.round((EWMA_ALPHA*latency)+((1-EWMA_ALPHA)*e.ewma_latency_ms)):Math.round(latency);
    if(e.failures>=threshold)e.open_until=clock()+cooldown;
  }
  function snapshot(id){
    const e=entry(id),now=clock(),state=stateFor(e,now);
    return Object.freeze({
      circuit_state:state,
      health_score:scoreFor(e,now,slo),
      consecutive_failures:e.failures,
      ewma_latency_ms:e.ewma_latency_ms||null,
      open_until:state==='open'?new Date(e.open_until).toISOString():null,
      last_error:e.last_error,
      last_event_at:e.last_event_at,
    });
  }
  function canAttempt(id){return snapshot(id).circuit_state!=='open';}
  return Object.freeze({recordSuccess,recordFailure,snapshot,canAttempt});
}
