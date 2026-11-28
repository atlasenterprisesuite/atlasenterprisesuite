import type { OrbitalPoint } from './orbitalRuntime';
export type LightVector = {x:number;y:number;z:number};
/** Camera-space lighting, matching orbital projection pitch. */
export function cameraLight(target: OrbitalPoint,star: OrbitalPoint,yaw: number): LightVector{
 const dx=star.x-target.x,dy=star.y-target.y,dz=star.z-target.z;
 const length=Math.hypot(dx,dy,dz);
 if(!Number.isFinite(yaw)||!Number.isFinite(length)||length<=0)throw new RangeError("Invalid light direction");
 const x=(dx*Math.cos(yaw)-dz*Math.sin(yaw))/length;
 const z=(dx*Math.sin(yaw)+dz*Math.cos(yaw))/length;
 return {x,y:dy/length*Math.cos(0.29)-z*Math.sin(0.29),z:z*Math.cos(0.29)+dy/length*Math.sin(0.29)};
}
/** Approximate center-based finite-source eclipse, not an exact radiative transfer solver. */
export function directVisibility(target: OrbitalPoint,star: OrbitalPoint,blockers: readonly OrbitalPoint[]): number{
 const dx=star.x-target.x,dy=star.y-target.y,dz=star.z-target.z,d=Math.hypot(dx,dy,dz);
 if(!Number.isFinite(d)||d<=0||!Number.isFinite(star.radius)||star.radius<=0)throw new RangeError("Invalid star geometry");
 let visible=1;
 for(const body of blockers){
   const x=body.x-target.x,y=body.y-target.y,z=body.z-target.z;
   if(![x,y,z,body.radius].every(Number.isFinite)||body.radius<0)throw new RangeError("Invalid blocker");
   const t=(x*dx+y*dy+z*dz)/d;
   if(t<=0||t>=d||body.radius===0)continue;
   const offset=Math.sqrt(Math.max(0,x*x+y*y+z*z-t*t));
   const beam=star.radius*t/d;
   const inner=Math.abs(body.radius-beam),outer=body.radius+beam;
   const peak=Math.min(1,(body.radius/beam)**2);
   const coverage=offset<=inner?peak:offset>=outer?0:peak*(outer-offset)/(outer-inner);
   visible=Math.min(visible,1-coverage);
 }
 return visible;
}
/** Bounded Lambert shading with a small ambient floor. */
export function shadeSurface(base: readonly number[],normal: LightVector,light: LightVector,visibility: number,emissive: boolean): number[]{
 if(base.length!==3||!base.every(c=>Number.isFinite(c)&&c>=0&&c<=255)||![normal.x,normal.y,normal.z,light.x,light.y,light.z,visibility].every(Number.isFinite)||visibility<0||visibility>1)throw new RangeError("Invalid shading input");
 const lambert=Math.max(0,Math.min(1,normal.x*light.x+normal.y*light.y+normal.z*light.z));
 const intensity=emissive?1.25:0.045+0.955*lambert*visibility;
 return base.map(c=>Math.round(Math.min(255,c*intensity)));
}
/** Artistic single-scattering limb approximation, not volumetric integration. */
export function atmosphericGlow(viewCos: number,sunCos: number,visibility: number): number{
 if(![viewCos,sunCos,visibility].every(Number.isFinite)||viewCos<0||viewCos>1||sunCos< -1||sunCos>1||visibility<0||visibility>1)throw new RangeError("Invalid scattering input");
 return Math.pow(1-viewCos,2.4)*Math.sqrt(Math.max(0,sunCos))*visibility;
}
