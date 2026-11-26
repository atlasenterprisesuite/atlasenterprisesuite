/** ATLAS Spatial Forge: original, pure procedural 3D preview. Not neural reconstruction.
 * No network, storage, payments, or authorization side effects.
 * The caller MUST derive authority from the existing authenticated ATLAS server/RBAC boundary. */
export const MAX_SPATIAL_IMAGES = 5;
export const MAX_SPATIAL_IMAGE_BYTES = 25 * 1024 * 1024;
export type SpatialFile = { name: string; type: string; size: number };
export type SpatialRequest = {
  source: { kind: 'text'; prompt: string } |
          { kind: 'images'; images: SpatialFile[]; prompt?: string } |
          { kind: 'model'; model: SpatialFile };
  format: 'obj' | 'glb' | 'fbx' | 'stl' | 'usdz';
  material: 'none' | 'pbr' | 'shaded';
  quality: 'preview' | 'standard' | 'high';
};
export type SpatialAuthority = {
  tenantId: string; orgId: string; actorId: string;
  hasGeneratePermission: boolean;
  nativePreviewVerified: boolean;
};
export type SpatialDenial = 'invalid_tenant_scope' | 'permission_denied' |
  'invalid_options' | 'invalid_prompt' | 'invalid_images' | 'invalid_model' |
  'neural_engine_unavailable' | 'native_engine_unverified' | 'unsupported_native_preview';
export type SpatialAdmission =
  { allowed: true; execution: 'atlas-procedural-preview'; billable: false } |
  { allowed: false; reason: SpatialDenial };
export type SpatialPrimitive = 'cube' | 'pyramid' | 'cylinder' | 'sphere';

export function parseSpatialPrimitive(value: string): SpatialPrimitive | null {
  switch (value.trim().toLowerCase().normalize('NFC')) {
    case 'cubo': case 'cube': return 'cube';
    case 'pyramid': case 'pirámide': case 'piramide': return 'pyramid';
    case 'cylinder': case 'cilindro': return 'cylinder';
    case 'sphere': case 'esfera': return 'sphere';
    default: return null;
  }
}
function validPrompt(prompt: unknown, required: boolean): boolean {
  return prompt === undefined ? !required :
    typeof prompt === 'string' && prompt.length <= 1024 && (!required || !!prompt.trim());
}
function validImage(file: SpatialFile): boolean {
  return Boolean(file?.name?.trim()) && ['image/png','image/jpeg','image/webp'].includes(file.type) &&
    Number.isSafeInteger(file.size) && file.size > 0 && file.size <= MAX_SPATIAL_IMAGE_BYTES;
}
function validModel(file: SpatialFile): boolean {
  return Boolean(file?.name?.trim()) && Number.isSafeInteger(file.size) && file.size > 0 &&
    file.size <= MAX_SPATIAL_IMAGE_BYTES * 4 && /\.(obj|glb|fbx|stl|usdz)$/i.test(file.name);
}
/** Validates capabilities, but does NOT grant server access on its own. */
export function admitSpatialRequest(request: SpatialRequest, authority: SpatialAuthority): SpatialAdmission {
  if (![authority.tenantId, authority.orgId, authority.actorId].every(x => typeof x === 'string' && !!x.trim()))
    return { allowed: false, reason: 'invalid_tenant_scope' };
  if (!authority.hasGeneratePermission) return { allowed: false, reason: 'permission_denied' };
  if (!request || !['obj','glb','fbx','stl','usdz'].includes(request.format) ||
      !['none','pbr','shaded'].includes(request.material) ||
      !['preview','standard','high'].includes(request.quality) || !request.source)
    return { allowed: false, reason: 'invalid_options' };
  if (request.source.kind === 'images') {
    const { images, prompt } = request.source;
    if (!Array.isArray(images) || images.length === 0 || images.length > MAX_SPATIAL_IMAGES ||
        !images.every(validImage) || !validPrompt(prompt, false))
      return { allowed: false, reason: 'invalid_images' };
    return { allowed: false, reason: 'neural_engine_unavailable' };
  }
  if (request.source.kind === 'model')
    return { allowed: false, reason: validModel(request.source.model) ? 'neural_engine_unavailable' : 'invalid_model' };
  if (request.source.kind !== 'text') return { allowed: false, reason: 'invalid_options' };
  if (!validPrompt(request.source.prompt, true)) return { allowed: false, reason: 'invalid_prompt' };
  if (!authority.nativePreviewVerified) return { allowed: false, reason: 'native_engine_unverified' };
  if (request.format !== 'obj' || request.material !== 'none' || request.quality !== 'preview' ||
      parseSpatialPrimitive(request.source.prompt) === null)
    return { allowed: false, reason: 'unsupported_native_preview' };
  return { allowed: true, execution: 'atlas-procedural-preview', billable: false };
}

type Vertex = [number, number, number];
type Face = [number, number, number];
type Mesh = { vertices: Vertex[]; faces: Face[] };
function meshForPrimitive(primitive: SpatialPrimitive): Mesh {
  if (primitive === 'cube') return {
    vertices: [[-.5,-.5,-.5],[.5,-.5,-.5],[.5,.5,-.5],[-.5,.5,-.5],[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]],
    faces: [[1,3,2],[1,4,3],[5,6,7],[5,7,8],[1,2,6],[1,6,5],[4,8,7],[4,7,3],[1,5,8],[1,8,4],[2,3,7],[2,7,6]]
  };
  if (primitive === 'pyramid') return {
    vertices: [[-.5,0,-.5],[.5,0,-.5],[.5,0,.5],[-.5,0,.5],[0,.85,0]],
    faces: [[1,3,2],[1,4,3],[1,2,5],[2,3,5],[3,4,5],[4,1,5]]
  };
  const lonCount = 16;
  const vertices: Vertex[] = [];
  const faces: Face[] = [];
  if (primitive === 'cylinder') {
    vertices.push([0,-.5,0], [0,.5,0]);
    for (let lon = 0; lon < lonCount; lon++) {
      const a = lon * 2 * Math.PI / lonCount;
      vertices.push([.5*Math.cos(a),-.5,.5*Math.sin(a)], [.5*Math.cos(a),.5,.5*Math.sin(a)]);
    }
    for (let i = 0; i < lonCount; i++) {
      const b=3+i*2, t=b+1, nb=3+((i+1)%lonCount)*2, nt=nb+1;
      faces.push([1,nb,b],[2,t,nt],[b,nb,nt],[b,nt,t]);
    }
    return { vertices, faces };
  }
  const latCount = 8;
  vertices.push([0,.5,0]);
  for (let lat = 1; lat < latCount; lat++) for (let lon = 0; lon < lonCount; lon++) {
    const theta = Math.PI * lat / latCount;
    const phi = 2 * Math.PI * lon / lonCount;
    vertices.push([.5*Math.sin(theta)*Math.cos(phi),.5*Math.cos(theta),.5*Math.sin(theta)*Math.sin(phi)]);
  }
  const south = vertices.push([0,-.5,0]);
  for (let lon = 0; lon < lonCount; lon++) {
    const next = (lon+1)%lonCount;
    faces.push([1,2+lon,2+next]);
    for (let lat = 0; lat < latCount-2; lat++) {
      const a = 2 + lat*lonCount+lon, b = 2 + lat*lonCount+next;
      faces.push([a,a+lonCount,b],[b,a+lonCount,b+lonCount]);
    }
    faces.push([2+(latCount-2)*lonCount+lon,south,2+(latCount-2)*lonCount+next]);
  }
  return { vertices, faces };
}
export type SpatialPreview = {
  fileName: string;
  mimeType: 'model/obj';
  provenance: 'atlas-procedural-preview';
  primitive: SpatialPrimitive;
  vertexCount: number;
  triangleCount: number;
  content: string;
};
/** Returns a real deterministic OBJ mesh, not an AI-generated asset. */
export function generateSpatialObjPreview(request: SpatialRequest, authority: SpatialAuthority): SpatialPreview {
  const decision = admitSpatialRequest(request, authority);
  if (decision.allowed === false) throw new Error(decision.reason);
  if (request.source.kind !== 'text') throw new Error('unsupported_native_preview');
  const primitive = parseSpatialPrimitive(request.source.prompt);
  if (!primitive) throw new Error('unsupported_native_preview');
  const mesh = meshForPrimitive(primitive);
  // Reverse the lathe/pyramid winding to keep OBJ face normals outward.
  const outwardFaces: Face[] = primitive === 'cube' ? mesh.faces : mesh.faces.map(([a,b,c]) => [a,c,b]);
  return {
    fileName: 'atlas_' + primitive + '.obj', mimeType: 'model/obj',
    provenance: 'atlas-procedural-preview', primitive,
    vertexCount: mesh.vertices.length, triangleCount: outwardFaces.length,
    content: [
      '# ATLAS Spatial Forge: procedural preview, not AI-generated',
      'o atlas_' + primitive,
      ...mesh.vertices.map(v => 'v ' + v.map(n => Number(n.toFixed(6))).join(' ')),
      ...outwardFaces.map(f => 'f ' + f.join(' '))
    ].join('\n') + '\n'
  };
}
