import { useMemo, useState } from 'react';
import { createEmptyMotionComposition } from '../../../../../../../packages/creator/motion/defaults';
import { validateMotionComposition } from '../../../../../../../packages/creator/motion/validator';
import type { MotionLayer } from '../../../../../../../packages/creator/motion/types';

export function MotionDesigner() {
  const [spec,setSpec]=useState(()=>createEmptyMotionComposition());
  const [selected,setSelected]=useState<string|null>(null);
  const [playhead,setPlayhead]=useState(0);
  const issues=useMemo(()=>validateMotionComposition(spec),[spec]);
  const selectedLayer=spec.layers.find(l=>l.id===selected) || null;
  function addLayer(kind: MotionLayer['kind']) { const id=crypto.randomUUID(); setSpec(s=>({...s,layers:[...s.layers,{id,name:kind==='text'?'Text':'Shape',kind,sceneId:null,parentLayerId:null,startSecond:0,endSecond:s.durationSeconds,visible:true,locked:false,transform:{positionX:0,positionY:0,scaleX:1,scaleY:1,opacity:1},tracks:[],effects:[],expression:null}]})); setSelected(id); }
  function updateLayer(patch: Partial<MotionLayer>) { if(!selectedLayer || selectedLayer.locked)return; setSpec(s=>({...s,layers:s.layers.map(l=>l.id===selectedLayer.id?{...l,...patch}:l)})); }
  function removeLayer(){ if(!selectedLayer || selectedLayer.locked)return; setSpec(s=>({...s,layers:s.layers.filter(l=>l.id!==selectedLayer.id)})); setSelected(null); }
  return <section className="motion-designer" aria-label="Motion Designer">
    <div className="motion-toolbar"><button type="button" onClick={()=>addLayer('text')}>Add text</button><button type="button" onClick={()=>addLayer('shape')}>Add shape</button><span>{issues.length ? `${issues.length} validation issue(s)` : 'Composition valid'}</span></div>
    <div className="motion-grid">
      <aside aria-label="Layers"><h3>Layers</h3>{spec.layers.map(layer=><button type="button" key={layer.id} aria-pressed={selected===layer.id} onClick={()=>setSelected(layer.id)}>{layer.visible?'◉':'○'} {layer.name}{layer.locked?' · Locked':''}</button>)}</aside>
      <main aria-label="Canvas"><h3>Canvas</h3><div className="motion-canvas" style={{aspectRatio:`${spec.width}/${spec.height}`,background:spec.background}}>{spec.layers.filter(l=>l.visible&&l.startSecond<=playhead&&l.endSecond>=playhead).map(l=><div key={l.id} data-layer={l.kind} style={{opacity:l.transform.opacity??1,transform:`translate(${l.transform.positionX??0}px,${l.transform.positionY??0}px) scale(${l.transform.scaleX??1},${l.transform.scaleY??1})`}}>{l.kind==='text'?l.name:'◆'}</div>)}</div></main>
      <aside aria-label="Properties"><h3>Properties</h3>{selectedLayer ? <><label>Name<input value={selectedLayer.name} disabled={selectedLayer.locked} onChange={e=>updateLayer({name:e.target.value})}/></label><label><input type="checkbox" checked={selectedLayer.visible} onChange={e=>updateLayer({visible:e.target.checked})}/> Visible</label><label><input type="checkbox" checked={selectedLayer.locked} onChange={e=>updateLayer({locked:e.target.checked})}/> Locked</label><button type="button" onClick={removeLayer} disabled={selectedLayer.locked}>Delete</button></>:<p>Select a layer.</p>}</aside>
    </div>
    <section aria-label="Timeline"><h3>Timeline</h3><input aria-label="Playhead" type="range" min={0} max={spec.durationSeconds} step={1/spec.fps} value={playhead} onChange={e=>setPlayhead(Number(e.target.value))}/><output>{playhead.toFixed(2)}s</output></section>
  </section>;
}
