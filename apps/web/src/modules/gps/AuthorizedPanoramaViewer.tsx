import { Panorama360Viewer } from './Panorama360Viewer';
import { canDisplayPanorama, type PanoramaScene } from './panoramaEvidence';

/**
 * Fail-closed presentation boundary. This checks metadata only; a trusted server
 * must independently validate rights, image integrity, membership and evidence.
 */
export function AuthorizedPanoramaViewer({
  scene, activeOrganizationId
}: {
  scene: PanoramaScene | null;
  activeOrganizationId: string | null;
}) {
  if (!scene || !activeOrganizationId || !canDisplayPanorama(scene, activeOrganizationId)) {
    return <section role="status" aria-label="Panorama unavailable">
      <p>Panorama unavailable: authorization or verification pending.</p>
    </section>;
  }

  return <Panorama360Viewer imageUrl={scene.imageUri}
    alt={`360 degree panorama of scene ${scene.id}, level ${scene.levelId}`} />;
}
