export type Vec3={x:number;y:number;z:number};
export type Camera=Vec3&{yaw:number;pitch:number};
export type SceneObject={id:string;label:string;center:Vec3;size:Vec3;status:'simulated';kind:'building'|'amenity'|'interior';floors:number};
export const EMERALD_SCENE:SceneObject[]=[
 {id:'building-a',label:'Edificio A (demostración)',center:{x:-16,y:5,z:28},size:{x:15,y:10,z:13},status:'simulated',kind:'building',floors:3},
 {id:'building-b',label:'Edificio B (demostración)',center:{x:18,y:5,z:34},size:{x:15,y:10,z:13},status:'simulated',kind:'building',floors:3},
 {id:'clubhouse',label:'Casa club (demostración)',center:{x:0,y:3,z:52},size:{x:16,y:6,z:12},status:'simulated',kind:'amenity',floors:1},
 {id:'pool',label:'Piscina (demostración)',center:{x:0,y:0.15,z:34},size:{x:13,y:0.3,z:9},status:'simulated',kind:'amenity',floors:1},
 {id:'unit',label:'Apartamento muestra (interior simulado)',center:{x:0,y:2,z:15},size:{x:10,y:4,z:9},status:'simulated',kind:'interior',floors:1}
];
export function validateScene(scene:readonly SceneObject[]):void{
 const ids=new Set<string>();
 for(const item of scene){
  if(!item.id||ids.has(item.id)||item.status!=='simulated'||!Number.isSafeInteger(item.floors)||item.floors<1||item.floors>3||![...Object.values(item.center),...Object.values(item.size)].every(Number.isFinite)||Object.values(item.size).some(v=>v<=0))throw Error('INVALID_SCENE_PROVENANCE_OR_GEOMETRY');
  ids.add(item.id);
 }
}
export type CameraMove={forward:number;strafe:number;turn:number;tilt:number;floor?:number};
export function advanceCamera(camera:Camera,move:CameraMove):Camera{
 if(![...Object.values(camera),move.forward,move.strafe,move.turn,move.tilt].every(Number.isFinite))throw Error('INVALID_CAMERA');
 if(move.floor!==undefined&&(!Number.isSafeInteger(move.floor)||move.floor<1||move.floor>3))throw Error('INVALID_FLOOR');
 const yaw=camera.yaw+move.turn;
 const x=Math.max(-100,Math.min(100,camera.x+Math.sin(yaw)*move.forward+Math.cos(yaw)*move.strafe));
 const z=Math.max(-100,Math.min(100,camera.z+Math.cos(yaw)*move.forward-Math.sin(yaw)*move.strafe));
 return {x,y:move.floor===undefined?camera.y:(move.floor-1)*3.2+1.7,z,yaw,pitch:Math.max(-1.2,Math.min(1.2,camera.pitch+move.tilt))};
}
export function projectPoint(point:Vec3,camera:Camera,width:number,height:number):{x:number;y:number;depth:number}|null{
 if(![...Object.values(point),...Object.values(camera),width,height].every(Number.isFinite)||width<=0||height<=0)throw Error('INVALID_PROJECTION');
 const dx=point.x-camera.x,dy=point.y-camera.y,dz=point.z-camera.z;
 const side=Math.cos(camera.yaw)*dx-Math.sin(camera.yaw)*dz;
 const forward=Math.sin(camera.yaw)*dx+Math.cos(camera.yaw)*dz;
 const up=Math.cos(camera.pitch)*dy-Math.sin(camera.pitch)*forward;
 const depth=Math.sin(camera.pitch)*dy+Math.cos(camera.pitch)*forward;
 if(depth<=0.15)return null;
 const focal=Math.min(width,height)*0.9;
 return {x:width/2+focal*side/depth,y:height/2-focal*up/depth,depth};
}
export function cuboidVertices(item:SceneObject):Vec3[]{
 const {x,y,z}=item.center,{x:sx,y:sy,z:sz}=item.size;
 return [-1,1].flatMap(a=>[-1,1].flatMap(b=>[-1,1].map(c=>({x:x+a*sx/2,y:y+b*sy/2,z:z+c*sz/2}))));
}
