import React from 'react';
import { TransformSpritePreview } from './TransformSpritePreview';

/**
 * Deliberately disabled in ordinary builds while asset review is P0 NO-GO.
 * An isolated CI preview can exercise the real authenticated Editor UI without
 * enabling public or production access to an unapproved image.
 */
export function TransformEnginePreviewSlot() {
  if (import.meta.env.VITE_ATLAS_TRANSFORM_PREVIEW !== 'isolated-e2e-only') return null;
  return <aside aria-label="ATLAS Transform Engine preview (isolated test)">
    <h3>ATLAS Transform Engine · isolated preview</h3>
    <TransformSpritePreview src="/atlas/transform/frames.png" />
    <p>Unapproved illustrative candidate. Not included in production motion compositions or renders.</p>
  </aside>;
}
