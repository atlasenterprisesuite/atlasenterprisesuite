import { describe, expect, it } from 'vitest';
import { EMERALD_SCENE, advanceCamera, projectPoint, validateScene } from './emeraldScene';
describe('Emerald Grove 3D demo scene negative TDD', () => {
 it('marks every scene object simulated and blocks false verified claims',()=>{
  expect(()=>validateScene(EMERALD_SCENE)).not.toThrow();
  expect(()=>validateScene([{...EMERALD_SCENE[0],status:'verified'}])).toThrow();
 });
 it('rejects out-of-bounds floors and non-finite camera inputs',()=>{
  expect(()=>advanceCamera({x:0,y:2,z:0,yaw:0,pitch:0},{forward:0,strafe:0,turn:0,tilt:0,floor:4})).toThrow();
  expect(()=>advanceCamera({x:NaN,y:2,z:0,yaw:0,pitch:0},{forward:1,strafe:0,turn:0,tilt:0})).toThrow();
 });
 it('projects a point in front but clips behind camera',()=>{
  const camera={x:0,y:2,z:0,yaw:0,pitch:0};
  expect(projectPoint({x:0,y:2,z:10},camera,800,600)).not.toBeNull();
  expect(projectPoint({x:0,y:2,z:-10},camera,800,600)).toBeNull();
 });
 it('moves in first person with bounded pitch',()=>{
  const next=advanceCamera({x:0,y:2,z:0,yaw:0,pitch:0},{forward:2,strafe:0,turn:0,tilt:5});
  expect(next.z).toBeGreaterThan(0);
  expect(next.pitch).toBeLessThanOrEqual(1.2);
 });
});