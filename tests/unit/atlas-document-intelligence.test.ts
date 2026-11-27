import { describe, expect, it } from 'vitest';
import { findDocumentMatches, canApplyDocumentDraft } from '../../apps/web/src/modules/creator/writing/documentIntelligence';

describe('Office Intelligence document context', () => {
  it('searches literal text including regular expression punctuation', () => {
    expect(findDocumentMatches('a.b aXb a.b', 'a.b')).toEqual([0, 8]);
    expect(findDocumentMatches('aaaa', 'aa')).toEqual([0, 2]);
  });
  it('handles case sensitivity and empty queries', () => {
    expect(findDocumentMatches('Atlas atlas', 'atlas')).toEqual([6]);
    expect(findDocumentMatches('text', '')).toEqual([]);
  });
  it('limits returned matches and keeps UTF-16 offsets', () => {
    expect(findDocumentMatches('a'.repeat(300), 'a')).toHaveLength(200);
    expect(findDocumentMatches('🌟Atlas', 'Atlas')).toEqual([2]);
  });
  it('requires a nonempty proposal and exact unchanged source', () => {
    expect(canApplyDocumentDraft('old', 'old', 'new')).toBe(true);
    expect(canApplyDocumentDraft('old', 'edited', 'new')).toBe(false);
    expect(canApplyDocumentDraft(null, 'old', 'new')).toBe(false);
    expect(canApplyDocumentDraft('old', 'old', '  ')).toBe(false);
    expect(canApplyDocumentDraft('', '', 'new')).toBe(true);
  });
});
