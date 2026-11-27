import {useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {ATLAS_SESSION_EVENT,getAtlasAccessToken,getActiveAtlasOrganization} from '../lib/atlasSession';
import {listWorkflows} from './api';
import {summarizeAuraWork} from './auraScope';
export function AuraLiveDock(){
 const [authenticated,setAuthenticated]=useState(()=>Boolean(getAtlasAccessToken()));
 const [open,setOpen]=useState(false);
 const [data,setData]=useState<ReturnType<typeof summarizeAuraWork>|null>(null);
 const [status,setStatus]=useState('Not synchronized');
 const generation=useRef(0);
 useEffect(()=>{
  const reset=()=>{generation.current++;setAuthenticated(Boolean(getAtlasAccessToken()));setData(null);setStatus('Session changed — synchronize again');};
  window.addEventListener(ATLAS_SESSION_EVENT,reset);
  window.addEventListener('storage',reset);
  return ()=>{generation.current++;window.removeEventListener(ATLAS_SESSION_EVENT,reset);window.removeEventListener('storage',reset);};
 },[]);
 async function refresh(){
  const ticket=++generation.current;
  setData(null);setStatus('Synchronizing');
  try{
   const org=await getActiveAtlasOrganization();
   const rows=await listWorkflows();
   const current=await getActiveAtlasOrganization();
   if(ticket!==generation.current)return;
   if(!getAtlasAccessToken()||org.id!==current.id)throw new Error('scope_changed');
   setData(summarizeAuraWork(org.id,rows));setStatus('Workflow registry snapshot · '+new Date().toISOString());
  }catch{if(ticket===generation.current)setStatus('Evidence unavailable — access or scope not verified');}
 }
 if(!authenticated)return null;
 return <aside aria-label="AURA operations" style={{position:'sticky',bottom:0,zIndex:20,background:'#061426',color:'#fff',padding:'0.75rem',borderTop:'1px solid #d4af37',maxHeight:'45vh',overflow:'auto'}}>
 <button type="button" aria-expanded={open} aria-controls="aura-live-panel" onClick={()=>setOpen(v=>!v)}>AURA LIVE 777 · {open?'Close':'Open'}</button>
 {open&&<section id="aura-live-panel"><p role="status">{status}</p><button type="button" onClick={()=>void refresh()}>Synchronize workflows</button>
 {data&&<><p>Visible workflows: {data.total}</p><ul>{Object.entries(data.byStatus).map(([key,count])=><li key={key}>{key}: {count}</li>)}</ul></>}
 <nav aria-label="AURA work navigation"><Link to="/work">Work registry</Link>{' · '}<Link to="/work/runtimes">Runtimes</Link>{' · '}<Link to="/cloud/releases">Release Control</Link></nav>
 <p>Read-only snapshot. No execution or deployment triggered.</p></section>}
 </aside>;
}
