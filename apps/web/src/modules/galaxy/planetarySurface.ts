export type PlanetMaterial = 'star' | 'rock' | 'ocean' | 'desert' | 'gas' | 'ice' | 'volcanic';
const MATERIALS: Readonly<Record<string, PlanetMaterial>> = {"core":"star","finance":"rock","accounting":"ocean","crm":"desert","security":"gas","payroll":"ice","inventory":"volcanic"};
/** Fictional procedural materials for navigation, not observed astronomical maps. */
export function materialForNode(id: string): PlanetMaterial{return Object.prototype.hasOwnProperty.call(MATERIALS,id)?MATERIALS[id]:"rock"}
export function materialAt(kind: PlanetMaterial,x: number,y: number,z: number): number[]{
  if(![x,y,z].every(Number.isFinite)||Math.abs(x*x+y*y+z*z-1)>0.002)throw new RangeError("Expected unit sphere coordinates");
  const terrain=0.5+0.21*Math.sin(5*x+3*Math.sin(4*z))+0.14*Math.sin(9*y-4*z+2*Math.sin(7*x))+0.08*Math.sin(23*x+17*y-19*z)+0.035*Math.sin(61*x-43*y+37*z);
  const cloud=0.5+0.28*Math.sin(13*x+6*Math.sin(9*y)+4*z)+0.15*Math.sin(31*z-21*y+8*x);
  const grain=0.5+0.5*Math.sin(97*x+71*y-53*z);
  const band=0.5+0.5*Math.sin(33*y+2*Math.sin(8*x+5*z)+0.7*Math.sin(21*z));
  let color: number[];
  switch(kind){
    case "star":color=[255,108+112*terrain,18+88*terrain];break;
    case "ocean": {
      const land=terrain>0.54;
      const polar=Math.abs(y)>0.85+0.08*terrain;
      color=polar?[204,222,233]:land?[53+102*terrain,79+80*terrain,35+50*terrain]:[7+18*terrain,39+77*terrain,96+96*terrain];
      const opacity=Math.max(0,Math.min(0.85,(cloud-0.68)*4));
      color=color.map(c=>c*(1-opacity)+235*opacity);
      break;
    }
    case "desert":color=[125+115*terrain,63+99*terrain,27+74*terrain];break;
    case "gas":color=[116+112*band,87+97*band,69+85*band];break;
    case "ice":color=[95+114*terrain,144+90*terrain,180+67*terrain];break;
    case "volcanic":color=terrain>0.68?[245,62+90*grain,12]:[25+64*terrain,19+40*terrain,22+39*terrain];break;
    default:color=[63+131*terrain,57+117*terrain,51+101*terrain];
  }
  return color.map(c=>Math.round(Math.max(0,Math.min(255,c+(grain-0.5)*9))));
}
