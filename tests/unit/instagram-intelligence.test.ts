import { describe, expect, it } from 'vitest';
import { canDocumentInstagramResearch, ingestInstagramLinks, normalizeInstagramHandle, normalizeInstagramMediaUrl, parseInstagramFollowingExport } from '../../packages/creator/instagram_intelligence';

describe('ATLAS Reel Intelligence 777 intake', () => {
  it('accepts a Meta following JSON and removes duplicate usernames', () => {
    const records=parseInstagramFollowingExport({relationships_following:[{title:'MindsetVibrations'},{title:'mindsetvibrations'},{string_list_data:[{value:'another_user'}]}]});
    expect(records.map(a=>a.handle)).toEqual(['another_user','mindsetvibrations']);
    expect(()=>parseInstagramFollowingExport({messages:[{title:'private'}]})).toThrow('following_list_missing');
  });
  it('accepts only secure Instagram media URLs and handles', () => {
    expect(normalizeInstagramHandle('@Creator.Name')).toBe('creator.name');
    expect(normalizeInstagramHandle('https://evil.example/username')).toBeNull();
    expect(normalizeInstagramMediaUrl('https://www.instagram.com/reel/ABCDef012/?utm=1')?.url).toBe('https://www.instagram.com/reel/ABCDef012/');
    expect(normalizeInstagramMediaUrl('http://www.instagram.com/reel/ABCDef012/')).toBeNull();
    expect(normalizeInstagramMediaUrl('https://evilinstagram.com/reel/ABCDef012/')).toBeNull();
  });
  it('deduplicates new inputs while preserving previously collected evidence', () => {
    const first=ingestInstagramLinks([],'@creator https://www.instagram.com/reel/ABCDef012/');
    expect(first.added).toBe(1);
    const documented={...first.items[0],status:'documented' as const,observation:'Transcript supplied',conclusion:'Unproven',sources:['https://example.org']};
    const second=ingestInstagramLinks([documented],'https://www.instagram.com/reel/ABCDef012/?igsh=x\nnot a link');
    expect(second.duplicates).toBe(1);
    expect(second.invalid).toHaveLength(1);
    expect(second.items[0].status).toBe('documented');
    expect(second.items[0].observation).toBe('Transcript supplied');
  });
  it('fails closed when evidence, conclusion, or source are missing',()=>{
    const media=ingestInstagramLinks([],'https://www.instagram.com/p/abcde123/').items[0];
    expect(canDocumentInstagramResearch(media)).toBe(false);
    expect(canDocumentInstagramResearch({...media,observation:'Observed',conclusion:'Not proven',sources:['http://example.org']})).toBe(false);
    expect(canDocumentInstagramResearch({...media,observation:'Observed',conclusion:'Not proven',sources:['https://example.org']})).toBe(true);
  });
});
