import { describe, expect, it } from 'vitest';
import { sumeriaPreflight, SUMERIA_MAX_FILE_BYTES } from '../../packages/core/src/sumeriaPreflight';

const pdf = () => ({ filename: 'source.pdf', mimeType: 'application/pdf', size: 1024, signature: [37,80,68,70,45] });
const docx = () => ({ filename: 'source.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 1024, signature: [80,75,3,4] });

describe('ATLAS Sumeria fail-closed intake preflight', () => {
  it('SUM-01 accepts a signature-matching PDF for later parsing only', () => {
    expect(sumeriaPreflight(pdf())).toEqual({ ok:true, format:'pdf', originalImmutable:true });
  });
  it('SUM-02 accepts a signature-matching DOCX for later parsing only', () => {
    expect(sumeriaPreflight(docx())).toEqual({ ok:true, format:'docx', originalImmutable:true });
  });
  it('SUM-03 rejects invalid or corrupted headers', () => {
    expect(sumeriaPreflight({...pdf(),signature:[0,0,0,0,0]})).toEqual({ok:false,error:'signature_mismatch'});
    expect(sumeriaPreflight({...docx(),signature:[0]})).toEqual({ok:false,error:'signature_mismatch'});
  });
  it('SUM-04 refuses type spoofing, unsupported files, traversal and invalid sizes', () => {
    expect(sumeriaPreflight({...pdf(),mimeType:'text/plain'})).toEqual({ok:false,error:'unsupported_format'});
    expect(sumeriaPreflight({...pdf(),filename:'../source.pdf'})).toEqual({ok:false,error:'invalid_filename'});
    expect(sumeriaPreflight({...pdf(),size:SUMERIA_MAX_FILE_BYTES+1})).toEqual({ok:false,error:'invalid_size'});
    expect(sumeriaPreflight({...pdf(),size:NaN})).toEqual({ok:false,error:'invalid_size'});
    expect(sumeriaPreflight({...pdf(),filename:'source.pdf.exe'})).toEqual({ok:false,error:'unsupported_format'});
  });
  it('SUM-05 contracts never supply a mutable original handle', () => {
    const result=sumeriaPreflight(pdf());
    expect(result.ok && result.originalImmutable).toBe(true);
    expect(result).not.toHaveProperty('sourceBuffer');
    expect(result).not.toHaveProperty('overwrite');
  });
});
