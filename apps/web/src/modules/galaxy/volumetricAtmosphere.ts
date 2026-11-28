import type { LightVector } from './stellarLighting';
export type AtmosphereSample = {radiance:number[];opacity:number;transmission:number[]};
/** Normalized, single-scattering model for fictional planets. No calibrated physical units. */
export function rayleighPhase(mu: number): number{return 3*(1+mu*mu)/(16*Math.PI)}
export function miePhase(mu: number): number{const g=.72;return (1-g*g)/(4*Math.PI*Math.pow(1+g*g-2*g*mu,1.5))}
export function integrateAtmosphere(x: number,y: number,light: LightVector,density: number,visibility: number): AtmosphereSample{
  const length=Math.hypot(light.x,light.y,light.z);
  if(![x,y,length,density,visibility].every(Number.isFinite)||length<1e-8||density<0||density>1||visibility<0||visibility>1)throw new RangeError("Invalid atmosphere inputs");
  const lx=light.x/length,ly=light.y/length,lz=light.z/length;
  const outer=1.12, b=x*x+y*y;
  const radiance=[0,0,0], transmission=[1,1,1];
  if(b>=outer*outer||density===0)return {radiance,opacity:0,transmission};
  const far=Math.sqrt(outer*outer-b), near=b<1?Math.sqrt(1-b):-far;
  const ds=(far-near)/8;
  const betaR=[.65,1.25,2.65],betaM=.32;
  const phaseR=rayleighPhase(lz),phaseM=miePhase(lz);
  for(let i=0;i<8;i++){
    const z=far-(i+.5)*ds;
    const h=Math.max(0,Math.hypot(x,y,z)-1);
    const rhoR=density*Math.exp(-h/.045),rhoM=density*Math.exp(-h/.018);
    const dot=x*lx+y*ly+z*lz,rr=b+z*z;
    const shadow=dot<0&&rr-dot*dot<1;
    let sunR=0,sunM=0;
    if(!shadow&&visibility>0){
      const span=-dot+Math.sqrt(Math.max(0,dot*dot+outer*outer-rr));
      const dt=span/4;
      for(let j=0;j<4;j++){
        const t=(j+.5)*dt;
        const sh=Math.max(0,Math.hypot(x+t*lx,y+t*ly,z+t*lz)-1);
        sunR+=density*Math.exp(-sh/.045)*dt;
        sunM+=density*Math.exp(-sh/.018)*dt;
      }
    }
    for(let c=0;c<3;c++){
      const ext=rhoR*betaR[c]+rhoM*betaM;
      const step=Math.exp(-ext*ds);
      if(!shadow&&visibility>0){
        const solar=Math.exp(-sunR*betaR[c]-sunM*betaM);
        const source=rhoR*betaR[c]*phaseR+rhoM*betaM*phaseM;
        radiance[c]+=transmission[c]*solar*source*ds*visibility*2.8;
      }
      transmission[c]*=step;
    }
  }
  return {radiance:radiance.map(v=>Math.min(1,Math.max(0,v))),opacity:1-transmission.reduce((a,v)=>a+v,0)/3,transmission};
}
