/**
 * ATLAS Spatial panorama evidence gate.
 * This module does not establish indoor positioning or grant navigation rights.
 * A panorama may be viewed only when its source is authorized.
 * Physical navigation additionally requires independently verified links.
 */
export type PanoramaScene = {
  id: string;
  organizationId: string;
  buildingId: string;
  levelId: string;
  imageUri: string;
  imageSha256: string;
  rightsEvidenceRef: string;
  verification: 'unverified' | 'verified' | 'simulation';
};

export type PanoramaConnection = {
  fromSceneId: string;
  toSceneId: string;
  organizationId: string;
  buildingId: string;
  evidenceRef: string;
  verification: 'unverified' | 'verified' | 'simulation';
  accessible: boolean;
};

const SHA256 = /^[a-f0-9]{64}$/i;

export function canDisplayPanorama(scene: PanoramaScene, activeOrgId: string): boolean {
  if (!activeOrgId || scene.organizationId !== activeOrgId) return false;
  if (!scene.id || !scene.buildingId || !scene.levelId) return false;
  if (scene.verification !== 'verified' || !scene.rightsEvidenceRef.trim()) return false;
  if (!SHA256.test(scene.imageSha256)) return false;
  try {
    const url = new URL(scene.imageUri);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

/** Fail closed: a visually adjacent scene is not proof of a physical passage. */
export function canNavigatePanorama(
  from: PanoramaScene,
  to: PanoramaScene,
  connection: PanoramaConnection,
  activeOrgId: string,
  accessibleOnly = false
): boolean {
  return canDisplayPanorama(from, activeOrgId)
    && canDisplayPanorama(to, activeOrgId)
    && from.buildingId === to.buildingId
    && connection.organizationId === activeOrgId
    && connection.buildingId === from.buildingId
    && connection.fromSceneId === from.id
    && connection.toSceneId === to.id
    && connection.verification === 'verified'
    && Boolean(connection.evidenceRef.trim())
    && (!accessibleOnly || connection.accessible);
}
