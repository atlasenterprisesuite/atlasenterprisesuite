import {describe,it,expect,vi} from 'vitest';
import {createSumeriaDocx,recognizeSumeriaImage} from '../../packages/core/src/sumeriaDocument';
describe('Sumeria DOCX and local OCR contracts',()=>{
 it('SUM-06 emits a ZIP-based DOCX container without modifying source',()=>{
  const paragraphs=['Original','<balance> & amount'];
  const bytes=createSumeriaDocx({title:'Working copy',paragraphs});
  expect([...bytes.slice(0,4)]).toEqual([80,75,3,4]);
  const text=new TextDecoder().decode(bytes);
  expect(text).toContain('word/document.xml');
  expect(text).toContain('&lt;balance&gt; &amp; amount');
  expect(paragraphs).toEqual(['Original','<balance> & amount']);
 });
 it('SUM-07 refuses oversized input',()=>expect(()=>createSumeriaDocx({title:'Test',paragraphs:['x'.repeat(100001)]})).toThrow('document_too_large'));
 it('SUM-08 OCR fails closed without provider',async()=>await expect(recognizeSumeriaImage({} as ImageBitmap)).rejects.toThrow('ocr_provider_unavailable'));
 it('SUM-09 OCR returns recognized lines when provider is explicitly injected',async()=>{
 const detect=vi.fn().mockResolvedValue([{rawValue:'First line'},{rawValue:'Second line'}]);
 expect(await recognizeSumeriaImage({} as ImageBitmap,{detect})).toBe('First line\nSecond line');
 expect(detect).toHaveBeenCalledTimes(1);
 });
});
