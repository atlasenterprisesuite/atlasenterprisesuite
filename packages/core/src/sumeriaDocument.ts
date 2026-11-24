/** ATLAS Sumeria: local document export and optional browser OCR.
 * No source-file mutations, network requests, or server-side storage.
 * Plain-text DOCX output; not a layout-preserving PDF conversion.
 */
function xml(value: string): string {
  return value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}
function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i=0;i<8;i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function write16(a: number[], n: number) { a.push(n&255,(n>>>8)&255); }
function write32(a: number[], n: number) { write16(a,n); write16(a,n>>>16); }
function zipStored(entries: ReadonlyArray<readonly [string,string]>): Uint8Array {
  const enc=new TextEncoder(), parts:number[]=[], directory:number[]=[];
  for (const [name,text] of entries) {
    const nameBytes=enc.encode(name), data=enc.encode(text), offset=parts.length, crc=crc32(data);
    write32(parts,0x04034b50);write16(parts,20);write16(parts,0);write16(parts,0);
    write16(parts,0);write16(parts,0);write32(parts,crc);write32(parts,data.length);write32(parts,data.length);
    write16(parts,nameBytes.length);write16(parts,0);parts.push(...nameBytes,...data);
    write32(directory,0x02014b50);write16(directory,20);write16(directory,20);write16(directory,0);
    write16(directory,0);write16(directory,0);write16(directory,0);write32(directory,crc);
    write32(directory,data.length);write32(directory,data.length);write16(directory,nameBytes.length);
    write16(directory,0);write16(directory,0);write16(directory,0);write16(directory,0);
    write32(directory,0);write32(directory,offset);directory.push(...nameBytes);
  }
  const cdOffset=parts.length;parts.push(...directory);
  write32(parts,0x06054b50);write16(parts,0);write16(parts,0);
  write16(parts,entries.length);write16(parts,entries.length);write32(parts,directory.length);
  write32(parts,cdOffset);write16(parts,0);
  return new Uint8Array(parts);
}
export function createSumeriaDocx(input: { title:string; paragraphs:readonly string[] }): Uint8Array {
  if (input.paragraphs.length>10000 || input.paragraphs.some(p=>p.length>100000)) throw new Error('document_too_large');
  const title=xml(input.title.slice(0,200));
  const paragraphs=input.paragraphs.map(p=>'<w:p><w:r><w:t xml:space="preserve">'+xml(p)+'</w:t></w:r></w:p>').join('');
  const document='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+paragraphs+'<w:sectPr/></w:body></w:document>';
  return zipStored([
    ['[Content_Types].xml','<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'],
    ['_rels/.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'],
    ['word/document.xml',document],
    ['docProps/core.xml','<?xml version="1.0" encoding="UTF-8"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>'+title+'</dc:title><dc:description>ATLAS Sumeria working copy - not an official issuer document</dc:description></cp:coreProperties>']
  ]);
}
export async function recognizeSumeriaImage(source: ImageBitmap, detector?: { detect(image:ImageBitmap):Promise<ReadonlyArray<{rawValue?:string}>> }):Promise<string> {
  if (!detector) throw new Error('ocr_provider_unavailable');
  const blocks=await detector.detect(source);
  if (!Array.isArray(blocks)) throw new Error('ocr_invalid_response');
  return blocks.map(block=>String(block.rawValue??'').trim()).filter(Boolean).join('\n');
}
