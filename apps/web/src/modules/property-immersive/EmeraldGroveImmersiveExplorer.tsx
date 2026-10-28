import { useEffect, useRef, useState } from 'react';
import { advanceCamera, cuboidVertices, EMERALD_SCENE, projectPoint, type Camera, type SceneObject } from './emeraldScene';
import { EMERALD_GROVE_DEMO } from './propertyEvidence';

const EDGES:[number,number][]=[[0,1],[0,2],[0,4],[1,3],[1,5],[2,3],[2,6],[3,7],[4,5],[4,6],[5,7],[6,7]];
function drawScene(canvas:HTMLCanvasElement,camera:Camera,interior:boolean){
 const ctx=canvas.getContext('2d');if(!ctx)return;
 const width=canvas.width,height=canvas.height;
 ctx.fillStyle='#cde8fa';ctx.fillRect(0,0,width,height);
 ctx.fillStyle='#9bc69a';ctx.fillRect(0,height/2,width,height/2);
 const objects=EMERALD_SCENE.filter(o=>interior?o.kind==='interior':o.kind!=='interior');
 for(const item of [...objects].sort((a,b)=>(b.center.z-camera.z)-(a.center.z-camera.z))){
  const projected=cuboidVertices(item).map(point=>projectPoint(point,camera,width,height));
  ctx.strokeStyle=item.kind==='building'?'#345c7a':item.id==='pool'?'#007db8':'#31724d';
  ctx.lineWidth=2.5;
  for(const [a,b] of EDGES){const p=projected[a],q=projected[b];if(!p||!q)continue;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke();}
  const top=projectPoint({x:item.center.x,y:item.center.y+item.size.y/2+2,z:item.center.z},camera,width,height);
  if(top){ctx.fillStyle='#102a43';ctx.font='14px sans-serif';ctx.fillText(item.label,top.x-65,top.y);}
 }
 ctx.fillStyle='#15314b';ctx.font='14px sans-serif';ctx.fillText('SIMULACIÓN 3D — NO ES LEVANTAMIENTO REAL',14,26);
 ctx.beginPath();ctx.moveTo(width/2-9,height/2);ctx.lineTo(width/2+9,height/2);ctx.moveTo(width/2,height/2-9);ctx.lineTo(width/2,height/2+9);ctx.strokeStyle='#172d40';ctx.stroke();
}
export function EmeraldGroveImmersiveExplorer(){
 const canvas=useRef<HTMLCanvasElement|null>(null);
 const [camera,setCamera]=useState<Camera>({x:0,y:8,z:-18,yaw:0,pitch:-0.13});
 const [floor,setFloor]=useState(1);
 const [interior,setInterior]=useState(false);
 useEffect(()=>{if(canvas.current)drawScene(canvas.current,camera,interior);},[camera,interior]);
 function move(forward=0,strafe=0,turn=0,tilt=0){setCamera(current=>advanceCamera(current,{forward,strafe,turn,tilt}));}
 function changeFloor(value:number){setFloor(value);setCamera(current=>advanceCamera(current,{forward:0,strafe:0,turn:0,tilt:0,floor:value}));}
 return <section aria-label="Emerald Grove simulated 3D walkthrough">
  <h2>Emerald Grove — recorrido virtual 3D</h2>
  <p>{EMERALD_GROVE_DEMO.locationLabel}. Escena ilustrativa: posiciones, edificios, amenidades e interiores no verificados.</p>
  <canvas ref={canvas} width={960} height={540} role="img" aria-label="Vista 3D simulada con edificios, piscina y casa club; utiliza los controles de navegación para cambiar de perspectiva" style={{width:'100%',maxWidth:960,height:'auto',background:'#cde8fa'}}/>
  <div role="group" aria-label="Controles de navegación en primera persona">
   <button type="button" onClick={()=>move(3)}>Avanzar</button>
   <button type="button" onClick={()=>move(-3)}>Retroceder</button>
   <button type="button" onClick={()=>move(0,-3)}>Izquierda</button>
   <button type="button" onClick={()=>move(0,3)}>Derecha</button>
   <button type="button" onClick={()=>move(0,0,-0.2)}>Girar izquierda</button>
   <button type="button" onClick={()=>move(0,0,0.2)}>Girar derecha</button>
   <button type="button" onClick={()=>move(0,0,0,0.12)}>Mirar arriba</button>
   <button type="button" onClick={()=>move(0,0,0,-0.12)}>Mirar abajo</button>
  </div>
  <label htmlFor="emerald-floor">Piso de demostración</label>
  <select id="emerald-floor" value={floor} onChange={event=>changeFloor(Number(event.target.value))}>
   <option value={1}>Piso 1</option><option value={2}>Piso 2</option><option value={3}>Piso 3</option>
  </select>
  <button type="button" onClick={()=>{setInterior(!interior);setCamera({x:0,y:2,z:0,yaw:0,pitch:0});}}>Cambiar a {interior?'exterior':'interior'} simulado</button>
  <p aria-live="polite">Vista: {interior?'apartamento ilustrativo':'exteriores ilustrativos'}. Piso {floor}. Cámara X {camera.x.toFixed(1)}, Z {camera.z.toFixed(1)}.</p>
 </section>;
}
