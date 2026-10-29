import { describe, expect, it } from 'vitest';
import { canCloneDubbingVoice, exportDubbingSrt, validateDubbingProject, type DubbingProject } from './dubbing-project';
const sample: DubbingProject={id:'p1',title:'Demo',sourceLanguage:'es',targetLanguage:'en',consentVerified:false,segments:[{id:'s1',startMs:1000,endMs:2500,speakerId:'a',sourceText:'Hola',translatedText:'Hello'}]};
describe('ATLAS Dubbing Studio',()=>{
 it('exports timed subtitles',()=>{expect(exportDubbingSrt(sample)).toContain('00:00:01,000 --> 00:00:02,500');expect(exportDubbingSrt(sample)).toContain('Hello')});
 it('rejects malformed timing',()=>{expect(validateDubbingProject({...sample,segments:[{...sample.segments[0],endMs:0}]})).toContain('invalid_timing')});
 it('blocks cloning without verified consent',()=>{expect(canCloneDubbingVoice(sample)).toBe(false)});
});
