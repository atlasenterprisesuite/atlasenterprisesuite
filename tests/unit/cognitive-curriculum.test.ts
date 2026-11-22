import { describe, expect, it } from 'vitest';
import { curriculum, lessonForWeek, recordPractice } from '../../packages/learning/cognitive-curriculum';
describe('extracurricular curriculum',()=>{
  it('covers six disciplines across three introductory stages and twelve weeks',()=>{
    expect(curriculum).toHaveLength(12);
    expect(new Set(curriculum.flatMap(x=>x.exercises))).toEqual(new Set([0,1,2,3,4,5]));
    expect(new Set(curriculum.map(x=>x.stage)).size).toBe(3);
    expect(lessonForWeek(0)).toBeUndefined();
    expect(lessonForWeek(13)).toBeUndefined();
  });
  it('only logs a voluntary eligible exercise once per session',()=>{
    expect(recordPractice([],0,false)).toEqual([]);
    expect(recordPractice([],6,true)).toEqual([]);
    expect(recordPractice([0],0,true)).toEqual([0]);
    expect(recordPractice([0],1,true)).toEqual([0,1]);
  });
});
